import { eq, not, varr } from './builders';
import {
    clausal_form_iffs_out,
    clausal_form_implications_out,
    clausal_form_limplications_out,
    clausal_form_negations_in,
    clausal_form_remove_double_negations,
} from './clause';
import {
    Clause,
    StepContext,
    clauseHasEquality,
    distribute_or_over_and,
    drop_foralls,
    extractClauses,
    skolemize,
} from './cnf';
import { Registry, parseSentence } from './parser';
import { Proof, ProveOptions, ProverEnv, prove } from './resolution';
import { ScopedId, n2SI } from './scope';
import { SentenceTreeNode } from './sentence-tree-node';

// Headless, UI-free entry point for the first-order-logic engine: text in,
// clauses and proofs out. This is the surface intended to become the
// standalone @folts/core package (repo issue #17) — it depends only on the
// pure notation modules, never on the DOM, animation, or Vite. The Vite app
// is one consumer among (eventually) many.

// Skolem functions and prover-renamed variables need fresh ScopedIds that
// never collide with parser-allocated symbols. The parser hands out function
// and predicate ids in scope 0 counting up from 0, and variable ids in
// scope 1; these bases sit far above any realistic parse, in their own scopes.
const SKOLEM_SCOPE = 0;
const SKOLEM_BASE = 1_000_000;
const PROVER_VAR_SCOPE = 3;

// A fresh Skolem context. Each existential quantifier consumes one id, so a
// single context shared across a whole theory keeps every Skolem function
// distinct — exactly the standard skolemization semantics.
export function makeStepContext(): StepContext {
    let next = 0;
    return {
        freshSkolem(_arity: number): ScopedId {
            return n2SI(SKOLEM_SCOPE, SKOLEM_BASE + next++);
        },
    };
}

// A fresh prover environment. Variables live in their own scope so a renamed
// input clause can never capture a parser or Skolem id.
export function makeProverEnv(): ProverEnv {
    let next = 0;
    return {
        freshVar(_base: ScopedId): ScopedId {
            return n2SI(PROVER_VAR_SCOPE, next++);
        },
    };
}

// Run the full clausal-form pipeline on one sentence: eliminate →, ←, ↔,
// cancel ¬¬, push ¬ inward (NNF), Skolemize ∃, drop ∀, distribute ∨ over ∧.
// The ← (left-implication) step is included so a formula using `<-` reaches
// CNF instead of surfacing a raw LIMP node at clause extraction.
export function toClausalForm(sentence: SentenceTreeNode, ctx: StepContext): SentenceTreeNode {
    let s = sentence;
    s = clausal_form_implications_out(s);
    s = clausal_form_limplications_out(s);
    s = clausal_form_iffs_out(s);
    s = clausal_form_remove_double_negations(s);
    s = clausal_form_negations_in(s);
    s = skolemize(s, ctx);
    s = drop_foralls(s);
    s = distribute_or_over_and(s);
    return s;
}

// Clauses of one sentence, taking it all the way from tree to clause list.
export function sentenceToClauses(sentence: SentenceTreeNode, ctx: StepContext): Clause[] {
    return extractClauses(toClausalForm(sentence, ctx));
}

export interface TheoryResult {
    proved: boolean;
    proof: Proof | null;
    // Every input clause handed to the prover, axioms first then the negated
    // conjecture, in order — useful for rendering or debugging a run.
    clauses: Clause[];
    // Indices into `clauses` of the negated-conjecture clauses (the set of
    // support the search starts from).
    sosIndices: number[];
}

// Prove that `conjecture` follows from `axioms` by refuting
// axioms ∧ ¬conjecture. All sentences are parsed through one shared registry
// so a predicate or function of the same name is the same symbol everywhere —
// without that, complementary literals across sentences would never unify.
export function proveConjecture(
    axioms: string[],
    conjecture: string,
    options?: ProveOptions,
): TheoryResult {
    // One shared registry so a predicate or function of the same name is the
    // same symbol across every sentence — without it, complementary literals
    // from different sentences would never unify.
    const registry = new Registry();
    const axiomTrees = axioms.map((axiom) => parseSentence(axiom, registry));
    const conjectureTree = parseSentence(conjecture, registry);
    return proveTrees(axiomTrees, conjectureTree, options);
}

// Prove a conjecture given axioms as already-built sentence trees (e.g. from
// the programmatic example builders). Refutes axioms ∧ ¬conjecture.
export function proveTrees(
    axiomTrees: SentenceTreeNode[],
    conjectureTree: SentenceTreeNode,
    options?: ProveOptions,
): TheoryResult {
    const ctx = makeStepContext();
    const env = makeProverEnv();

    const clauses: Clause[] = [];
    for (const tree of axiomTrees) {
        for (const clause of sentenceToClauses(tree, ctx)) {
            clauses.push(clause);
        }
    }

    const sosIndices: number[] = [];
    for (const clause of sentenceToClauses(not(conjectureTree), ctx)) {
        sosIndices.push(clauses.length);
        clauses.push(clause);
    }

    // Paramodulation rewrites a goal down to t = t but needs a positive
    // equality literal to close the resulting disequality against — add
    // reflexivity ∀x. x = x once any clause mentions equality. (Not part of
    // the set of support, so the search never starts from it.)
    if (clauses.some(clauseHasEquality)) {
        const reflVar = n2SI(1, 0);
        clauses.push({ literals: [{ positive: true, atom: eq(varr(reflVar), varr(reflVar)) }] });
    }

    const proof = prove(clauses, sosIndices, env, options);
    return { proved: proof !== null, proof, clauses, sosIndices };
}

export { ParseError, Registry, parseSentence } from './parser';
export { extractClauses } from './cnf';
export type { Clause, Literal } from './cnf';
export { prove } from './resolution';
export type { Proof, ProofStep, ProveOptions, ProverEnv } from './resolution';
export type { SentenceTreeNode } from './sentence-tree-node';
