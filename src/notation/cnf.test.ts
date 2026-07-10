import { describe, expect, it } from 'vitest';
import { and, exists, forall, or, pred, varr } from './builders';
import { StepContext, distribute_or_over_and, extractClauses, freeVars, skolemize } from './cnf';
import { OperationType } from './operation-type';
import { n2SI, ScopedId } from './scope';

const P = n2SI(0, 0);
const Q = n2SI(0, 1);
const R = n2SI(0, 2);
const x = n2SI(1, 0);
const y = n2SI(1, 1);

function stepContext(): StepContext {
    let next = 0;
    return { freshSkolem: (_arity: number): ScopedId => n2SI(0, 900 + next++) };
}

describe('freeVars', () => {
    it('reports a free variable', () => {
        expect(freeVars(pred(P, varr(x)))).toEqual([x]);
    });

    it('reports nothing when the variable is bound', () => {
        expect(freeVars(forall([x], pred(P, varr(x))))).toEqual([]);
    });
});

describe('skolemize', () => {
    it('replaces a top-level ∃ with a Skolem constant', () => {
        const result = skolemize(exists([y], pred(P, varr(y))), stepContext());
        // ∃y.P(y) → P(σ) where σ is a 0-ary function (constant).
        expect(result.operation).toBe(OperationType.PREDICATECALL);
        const arg = result.children.get(0)!;
        expect(arg.operation).toBe(OperationType.FUNCTIONCALL);
        expect(arg.children.size).toBe(0);
    });

    it('makes the Skolem function depend on the enclosing ∀ variable', () => {
        // ∀x.∃y.R(x,y) → ∀x.R(x, σ(x)) — σ is unary, applied to x.
        const result = skolemize(forall([x], exists([y], pred(R, varr(x), varr(y)))), stepContext());
        expect(result.operation).toBe(OperationType.FORALL);
        const body = result.children.get(0)!;
        expect(body.operation).toBe(OperationType.PREDICATECALL);
        const skTerm = body.children.get(1)!;
        expect(skTerm.operation).toBe(OperationType.FUNCTIONCALL);
        expect(skTerm.children.size).toBe(1);
        expect(skTerm.children.get(0)!.operation).toBe(OperationType.VARIABLE_INSTANCE);
        expect(skTerm.children.get(0)!.bound_vars.get(0)).toBe(x);
    });
});

describe('distribute_or_over_and', () => {
    it('distributes (P ∧ Q) ∨ R into (P ∨ R) ∧ (Q ∨ R)', () => {
        const input = or(and(pred(P, varr(x)), pred(Q, varr(x))), pred(R, varr(x)));
        const clauses = extractClauses(distribute_or_over_and(input));
        // Two clauses, each with two literals.
        expect(clauses.length).toBe(2);
        for (const clause of clauses) {
            expect(clause.literals.length).toBe(2);
        }
    });
});
