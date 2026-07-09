import './style.css';
import { EXAMPLES } from './examples.ts';
import { setupApp, PipelineStep, ExampleUI } from './ui.ts';
import {
    clausal_form_iffs_out,
    clausal_form_implications_out,
    clausal_form_negations_in,
    clausal_form_remove_double_negations,
} from './notation/clause.ts';
import { print_symbol_table } from './notation/symbol-table-printer.ts';

const steps: PipelineStep[] = [
    {
        label: '→ out',
        detail: 'Eliminate implications: A → B rewrites to (¬A)∨(B).',
        transform: clausal_form_implications_out,
    },
    {
        label: '↔ out',
        detail: 'Eliminate biconditionals: A ↔ B rewrites to [(¬A)∨(B)]∧[(A)∨(¬B)].',
        transform: clausal_form_iffs_out,
    },
    {
        label: '¬¬ cancel',
        detail: 'Remove double negations: ¬¬A rewrites to A.',
        transform: clausal_form_remove_double_negations,
    },
    {
        label: '¬ inward',
        detail: 'Push negations inward (De Morgan): ¬(A∧B) reflects the ∧ into ∨, ¬∃ flips into ∀¬.',
        transform: clausal_form_negations_in,
    },
];

const examples: ExampleUI[] = EXAMPLES.map((def) => {
    const { truthBag, axioms } = def.build();
    return {
        name: def.name,
        hint: def.hint,
        axioms,
        symbolTable: truthBag.symbol_table,
        symbolTableHtml: print_symbol_table(truthBag.symbol_table),
    };
});

setupApp(document.querySelector<HTMLDivElement>('#app')!, examples, steps);
