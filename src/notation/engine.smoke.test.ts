import { describe, expect, it } from 'vitest';
import { proveConjecture } from './engine';

describe('engine smoke', () => {
    it('proves Socrates is mortal', () => {
        const axioms = [
            'forall x. MAN(x) -> MORTAL(x)',
            'MAN(socrates)',
        ];
        const result = proveConjecture(axioms, 'MORTAL(socrates)');
        expect(result.proved).toBe(true);
    });

    it('does not prove a non-consequence', () => {
        const axioms = [
            'forall x. MAN(x) -> MORTAL(x)',
            'MAN(socrates)',
        ];
        const result = proveConjecture(axioms, 'GOD(socrates)', { maxDepth: 8 });
        expect(result.proved).toBe(false);
    });
});
