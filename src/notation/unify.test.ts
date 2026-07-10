import { describe, expect, it } from 'vitest';
import { eq, fn, pred, varr } from './builders';
import { n2SI } from './scope';
import { Subst, applySubst, unifyAtoms, unifyTerms } from './unify';

// Ids: functions/predicates in scope 0, variables in scope 1.
const f = n2SI(0, 0);
const g = n2SI(0, 1);
const a = n2SI(0, 2);
const b = n2SI(0, 3);
const P = n2SI(0, 10);
const x = n2SI(1, 0);
const y = n2SI(1, 1);

const konst = (id: bigint) => fn(id);

describe('unifyTerms', () => {
    it('unifies identical constants', () => {
        const s: Subst = new Map();
        expect(unifyTerms(konst(a), konst(a), s)).toBe(true);
        expect(s.size).toBe(0);
    });

    it('binds a variable to a constant', () => {
        const s: Subst = new Map();
        expect(unifyTerms(varr(x), konst(a), s)).toBe(true);
        expect(applySubst(varr(x), s).equals(konst(a))).toBe(true);
    });

    it('fails the occurs check: x with f(x)', () => {
        const s: Subst = new Map();
        expect(unifyTerms(varr(x), fn(f, varr(x)), s)).toBe(false);
    });

    it('fails on function-symbol clash', () => {
        const s: Subst = new Map();
        expect(unifyTerms(fn(f, konst(a)), fn(g, konst(a)), s)).toBe(false);
    });

    it('fails on arity/child mismatch', () => {
        const s: Subst = new Map();
        expect(unifyTerms(fn(f, konst(a)), fn(f, konst(a), konst(b)), s)).toBe(false);
    });

    it('solves a two-variable problem: f(x,a) vs f(b,y)', () => {
        const s: Subst = new Map();
        expect(unifyTerms(fn(f, varr(x), konst(a)), fn(f, konst(b), varr(y)), s)).toBe(true);
        expect(applySubst(varr(x), s).equals(konst(b))).toBe(true);
        expect(applySubst(varr(y), s).equals(konst(a))).toBe(true);
    });

    it('unifies the same variable with itself without binding', () => {
        const s: Subst = new Map();
        expect(unifyTerms(varr(x), varr(x), s)).toBe(true);
        expect(s.size).toBe(0);
    });
});

describe('unifyAtoms', () => {
    it('unifies P(x) with P(a)', () => {
        const s: Subst = new Map();
        expect(unifyAtoms(pred(P, varr(x)), pred(P, konst(a)), s)).toBe(true);
        expect(applySubst(varr(x), s).equals(konst(a))).toBe(true);
    });

    it('does not unify P(...) with an equality atom', () => {
        const s: Subst = new Map();
        expect(unifyAtoms(pred(P, konst(a)), eq(konst(a), konst(a)), s)).toBe(false);
    });
});
