import { List } from 'immutable';
import { Clause, Literal, dedupeLiterals } from './cnf';
import { OperationType } from './operation-type';
import { ScopedId } from './scope';
import { S3, S3F, SentenceTreeNode } from './sentence-tree-node';
import { Subst, applySubst, isVar, termSize, unifyAtoms, unifyTerms, varId } from './unify';

// Linear resolution with paramodulation. The prover refutes
// axioms ∧ ¬conjecture by deriving the empty clause □: each step combines
// the current center clause with an input clause or an ancestor, via
//  * binary resolution (complementary literals unify),
//  * paramodulation (a positive equality s=t in the side clause rewrites a
//    subterm of the center clause), or
//  * factoring (two center literals of the same sign unify).
// Search is iterative-deepening DFS over proof length, smallest resolvents
// first, so the shortest proof is found.

export interface ProverEnv {
    // Return a fresh variable id whose display name shadows `base` (e.g. x → x′).
    freshVar(base: ScopedId): ScopedId;
}

export type SideRef =
    | { kind: 'input'; index: number }
    | { kind: 'derived'; index: number };

export interface ProofStep {
    kind: 'resolve' | 'paramodulate' | 'factor';
    sideRef: SideRef | null;
    sideRenamed: Clause | null;
    substPairs: Array<[ScopedId, SentenceTreeNode]>;
    resolvent: Clause;
}

export interface Proof {
    startIndex: number;   // index into the input clause list where the chain begins
    steps: ProofStep[];
}

function clauseVars(clause: Clause): ScopedId[] {
    const out: ScopedId[] = [];
    const seen = new Set<ScopedId>();
    const walk = (t: SentenceTreeNode) => {
        if (isVar(t)) {
            const id = varId(t);
            if (!seen.has(id)) {
                seen.add(id);
                out.push(id);
            }
            return;
        }
        for (const c of t.children) walk(c);
    };
    for (const l of clause.literals) walk(l.atom);
    return out;
}

function renameClause(clause: Clause, env: ProverEnv): Clause {
    const vars = clauseVars(clause);
    if (vars.length === 0) return clause;
    const subst: Subst = new Map();
    for (const v of vars) {
        subst.set(v, S3(OperationType.VARIABLE_INSTANCE, List(), List([env.freshVar(v)])));
    }
    return { literals: clause.literals.map((l) => ({ positive: l.positive, atom: applySubst(l.atom, subst) })) };
}

function substClause(clause: Clause, subst: Subst): Clause {
    return { literals: dedupeLiterals(clause.literals.map((l) => ({ positive: l.positive, atom: applySubst(l.atom, subst) }))) };
}

function isTautology(clause: Clause): boolean {
    return clause.literals.some((l) => {
        // A positive t = t literal is always true, so the whole clause is.
        if (l.positive && l.atom.operation === OperationType.EQUALS
            && l.atom.children.get(0)!.equals(l.atom.children.get(1)!)) {
            return true;
        }
        // Complementary literals p and ¬p on the same atom.
        return l.positive && clause.literals.some((m) => !m.positive && m.atom.equals(l.atom));
    });
}

function clauseSize(clause: Clause): number {
    let size = 0;
    for (const l of clause.literals) size += termSize(l.atom);
    return size;
}

function clauseKey(clause: Clause): string {
    return clause.literals
        .map((l) => `${l.positive ? '+' : '-'}${l.atom.hashCode()}`)
        .sort()
        .join('|');
}

function swapEquals(atom: SentenceTreeNode): SentenceTreeNode | null {
    if (atom.operation !== OperationType.EQUALS) return null;
    return S3F({
        operation: OperationType.EQUALS,
        children: List([atom.children.get(1)!, atom.children.get(0)!]),
        bound_vars: atom.bound_vars,
    });
}

function substPairsOf(subst: Subst): Array<[ScopedId, SentenceTreeNode]> {
    const pairs: Array<[ScopedId, SentenceTreeNode]> = [];
    for (const [id] of subst) {
        pairs.push([id, applySubst(S3(OperationType.VARIABLE_INSTANCE, List(), List([id])), subst)]);
    }
    return pairs;
}

interface TermPosition {
    path: number[];
    term: SentenceTreeNode;
}

// All non-variable term positions inside an atom's arguments.
function termPositions(atom: SentenceTreeNode): TermPosition[] {
    const out: TermPosition[] = [];
    const walk = (t: SentenceTreeNode, path: number[]) => {
        if (isVar(t)) return;
        out.push({ path, term: t });
        t.children.forEach((c, i) => walk(c, [...path, i]));
    };
    atom.children.forEach((c, i) => walk(c, [i]));
    return out;
}

function replaceAt(node: SentenceTreeNode, path: number[], replacement: SentenceTreeNode): SentenceTreeNode {
    if (path.length === 0) return replacement;
    const [head, ...rest] = path;
    const children = node.children.map((c, i) => (i === head ? replaceAt(c, rest, replacement) : c));
    return S3F({ operation: node.operation, children, bound_vars: node.bound_vars });
}

interface Candidate {
    step: ProofStep;
}

const DEFAULT_MAX_LITERALS = 6;
const DEFAULT_MAX_CLAUSE_SIZE = 60;

interface ClauseLimits {
    maxLiterals: number;
    maxClauseSize: number;
}

