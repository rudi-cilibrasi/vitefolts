import { describe, expect, it } from 'vitest';
import { buildPeanoAxioms } from './axioms';
import { proveTrees } from './notation/engine';

describe('Peano example (issue #15)', () => {
    it('proves its 1 + 1 = 2 conjecture from the shipped axioms', () => {
        const { axioms, conjectures } = buildPeanoAxioms();
        const onePlusOne = conjectures[0]; // succ(0) + succ(0) = succ(succ(0))
        const result = proveTrees(
            axioms.map((a) => a.tree),
            onePlusOne.tree,
            { maxDepth: 12 },
        );
        expect(result.proved).toBe(true);
    });

    it('still proves NAT(succ(0))', () => {
        const { axioms, conjectures } = buildPeanoAxioms();
        const natSuccZero = conjectures[conjectures.length - 1];
        const result = proveTrees(axioms.map((a) => a.tree), natSuccZero.tree, { maxDepth: 10 });
        expect(result.proved).toBe(true);
    });
});
