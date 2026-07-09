import { List } from 'immutable';
import { OperationType } from './notation/operation-type.ts';
import { n2SI, ScopedId } from './notation/scope.ts';
import { S3, SentenceTreeNode } from './notation/sentence-tree-node.ts';
import { TruthBag } from './notation/truth-bag.ts';
import { Axiom, AxiomSet, buildPeanoAxioms } from './axioms.ts';

export interface ExampleDef {
    name: string;
    hint: string;
    build: () => AxiomSet;
}

// Small combinators so example theories read close to their mathematical form.
const and = (...cs: SentenceTreeNode[]) => S3(OperationType.AND, List(cs), List([]));
const not = (c: SentenceTreeNode) => S3(OperationType.NOT, List([c]), List([]));
const implies = (a: SentenceTreeNode, b: SentenceTreeNode) => S3(OperationType.IMPLIES, List([a, b]), List([]));
const iff = (a: SentenceTreeNode, b: SentenceTreeNode) => S3(OperationType.IFF, List([a, b]), List([]));
const forall = (vars: ScopedId[], body: SentenceTreeNode) => S3(OperationType.FORALL, List([body]), List(vars));
const exists = (vars: ScopedId[], body: SentenceTreeNode) => S3(OperationType.EXISTS, List([body]), List(vars));
const eq = (a: SentenceTreeNode, b: SentenceTreeNode) => S3(OperationType.EQUALS, List([a, b]), List([]));
const fn = (id: ScopedId, ...args: SentenceTreeNode[]) => S3(OperationType.FUNCTIONCALL, List(args), List([id]));
const pred = (id: ScopedId, ...args: SentenceTreeNode[]) => S3(OperationType.PREDICATECALL, List(args), List([id]));
const varr = (id: ScopedId) => S3(OperationType.VARIABLE_INSTANCE, List(), List([id]));

function buildGroupTheory(): AxiomSet {
    const G_id = n2SI(0, 0);
    const e_id = n2SI(0, 1);
    const dot_id = n2SI(0, 2);
    const x_id = n2SI(1, 0);
    const y_id = n2SI(1, 1);
    const z_id = n2SI(1, 2);

    let truthBag = new TruthBag();
    truthBag = truthBag.add_predicate(G_id, 'G', 1, false);
    truthBag = truthBag.add_function(e_id, 'e', 0, false);
    truthBag = truthBag.add_function(dot_id, '·', 2, true);

    const x = varr(x_id);
    const y = varr(y_id);
    const z = varr(z_id);
    const e = fn(e_id);
    const G = (t: SentenceTreeNode) => pred(G_id, t);
    const mul = (a: SentenceTreeNode, b: SentenceTreeNode) => fn(dot_id, a, b);

    const axioms: Axiom[] = [
        { tree: implies(and(G(x), G(y)), G(mul(x, y))), note: 'closure' },
        { tree: forall([x_id, y_id, z_id], eq(mul(mul(x, y), z), mul(x, mul(y, z)))), note: 'associativity' },
        { tree: forall([x_id], and(eq(mul(x, e), x), eq(mul(e, x), x))), note: 'identity' },
        { tree: forall([x_id], implies(G(x), exists([y_id], and(G(y), eq(mul(x, y), e))))), note: 'inverses' },
        { tree: not(forall([x_id], eq(x, e))), note: 'nontrivial' },
    ];
    for (const a of axioms) {
        truthBag = truthBag.add_sentence(a.tree, a.note);
    }
    return { truthBag, axioms };
}

