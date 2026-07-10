import { and, eq, exists, fn, forall, iff, implies, not, or, pred, varr } from './notation/builders.ts';
import { n2SI } from './notation/scope.ts';
import { SentenceTreeNode } from './notation/sentence-tree-node.ts';
import { TruthBag } from './notation/truth-bag.ts';
import { Axiom, AxiomSet, Conjecture, buildPeanoAxioms } from './axioms.ts';

export interface ExampleDef {
    name: string;
    hint: string;
    build: () => AxiomSet;
}

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
    const conjectures: Conjecture[] = [
        { tree: eq(mul(e, mul(e, e)), e), remark: 'needs paramodulation' },
        { tree: exists([y_id], eq(mul(e, y), e)) },
    ];
    for (const a of axioms) {
        truthBag = truthBag.add_sentence(a.tree, a.note);
    }
    return { truthBag, axioms, conjectures };
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
    const conjectures: Conjecture[] = [
        { tree: pred(MORTAL_id, socrates) },
        { tree: not(pred(GOD_id, socrates)) },
        { tree: pred(GOD_id, socrates), remark: 'not entailed — watch the search fail' },
    ];
    for (const a of axioms) {
        truthBag = truthBag.add_sentence(a.tree, a.note);
    }
    return { truthBag, axioms, conjectures };
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
    const conjectures: Conjecture[] = [
        { tree: implies(RUN, not(ALARM)) },
        { tree: or(A_OK, FAULT) },
    ];
    for (const a of axioms) {
        truthBag = truthBag.add_sentence(a.tree, a.note);
    }
    return { truthBag, axioms, conjectures };
}

function buildRiverCrossing(): AxiomSet {
    const REACH_id = n2SI(0, 0);
    const L_id = n2SI(0, 1);
    const R_id = n2SI(0, 2);

    let truthBag = new TruthBag();
    truthBag = truthBag.add_predicate(REACH_id, 'REACH', 4, false);
    truthBag = truthBag.add_function(L_id, 'L', 0, false);
    truthBag = truthBag.add_function(R_id, 'R', 0, false);

    const L = fn(L_id);
    const R = fn(R_id);
    // REACH(farmer, wolf, goat, cabbage) — which bank each is on.
    const at = (f: SentenceTreeNode, w: SentenceTreeNode, g: SentenceTreeNode, c: SentenceTreeNode) =>
        pred(REACH_id, f, w, g, c);

    // Only crossings between SAFE states are axioms: the goat is never left
    // with the wolf or the cabbage without the farmer.
    const axioms: Axiom[] = [
        { tree: at(L, L, L, L), note: 'start' },
        { tree: implies(at(L, L, L, L), at(R, L, R, L)), note: 'take goat →' },
        { tree: implies(at(R, L, R, L), at(L, L, R, L)), note: '← row back' },
        { tree: implies(at(L, L, R, L), at(R, R, R, L)), note: 'take wolf →' },
        { tree: implies(at(R, R, R, L), at(L, R, L, L)), note: '← bring goat back' },
        { tree: implies(at(L, R, L, L), at(R, R, L, R)), note: 'take cabbage →' },
        { tree: implies(at(R, R, L, R), at(L, R, L, R)), note: '← row back' },
        { tree: implies(at(L, R, L, R), at(R, R, R, R)), note: 'take goat →' },
        { tree: implies(at(L, L, R, L), at(R, L, R, R)), note: 'or — take cabbage →' },
        { tree: implies(at(R, L, R, R), at(L, L, L, R)), note: '← bring goat back' },
        { tree: implies(at(L, L, L, R), at(R, R, L, R)), note: 'take wolf →' },
    ];
    const conjectures: Conjecture[] = [
        { tree: at(R, R, R, R), remark: 'the 8-step proof is the ferry plan' },
        { tree: at(L, R, L, R), remark: 'wolf and cabbage across, goat home' },
        { tree: at(R, L, L, R), remark: 'wolf would eat the goat — unreachable' },
    ];
    for (const a of axioms) {
        truthBag = truthBag.add_sentence(a.tree, a.note);
    }
    return { truthBag, axioms, conjectures };
}

function buildAncestry(): AxiomSet {
    const PARENT_id = n2SI(0, 0);
    const ANC_id = n2SI(0, 1);
    const x_id = n2SI(1, 0);
    const y_id = n2SI(1, 1);
    const z_id = n2SI(1, 2);

    let truthBag = new TruthBag();
    truthBag = truthBag.add_predicate(PARENT_id, 'PARENT', 2, false);
    truthBag = truthBag.add_predicate(ANC_id, 'ANC', 2, false);

    const x = varr(x_id);
    const y = varr(y_id);
    const z = varr(z_id);
    const PARENT = (a: SentenceTreeNode, b: SentenceTreeNode) => pred(PARENT_id, a, b);
    const ANC = (a: SentenceTreeNode, b: SentenceTreeNode) => pred(ANC_id, a, b);

    const axioms: Axiom[] = [
        // ∀x ∃y. PARENT(y, x) — the ∃y under a ∀x Skolemizes to a genuine
        // unary function σ(x), the one example where a Skolem *function*
        // (not just a constant) appears.
        { tree: forall([x_id], exists([y_id], PARENT(y, x))), note: 'everyone has a parent' },
        { tree: forall([x_id, y_id], implies(PARENT(x, y), ANC(x, y))), note: 'a parent is an ancestor' },
        { tree: forall([x_id, y_id, z_id], implies(and(ANC(x, y), ANC(y, z)), ANC(x, z))), note: 'ancestry is transitive' },
    ];
    const conjectures: Conjecture[] = [
        { tree: forall([x_id], exists([z_id], ANC(z, x))), remark: 'everyone has an ancestor — closes on the Skolem parent σ(x)' },
        { tree: exists([x_id], forall([z_id], not(PARENT(z, x)))), remark: 'someone with no parent — not entailed, watch the search fail' },
    ];
    for (const a of axioms) {
        truthBag = truthBag.add_sentence(a.tree, a.note);
    }
    return { truthBag, axioms, conjectures };
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
        name: 'Wolf, goat & cabbage',
        hint: 'The classic river crossing as pure logic: REACH(farmer, wolf, goat, cabbage) says who is on which bank (L or R), and only safe crossings are axioms — the goat is never left with the wolf or the cabbage. Prove REACH(R,R,R,R) and the refutation, read top to bottom, is the farmer\'s ferry plan.',
        build: buildRiverCrossing,
    },
    {
        name: 'Safety interlock',
        hint: 'Propositional machine-safety rules. The biconditionals mint genuine ¬¬ pairs — the only example where the ¬¬ cancel step has real work to do.',
        build: buildInterlock,
    },
    {
        name: 'Ancestry',
        hint: 'Everyone has a parent (∀x∃y), a parent is an ancestor, and ancestry is transitive. The ∃ under the ∀ Skolemizes to a real unary function σ(x) — the only example with a Skolem function rather than a constant. Prove everyone has an ancestor; the proof closes on σ of the negated-conjecture Skolem constant.',
        build: buildAncestry,
    },
];
