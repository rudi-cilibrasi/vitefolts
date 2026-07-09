import { List } from 'immutable';
import { exists, fn, pred, varr } from "./notation/builders.ts";
import { OperationType } from "./notation/operation-type.ts";
import { n2SI, ScopedId } from "./notation/scope.ts";
import { S3, SentenceTreeNode } from './notation/sentence-tree-node.ts';
import { TruthBag } from "./notation/truth-bag.ts";

export interface Axiom {
    tree: SentenceTreeNode;
    note: string;
}

export interface Conjecture {
    tree: SentenceTreeNode;
    remark?: string;
}

export interface AxiomSet {
    truthBag: TruthBag;
    axioms: Axiom[];
    conjectures: Conjecture[];
}

const nat_id = n2SI(0, 0);
const zero_id = n2SI(0, 1);
const succ = n2SI(0, 2);
const PLUS = n2SI(0, 4);

const x_id = n2SI(1, 0);
const y_id = n2SI(1, 1);
const z_id = n2SI(1, 2);

export function buildPeanoAxioms(): AxiomSet {
    const succ_zero = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>().push(S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>(), List<ScopedId>().push(zero_id))), List<ScopedId>().push(succ));

    let truthBag = new TruthBag();
    truthBag = truthBag.add_predicate(nat_id, "NAT", 1, false);
    truthBag = truthBag.add_function(zero_id, "0", 0, false);
    truthBag = truthBag.add_function(succ, "succ", 1, false);
    truthBag = truthBag.add_function(PLUS, "+", 2, true);
    truthBag = truthBag.add_definition("1", succ_zero);

    const x = S3(OperationType.VARIABLE_INSTANCE, List(), List([x_id]));
    const y = S3(OperationType.VARIABLE_INSTANCE, List(), List([y_id]));
    const z = S3(OperationType.VARIABLE_INSTANCE, List(), List([z_id]));

    const axioms: Axiom[] = [];
    const addAxiom = (tree: SentenceTreeNode, note: string) => {
        axioms.push({ tree, note });
        truthBag = truthBag.add_sentence(tree, note.length > 0 ? note : undefined);
    };

    // Peano 1: 0 is a natural number
    const zero = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>(), List([zero_id]));
    const zero_is_a_nat = S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(zero), List([nat_id]));
    addAxiom(zero_is_a_nat, "zero");

    const x_eq_x = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(x).push(x), List([]));
    const x_eq_y = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(x).push(y), List([]));
    const y_eq_x = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(y).push(x), List([]));
    const y_eq_z = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(y).push(z), List([]));
    const x_eq_z = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(x).push(z), List([]));

    const nat_x = S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(x), List([nat_id]));
    const nat_y = S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(y), List([nat_id]));
    const nat_z = S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(z), List([nat_id]));

    // Peano 2: for all x in nat, x = x
    const nat_x_implies_x_eq_x = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(nat_x).push(x_eq_x), List([]));
    const forall_x__nat_x_implies_x_eq_x = S3(OperationType.FORALL, List([nat_x_implies_x_eq_x]), List([x_id]));
    addAxiom(forall_x__nat_x_implies_x_eq_x, "reflection");

    // Peano 3: symmetry of equality for natural numbers
    const nat_x_and_nat_y = S3(OperationType.AND, List<SentenceTreeNode>().push(nat_x).push(nat_y), List([]));
    const x_eq_y_iff_y_eq_x = S3(OperationType.IFF, List<SentenceTreeNode>().push(x_eq_y).push(y_eq_x), List([]));
    const equals_symmetry_nats = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(nat_x_and_nat_y).push(x_eq_y_iff_y_eq_x), List([]));
    addAxiom(equals_symmetry_nats, "symmetry");

    // Peano 4: transitivity of equality for natural numbers
    const nat_x_and_nat_y_and_nat_z = S3(OperationType.AND, List<SentenceTreeNode>().push(nat_x).push(nat_y).push(nat_z), List([]));
    const x_eq_y_and_y_eq_z = S3(OperationType.AND, List<SentenceTreeNode>().push(x_eq_y).push(y_eq_z), List([]));
    const x_eq_y_and_y_eq_z_implies_x_eq_z = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(x_eq_y_and_y_eq_z).push(x_eq_z), List([]));
    const nat_transitivity = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(nat_x_and_nat_y_and_nat_z).push(x_eq_y_and_y_eq_z_implies_x_eq_z), List([]));
    addAxiom(nat_transitivity, "transitivity");

    // Peano 5: closure of equality for natural numbers
    const nat_x_and_x_eq_y = S3(OperationType.AND, List<SentenceTreeNode>().push(nat_x).push(x_eq_y), List([]));
    const nat_x_and_x_eq_y_implies_nat_y = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(nat_x_and_x_eq_y).push(nat_y), List([]));
    addAxiom(nat_x_and_x_eq_y_implies_nat_y, "closure");

    // Peano 6: for all natural number x, succ x is nat
    const succ_x = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>().push(x), List([succ]));
    const nat_succ_x = S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(succ_x), List([nat_id]));
    const nat_x_implies_nat_succ_x = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(nat_x).push(nat_succ_x), List([]));
    addAxiom(nat_x_implies_nat_succ_x, "closure");

    // Peano 7: succ is an injection
    const succ_y = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>().push(y), List([succ]));
    const succ_x_eq_succ_y = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(succ_x).push(succ_y), List([]));
    const succ_x_eq_succ_y_implies_x_eq_y = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(succ_x_eq_succ_y).push(x_eq_y), List([]));
    addAxiom(succ_x_eq_succ_y_implies_x_eq_y, "injection");

    // Peano 8: no natural number has 0 as its successor
    const succ_x_eq_zero = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(succ_x).push(zero), List([]));
    const not_eq_succ_x_zero = S3(OperationType.NOT, List<SentenceTreeNode>().push(succ_x_eq_zero), List([]));
    const forall_x_not_eq_succ_x_zero = S3(OperationType.FORALL, List([not_eq_succ_x_zero]), List([x_id]));
    addAxiom(forall_x_not_eq_succ_x_zero, "no predecessor");

    // Peano 8, existential form: there is no nat whose successor is 0.
    // Pushing the ¬ inward flips ∃ into ∀ and reflects the ∧ into ∨ —
    // the showcase sentence for the De Morgan reflection animation.
    const nat_x_and_succ_x_eq_zero = S3(OperationType.AND, List<SentenceTreeNode>().push(nat_x).push(succ_x_eq_zero), List([]));
    const exists_bad_x = S3(OperationType.EXISTS, List([nat_x_and_succ_x_eq_zero]), List([x_id]));
    const no_bad_x = S3(OperationType.NOT, List<SentenceTreeNode>().push(exists_bad_x), List([]));
    addAxiom(no_bad_x, "De Morgan demo");

    // x + 0 = x
    const x_plus_zero = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>().push(x).push(zero), List([PLUS]));
    const x_plus_zero_eq_x = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(x_plus_zero).push(x), List([]));
    const forall_x__x_plus_zero_eq_x = S3(OperationType.FORALL, List([x_plus_zero_eq_x]), List([x_id]));
    addAxiom(forall_x__x_plus_zero_eq_x, "additive identity");

    const conjectures: Conjecture[] = [
        { tree: exists([x_id], pred(nat_id, fn(succ, varr(x_id)))) },
        { tree: pred(nat_id, fn(PLUS, zero, zero)), remark: 'needs paramodulation' },
        { tree: pred(nat_id, succ_zero), remark: '1 is defined as succ(0)' },
    ];

    return { truthBag, axioms, conjectures };
}
