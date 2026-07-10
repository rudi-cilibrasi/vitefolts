import { describe, expect, it } from 'vitest';
import { decodeTheory, encodeTheory } from './permalink';

describe('permalink encode/decode', () => {
    it('round-trips a theory, including Unicode symbols and newlines', () => {
        const ax = 'forall x. MAN(x) → MORTAL(x)\nMAN(socrates)';
        const conj = 'MORTAL(socrates)\n∃x.GOD(x)  # not entailed';
        const decoded = decodeTheory(encodeTheory(ax, conj));
        expect(decoded).toEqual({ axioms: ax, conjectures: conj });
    });

    it('produces a URL-safe string (no +, /, or =)', () => {
        const enc = encodeTheory('P(a) & Q(b) | R(c)', '∀x.∃y.LOVES(x,y)');
        expect(enc).not.toMatch(/[+/=]/);
    });

    it('returns null on garbage input', () => {
        expect(decodeTheory('not-valid-base64!!')).toBeNull();
        expect(decodeTheory('')).toBeNull();
    });

    it('returns null when the payload lacks the expected shape', () => {
        // Valid base64url of JSON that is not a {a,c} theory.
        const enc = encodeTheory('x', 'y').slice(0, 4);
        expect(decodeTheory(enc)).toBeNull();
    });
});
