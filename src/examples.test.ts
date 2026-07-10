import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { proveTrees } from './notation/engine';

describe('Ancestry example (Skolem-function showcase)', () => {
    const def = EXAMPLES.find((e) => e.name === 'Ancestry');

    it('is registered', () => {
        expect(def).toBeDefined();
    });

    it('proves everyone has an ancestor (closes on the Skolem parent)', () => {
        const { axioms, conjectures } = def!.build();
        const result = proveTrees(axioms.map((a) => a.tree), conjectures[0].tree, { maxDepth: 10 });
        expect(result.proved).toBe(true);
    });

    it('does not prove someone has no parent (contradicts an axiom)', () => {
        const { axioms, conjectures } = def!.build();
        const result = proveTrees(axioms.map((a) => a.tree), conjectures[1].tree, { maxDepth: 6, maxAttempts: 5000 });
        expect(result.proved).toBe(false);
    });
});
