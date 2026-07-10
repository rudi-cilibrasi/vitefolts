import { describe, expect, it } from 'vitest';
import { ClausalFormTooLargeError } from './expansion-guard';
import { ParseError, Registry, parseSentence } from './parser';
import { proveConjecture } from './engine';

// A prover that parses untrusted input must degrade to a catchable error, not
// crash the process. These inputs previously exhausted memory or the stack.

describe('clausal-form expansion is bounded', () => {
    it('a chain of biconditionals throws instead of OOM', () => {
        const bomb = Array.from({ length: 30 }, (_, i) => `P${i}`).join(' <-> ');
        expect(() => proveConjecture([bomb], 'X', { maxDepth: 2 }))
            .toThrow(ClausalFormTooLargeError);
    });

    it('an ∨-over-∧ blowup throws instead of OOM', () => {
        const bomb = Array.from({ length: 40 }, (_, i) => `(A${i} & B${i})`).join(' | ');
        expect(() => proveConjecture([bomb], 'X', { maxDepth: 2 }))
            .toThrow(ClausalFormTooLargeError);
    });

    it('still converts ordinary formulas (no false positive)', () => {
        const r = proveConjecture(['A <-> B', 'A'], 'B', { maxDepth: 6 });
        expect(r.proved).toBe(true);
    });
});

describe('parser recursion is bounded', () => {
    it('deeply nested parentheses throw a ParseError, not a stack overflow', () => {
        const deep = '('.repeat(5000) + 'P' + ')'.repeat(5000);
        expect(() => parseSentence(deep, new Registry())).toThrow(ParseError);
    });

    it('a long chain of negations throws a ParseError', () => {
        expect(() => parseSentence('~'.repeat(5000) + 'P', new Registry())).toThrow(ParseError);
    });

    it('normal nesting still parses', () => {
        expect(() => parseSentence('~~(P & (Q | R))', new Registry())).not.toThrow();
    });
});
