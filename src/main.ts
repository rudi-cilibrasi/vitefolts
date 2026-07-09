import './style.css';
import { buildPeanoAxioms } from './axioms.ts';
import { setupApp, PipelineStep } from './ui.ts';
import {
    clausal_form_iffs_out,
    clausal_form_implications_out,
    clausal_form_negations_in,
    clausal_form_remove_double_negations,
} from './notation/clause.ts';
import { print_symbol_table } from './notation/symbol-table-printer.ts';

const { truthBag, axioms } = buildPeanoAxioms();

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

setupApp(
    document.querySelector<HTMLDivElement>('#app')!,
    axioms,
    steps,
    truthBag.symbol_table,
    print_symbol_table(truthBag.symbol_table),
);
