import './style.css';
import { EXAMPLES } from './examples.ts';
import { setupApp, PipelineStep, ExampleUI } from './ui.ts';
import {
    clausal_form_iffs_out,
    clausal_form_implications_out,
    clausal_form_limplications_out,
    clausal_form_negations_in,
    clausal_form_remove_double_negations,
} from './notation/clause.ts';
import { distribute_or_over_and, drop_foralls, skolemize } from './notation/cnf.ts';

const steps: PipelineStep[] = [
    {
        label: '→ out',
        detail: 'Eliminate implications: A → B rewrites to (¬A)∨(B).',
        transform: (s) => clausal_form_implications_out(s),
    },
    {
        label: '← out',
        detail: 'Eliminate reverse implications: A ← B rewrites to (A)∨(¬B).',
        transform: (s) => clausal_form_limplications_out(s),
    },
    {
        label: '↔ out',
        detail: 'Eliminate biconditionals: A ↔ B rewrites to [(¬A)∨(B)]∧[(A)∨(¬B)].',
        transform: (s) => clausal_form_iffs_out(s),
    },
    {
        label: '¬¬ cancel',
        detail: 'Remove double negations: ¬¬A rewrites to A.',
        transform: (s) => clausal_form_remove_double_negations(s),
    },
    {
        label: '¬ inward',
        detail: 'Push negations inward (De Morgan): ¬(A∧B) reflects the ∧ into ∨, ¬∃ flips into ∀¬.',
        transform: (s) => clausal_form_negations_in(s),
    },
    {
        label: '∃ skolem',
        detail: 'Skolemize: each ∃-variable becomes a Skolem function σₖ of the ∀-variables in scope.',
        transform: (s, ctx) => skolemize(s, ctx),
    },
    {
        label: '∀ drop',
        detail: 'Drop universal quantifiers — every remaining variable is implicitly universal.',
        transform: (s) => drop_foralls(s),
    },
    {
        label: '∨ over ∧',
        detail: 'Distribute ∨ over ∧ to reach conjunctive normal form.',
        transform: (s) => distribute_or_over_and(s),
    },
];

const examples: ExampleUI[] = EXAMPLES.map((def) => {
    const { truthBag, axioms, conjectures } = def.build();
    return {
        name: def.name,
        hint: def.hint,
        axioms,
        conjectures,
        symbolTable: truthBag.symbol_table,
    };
});

setupApp(document.querySelector<HTMLDivElement>('#app')!, examples, steps);
