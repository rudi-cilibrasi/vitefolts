// Guards the clausal-form pipeline against untrusted formulas whose normal
// form is astronomically large. Biconditional elimination duplicates both
// sides (A↔B → (¬A∨B)∧(A∨¬B)), and ∨-over-∧ distribution is worst-case
// exponential — so a short adversarial formula (e.g. a chain of a dozen ↔)
// can exhaust memory. A shared step budget converts that OOM into a catchable
// error. Real theories use only a few thousand steps.

export class ClausalFormTooLargeError extends Error {
    constructor(limit: number) {
        super(`clausal-form conversion exceeded ${limit} steps; the formula's normal form is too large to build`);
        this.name = 'ClausalFormTooLargeError';
    }
}

export interface ExpansionBudget {
    count: number;
    limit: number;
}

const DEFAULT_EXPANSION_LIMIT = 500_000;

export function makeExpansionBudget(limit: number = DEFAULT_EXPANSION_LIMIT): ExpansionBudget {
    return { count: 0, limit };
}

// Charge one unit of work; throw once the budget is exhausted.
export function chargeExpansion(budget: ExpansionBudget): void {
    if (++budget.count > budget.limit) {
        throw new ClausalFormTooLargeError(budget.limit);
    }
}
