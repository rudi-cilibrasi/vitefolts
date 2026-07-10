import { describe, expect, it } from 'vitest';
import { proveConjecture } from './engine';

// End-to-end trust corpus: parse text → clausal form → resolution. Split into
// theorems the prover MUST refute and non-theorems it MUST NOT (within a
// bounded search). A soundness regression flips a MUST-NOT to proved; a
// completeness regression flips a MUST to unproved.

const SOCRATES = [
    'forall x. MAN(x) -> MORTAL(x)',
    'MAN(socrates)',
    'forall x. GOD(x) -> ~MORTAL(x)',
];

const GROUP = [
    'G(x) & G(y) -> G(x·y)',
    'forall x,y,z. (x·y)·z = x·(y·z)',
    'forall x. (x·e = x & e·x = x)',
    'forall x. G(x) -> exists y. (G(y) & x·y = e)',
    '~forall x. x = e',
];

// Safe river-crossing transitions: REACH(farmer, wolf, goat, cabbage), each
// argument L or R. Only safe states appear.
const RIVER = [
    'REACH(L,L,L,L)',
    'REACH(L,L,L,L) -> REACH(R,L,R,L)',
    'REACH(R,L,R,L) -> REACH(L,L,R,L)',
    'REACH(L,L,R,L) -> REACH(R,R,R,L)',
    'REACH(R,R,R,L) -> REACH(L,R,L,L)',
    'REACH(L,R,L,L) -> REACH(R,R,L,R)',
    'REACH(R,R,L,R) -> REACH(L,R,L,R)',
    'REACH(L,R,L,R) -> REACH(R,R,R,R)',
    'REACH(L,L,R,L) -> REACH(R,L,R,R)',
    'REACH(R,L,R,R) -> REACH(L,L,L,R)',
    'REACH(L,L,L,R) -> REACH(R,R,L,R)',
];

// Peano with the successor-addition recursion axiom (issue #15): x + 0 = x
// alone cannot prove 1 + 1 = 2 — the recursion axiom is what makes it follow.
const PEANO_ARITH = [
    'forall x. x + 0 = x',
    'forall x,y. x + succ(y) = succ(x + y)',
];

describe('theorems the prover must find', () => {
    it('Socrates is mortal', () => {
        expect(proveConjecture(SOCRATES, 'MORTAL(socrates)').proved).toBe(true);
    });

    it('Socrates is not a god', () => {
        expect(proveConjecture(SOCRATES, '~GOD(socrates)').proved).toBe(true);
    });

    it('group identity chains via paramodulation: e·(e·e) = e', () => {
        expect(proveConjecture(GROUP, 'e·(e·e) = e', { maxDepth: 10 }).proved).toBe(true);
    });

    it('river crossing reaches the all-right goal state', () => {
        expect(proveConjecture(RIVER, 'REACH(R,R,R,R)', { maxDepth: 14 }).proved).toBe(true);
    });

    it('1 + 1 = 2 from Peano with the recursion axiom (issue #15)', () => {
        const result = proveConjecture(PEANO_ARITH, 'succ(0) + succ(0) = succ(succ(0))', { maxDepth: 10 });
        expect(result.proved).toBe(true);
    });
});

describe('reverse implication (←) is eliminated, not crashed', () => {
    // A ← B is B → A. The clausal pipeline must eliminate LIMP; before the
    // fix a `<-` reached clause extraction and threw.
    it('proves P from (P ← Q) and Q', () => {
        expect(proveConjecture(['P <- Q', 'Q'], 'P').proved).toBe(true);
    });

    it('treats A ← B as equivalent to B → A (does not prove the converse)', () => {
        expect(proveConjecture(['P <- Q', 'P'], 'Q', { maxDepth: 6 }).proved).toBe(false);
    });

    it('handles a ← conjecture', () => {
        // Prove Q → P, written R(a) ← ... — use a quantified form.
        expect(proveConjecture(['forall x. BIG(x) <- HUGE(x)', 'HUGE(mars)'], 'BIG(mars)').proved).toBe(true);
    });
});

describe('non-theorems the prover must reject (bounded search)', () => {
    it('does not prove Socrates is a god', () => {
        expect(proveConjecture(SOCRATES, 'GOD(socrates)', { maxDepth: 8 }).proved).toBe(false);
    });

    it('does not prove an unsafe/unreachable river state', () => {
        // Farmer right, wolf+goat left together — never a safe state.
        expect(proveConjecture(RIVER, 'REACH(R,L,L,R)', { maxDepth: 8, maxAttempts: 8000 }).proved).toBe(false);
    });

    it('does not prove x + 0 = 0 (false for x = 1)', () => {
        expect(proveConjecture(PEANO_ARITH, 'succ(0) + 0 = 0', { maxDepth: 8 }).proved).toBe(false);
    });
});

describe('deep search under a per-depth attempt budget', () => {
    // A long modus-ponens chain P0, P0→P1, …, P9→P10 ⊢ P10 needs an 11-step
    // refutation. With the attempt budget shared across iterative-deepening
    // depths, shallow re-search exhausts a small budget before the search
    // reaches depth 11; resetting per depth finds it.
    // At maxAttempts=60 a single shared budget is exhausted by shallow
    // re-search and never reaches the depth-11 refutation (verified: it fails
    // with the shared budget, succeeds once reset per depth).
    const CHAIN = 10;
    const axioms = ['P0', ...Array.from({ length: CHAIN }, (_, i) => `P${i} -> P${i + 1}`)];

    it('proves the end of a long chain within a tight per-depth budget', () => {
        const result = proveConjecture(axioms, `P${CHAIN}`, { maxDepth: 14, maxAttempts: 60 });
        expect(result.proved).toBe(true);
    });
});
