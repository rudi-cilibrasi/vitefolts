import { List } from 'immutable';
import { OperationType } from './operation-type';
import { ScopedId } from './scope';
import { S3, S3F, SentenceTreeNode } from './sentence-tree-node';

// Completion of the clausal-form pipeline: skolemization, universal
// quantifier dropping, ∨/∧ distribution, and clause extraction. These run
// after the NNF steps in clause.ts.

// Pipeline steps that mint new symbols (Skolem functions) report them
// through this context so the UI can register them in the symbol table.
export interface StepContext {
    freshSkolem(arity: number): ScopedId;
}

export function freeVars(tree: SentenceTreeNode): ScopedId[] {
    const found: ScopedId[] = [];
    const seen = new Set<ScopedId>();
    const walk = (node: SentenceTreeNode, bound: Set<ScopedId>) => {
        if (node.operation === OperationType.VARIABLE_INSTANCE) {
            const id = node.bound_vars.get(0)!;
            if (!bound.has(id) && !seen.has(id)) {
                seen.add(id);
                found.push(id);
            }
            return;
        }
        let inner = bound;
        if (node.operation === OperationType.FORALL || node.operation === OperationType.EXISTS) {
            inner = new Set(bound);
            for (const v of node.bound_vars) {
                inner.add(v);
            }
        }
        for (const child of node.children) {
            walk(child, inner);
        }
    };
    walk(tree, new Set());
    return found;
}

// Replace each ∃-bound variable with a Skolem function applied to the
// universally quantified variables in scope at that point. Assumes NNF (no
// ∃ under an unprocessed ¬). Free variables of the sentence are implicitly
// universal, so they participate as Skolem arguments too.
export function skolemize(tree: SentenceTreeNode, ctx: StepContext): SentenceTreeNode {
    const walk = (node: SentenceTreeNode, univ: ScopedId[], repl: Map<ScopedId, SentenceTreeNode>): SentenceTreeNode => {
        switch (node.operation) {
            case OperationType.VARIABLE_INSTANCE: {
                const id = node.bound_vars.get(0)!;
                const r = repl.get(id);
                return r === undefined ? node : r;
            }
            case OperationType.FORALL: {
                const inner = univ.concat(node.bound_vars.toArray());
                const children = node.children.map((c) => walk(c, inner, repl));
                return S3F({ operation: node.operation, children, bound_vars: node.bound_vars });
            }
            case OperationType.EXISTS: {
                const nextRepl = new Map(repl);
                for (const v of node.bound_vars) {
                    const skId = ctx.freshSkolem(univ.length);
                    const args = List(univ.map((u) => S3(OperationType.VARIABLE_INSTANCE, List(), List([u]))));
                    nextRepl.set(v, S3(OperationType.FUNCTIONCALL, args, List([skId])));
                }
                return walk(node.children.get(0)!, univ, nextRepl);
            }
            default: {
                if (node.children.size === 0) return node;
                const children = node.children.map((c) => walk(c, univ, repl));
                return S3F({ operation: node.operation, children, bound_vars: node.bound_vars });
            }
        }
    };
    return walk(tree, freeVars(tree), new Map());
}

export function drop_foralls(tree: SentenceTreeNode): SentenceTreeNode {
    if (tree.operation === OperationType.FORALL) {
        return drop_foralls(tree.children.get(0)!);
    }
    if (tree.children.size === 0) return tree;
    const children = tree.children.map(drop_foralls);
    return S3F({ operation: tree.operation, children, bound_vars: tree.bound_vars });
}

function leavesOf(op: OperationType, node: SentenceTreeNode): SentenceTreeNode[] {
    if (node.operation === op) {
        const out: SentenceTreeNode[] = [];
        for (const c of node.children) {
            out.push(...leavesOf(op, c));
        }
        return out;
    }
    return [node];
}

// Distribute ∨ over ∧ (and flatten nested ∧/∨) to reach CNF. Assumes a
// quantifier-free NNF input.
export function distribute_or_over_and(tree: SentenceTreeNode): SentenceTreeNode {
    if (tree.operation === OperationType.AND) {
        const parts = tree.children.map(distribute_or_over_and);
        const leaves: SentenceTreeNode[] = [];
        for (const p of parts) {
            leaves.push(...leavesOf(OperationType.AND, p));
        }
        return leaves.length === 1 ? leaves[0] : S3(OperationType.AND, List(leaves), List([]));
    }
    if (tree.operation === OperationType.OR) {
        const parts: SentenceTreeNode[] = [];
        for (const c of tree.children) {
            parts.push(...leavesOf(OperationType.OR, distribute_or_over_and(c)));
        }
        const andIndex = parts.findIndex((p) => p.operation === OperationType.AND);
        if (andIndex === -1) {
            return parts.length === 1 ? parts[0] : S3(OperationType.OR, List(parts), List([]));
        }
        const andPart = parts[andIndex];
        const rest = parts.filter((_, i) => i !== andIndex);
        const conjuncts = andPart.children.map((conj) =>
            distribute_or_over_and(S3(OperationType.OR, List([conj, ...rest]), List([]))));
        return distribute_or_over_and(S3(OperationType.AND, conjuncts, List([])));
    }
    return tree;
}

export interface Literal {
    positive: boolean;
    atom: SentenceTreeNode;
}

export interface Clause {
    literals: Literal[];
}

function parseLiteral(node: SentenceTreeNode): Literal {
    if (node.operation === OperationType.NOT) {
        const atom = node.children.get(0)!;
        if (atom.operation !== OperationType.PREDICATECALL && atom.operation !== OperationType.EQUALS) {
            throw new Error(`Expected atom under ¬, got ${OperationType[atom.operation]}`);
        }
        return { positive: false, atom };
    }
    if (node.operation !== OperationType.PREDICATECALL && node.operation !== OperationType.EQUALS) {
        throw new Error(`Expected literal, got ${OperationType[node.operation]}`);
    }
    return { positive: true, atom: node };
}

// Split a CNF sentence into clauses (each a set of literals).
export function extractClauses(tree: SentenceTreeNode): Clause[] {
    return leavesOf(OperationType.AND, tree).map((disjunct) => {
        const literals = leavesOf(OperationType.OR, disjunct).map(parseLiteral);
        return { literals: dedupeLiterals(literals) };
    });
}

export function dedupeLiterals(literals: Literal[]): Literal[] {
    const out: Literal[] = [];
    for (const l of literals) {
        if (!out.some((m) => m.positive === l.positive && m.atom.equals(l.atom))) {
            out.push(l);
        }
    }
    return out;
}

export function clauseHasEquality(clause: Clause): boolean {
    return clause.literals.some((l) => l.atom.operation === OperationType.EQUALS);
}