function buildSocrates(): AxiomSet {
    const MAN_id = n2SI(0, 0);
    const MORTAL_id = n2SI(0, 1);
    const GOD_id = n2SI(0, 2);
    const socrates_id = n2SI(0, 3);
    const x_id = n2SI(1, 0);

    let truthBag = new TruthBag();
    truthBag = truthBag.add_predicate(MAN_id, 'MAN', 1, false);
    truthBag = truthBag.add_predicate(MORTAL_id, 'MORTAL', 1, false);
    truthBag = truthBag.add_predicate(GOD_id, 'GOD', 1, false);
    truthBag = truthBag.add_function(socrates_id, 'socrates', 0, false);

    const x = varr(x_id);
    const socrates = fn(socrates_id);

    const axioms: Axiom[] = [
        { tree: forall([x_id], implies(pred(MAN_id, x), pred(MORTAL_id, x))), note: 'all men are mortal' },
        { tree: pred(MAN_id, socrates), note: 'socrates is a man' },
        { tree: forall([x_id], implies(pred(GOD_id, x), not(pred(MORTAL_id, x)))), note: 'gods are immortal' },
        { tree: not(exists([x_id], and(pred(GOD_id, x), pred(MAN_id, x)))), note: 'no god is a man' },
        { tree: not(exists([x_id], not(pred(MORTAL_id, x)))), note: 'nothing escapes death' },
    ];
    for (const a of axioms) {
        truthBag = truthBag.add_sentence(a.tree, a.note);
    }
    return { truthBag, axioms };
}

function buildInterlock(): AxiomSet {
    const RUN_id = n2SI(0, 0);
    const STOP_id = n2SI(0, 1);
    const GUARD_id = n2SI(0, 2);
    const ALARM_id = n2SI(0, 3);
    const FAULT_id = n2SI(0, 4);
    const A_OK_id = n2SI(0, 5);
    const B_OK_id = n2SI(0, 6);

    let truthBag = new TruthBag();
    truthBag = truthBag.add_predicate(RUN_id, 'RUN', 0, false);
    truthBag = truthBag.add_predicate(STOP_id, 'STOP', 0, false);
    truthBag = truthBag.add_predicate(GUARD_id, 'GUARD', 0, false);
    truthBag = truthBag.add_predicate(ALARM_id, 'ALARM', 0, false);
    truthBag = truthBag.add_predicate(FAULT_id, 'FAULT', 0, false);
    truthBag = truthBag.add_predicate(A_OK_id, 'A_OK', 0, false);
    truthBag = truthBag.add_predicate(B_OK_id, 'B_OK', 0, false);

    const RUN = pred(RUN_id);
    const STOP = pred(STOP_id);
    const GUARD = pred(GUARD_id);
    const ALARM = pred(ALARM_id);
    const FAULT = pred(FAULT_id);
    const A_OK = pred(A_OK_id);
    const B_OK = pred(B_OK_id);

    const axioms: Axiom[] = [
        { tree: implies(RUN, GUARD), note: 'guard required' },
        { tree: iff(ALARM, not(GUARD)), note: 'alarm signal' },
        { tree: iff(FAULT, not(and(A_OK, B_OK))), note: 'sensor fault' },
        { tree: not(and(RUN, STOP)), note: 'mutual exclusion' },
    ];
    for (const a of axioms) {
        truthBag = truthBag.add_sentence(a.tree, a.note);
    }
    return { truthBag, axioms };
}

export const EXAMPLES: ExampleDef[] = [
    {
        name: 'Peano arithmetic',
        hint: 'The classic axioms of the natural numbers. Watch the De Morgan demo row: ¬∃ flips into ∀ while its ∧ reflects into ∨.',
        build: buildPeanoAxioms,
    },
    {
        name: 'Group theory',
        hint: 'Closure, associativity, identity, inverses. The "nontrivial" axiom ¬∀x.x=e flips its quantifier into ∃x.¬(x=e).',
        build: buildGroupTheory,
    },
    {
        name: 'Socrates & the gods',
        hint: 'Aristotle with a twist: "no god is a man" double-flips (∃→∀, ∧→∨), and "nothing escapes death" cancels a hidden ¬¬ into ∀x.MORTAL(x).',
        build: buildSocrates,
    },
    {
        name: 'Safety interlock',
        hint: 'Propositional machine-safety rules. The biconditionals mint genuine ¬¬ pairs — the only example where the ¬¬ cancel step has real work to do.',
        build: buildInterlock,
    },
];