function candidatesWith(center: Clause, side: Clause, sideRef: SideRef, env: ProverEnv, limits: ClauseLimits): Candidate[] {
    const out: Candidate[] = [];
    const renamed = renameClause(side, env);
    const push = (kind: ProofStep['kind'], subst: Subst, resolvent: Clause, withSide: boolean) => {
        if (resolvent.literals.length > limits.maxLiterals) return;
        if (clauseSize(resolvent) > limits.maxClauseSize) return;
        if (isTautology(resolvent)) return;
        out.push({
            step: {
                kind,
                sideRef: withSide ? sideRef : null,
                sideRenamed: withSide ? renamed : null,
                substPairs: substPairsOf(subst),
                resolvent,
            },
        });
    };

    // Binary resolution: center literal against complementary side literal.
    center.literals.forEach((cl, ci) => {
        renamed.literals.forEach((sl, si) => {
            if (cl.positive === sl.positive) return;
            const sideAtoms = [sl.atom];
            const swapped = swapEquals(sl.atom);
            if (swapped !== null) sideAtoms.push(swapped);
            for (const sideAtom of sideAtoms) {
                const subst: Subst = new Map();
                if (!unifyAtoms(cl.atom, sideAtom, subst)) continue;
                const rest: Literal[] = [
                    ...center.literals.filter((_, i) => i !== ci),
                    ...renamed.literals.filter((_, i) => i !== si),
                ];
                push('resolve', subst, substClause({ literals: rest }, subst), true);
                break;
            }
        });
    });

    // Paramodulation: positive equality in the side clause rewrites a
    // non-variable subterm of a center literal.
    renamed.literals.forEach((sl, si) => {
        if (!sl.positive || sl.atom.operation !== OperationType.EQUALS) return;
        const s = sl.atom.children.get(0)!;
        const t = sl.atom.children.get(1)!;
        const orientations: Array<[SentenceTreeNode, SentenceTreeNode]> = [[s, t], [t, s]];
        for (const [from, to] of orientations) {
            if (isVar(from)) continue;
            center.literals.forEach((cl, ci) => {
                for (const pos of termPositions(cl.atom)) {
                    const subst: Subst = new Map();
                    if (!unifyTerms(pos.term, from, subst)) continue;
                    const newAtom = replaceAt(cl.atom, pos.path, to);
                    const rest: Literal[] = [
                        ...center.literals.filter((_, i) => i !== ci),
                        { positive: cl.positive, atom: newAtom },
                        ...renamed.literals.filter((_, i) => i !== si),
                    ];
                    push('paramodulate', subst, substClause({ literals: rest }, subst), true);
                }
            });
        }
    });

    return out;
}

function factorCandidates(center: Clause): Candidate[] {
    const out: Candidate[] = [];
    center.literals.forEach((a, i) => {
        center.literals.forEach((b, j) => {
            if (j <= i || a.positive !== b.positive) return;
            const subst: Subst = new Map();
            if (!unifyAtoms(a.atom, b.atom, subst)) return;
            const rest = center.literals.filter((_, k) => k !== j);
            const resolvent = substClause({ literals: rest }, subst);
            if (isTautology(resolvent)) return;
            out.push({
                step: {
                    kind: 'factor',
                    sideRef: null,
                    sideRenamed: null,
                    substPairs: substPairsOf(subst),
                    resolvent,
                },
            });
        });
    });
    return out;
}

export interface ProveOptions {
    maxDepth?: number;
    // Attempt budget PER iterative-deepening depth (reset at each depth), not
    // a single budget shared across depths — otherwise shallow re-search burns
    // it and deep proofs become unreachable.
    maxAttempts?: number;
    // Hard caps that prune oversized resolvents during search. Raising them
    // lets larger clauses through at the cost of a bigger search space.
    maxLiterals?: number;
    maxClauseSize?: number;
}

export function prove(inputs: Clause[], sosIndices: number[], env: ProverEnv, options?: ProveOptions): Proof | null {
    const maxDepth = options?.maxDepth ?? 8;
    const budget = { attempts: 0, max: options?.maxAttempts ?? 20000 };
    const limits: ClauseLimits = {
        maxLiterals: options?.maxLiterals ?? DEFAULT_MAX_LITERALS,
        maxClauseSize: options?.maxClauseSize ?? DEFAULT_MAX_CLAUSE_SIZE,
    };

    const dfs = (
        center: Clause,
        derived: Clause[],
        seen: Set<string>,
        remaining: number,
    ): ProofStep[] | null => {
        if (center.literals.length === 0) return [];
        if (remaining === 0) return null;
        if (budget.attempts > budget.max) return null;

        const candidates: Candidate[] = [];
        inputs.forEach((clause, index) => {
            candidates.push(...candidatesWith(center, clause, { kind: 'input', index }, env, limits));
        });
        derived.forEach((clause, index) => {
            candidates.push(...candidatesWith(center, clause, { kind: 'derived', index }, env, limits));
        });
        candidates.push(...factorCandidates(center));
        candidates.sort((a, b) => a.step.resolvent.literals.length - b.step.resolvent.literals.length
            || clauseSize(a.step.resolvent) - clauseSize(b.step.resolvent));

        for (const cand of candidates) {
            budget.attempts++;
            if (budget.attempts > budget.max) return null;
            const key = clauseKey(cand.step.resolvent);
            if (seen.has(key)) continue;
            seen.add(key);
            const rest = dfs(cand.step.resolvent, [...derived, center], seen, remaining - 1);
            seen.delete(key);
            if (rest !== null) {
                return [cand.step, ...rest];
            }
        }
        return null;
    };

    for (let depth = 1; depth <= maxDepth; depth++) {
        // Fresh budget for each depth: iterative deepening re-explores the
        // shallow layers every pass, so a single shared budget would be spent
        // there before the search ever reaches the depth a long proof needs.
        budget.attempts = 0;
        for (const start of sosIndices) {
            const center = inputs[start];
            const steps = dfs(center, [], new Set([clauseKey(center)]), depth);
            if (steps !== null) {
                return { startIndex: start, steps };
            }
        }
    }
    return null;
}
