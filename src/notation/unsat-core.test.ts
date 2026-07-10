import { describe, expect, it } from 'vitest';
import { proofInputIndices, proveConjecture, usedAxioms } from './engine';

describe('unsat core: which axioms a proof used', () => {
    const AX = [
        'forall x. MAN(x) -> MORTAL(x)', // 0
        'MAN(socrates)', // 1
        'forall x. GOD(x) -> ~MORTAL(x)', // 2 — irrelevant to MORTAL(socrates)
    ];

    it('reports only the axioms the proof needs, not the irrelevant one', () => {
        const result = proveConjecture(AX, 'MORTAL(socrates)');
        expect(result.proved).toBe(true);
        expect(usedAxioms(result)).toEqual([0, 1]);
    });

    it('the chain starts from a negated-conjecture clause', () => {
        const result = proveConjecture(AX, 'MORTAL(socrates)');
        const start = result.proof!.startIndex;
        expect(result.sources[start]!.kind).toBe('conjecture');
        expect(proofInputIndices(result.proof!)).toContain(start);
    });

    it('returns no axioms when nothing was proved', () => {
        const result = proveConjecture(AX, 'GOD(socrates)', { maxDepth: 6 });
        expect(result.proved).toBe(false);
        expect(usedAxioms(result)).toEqual([]);
    });
});
