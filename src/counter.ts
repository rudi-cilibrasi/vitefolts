import { doOperation } from "./mathop"
import { OperationType } from "./notation/operation-type.ts";

import { n2SI, ScopedId } from "./notation/scope.ts";
import { S3, SentenceTreeNode } from './notation/sentence-tree-node.ts'
import { List } from 'immutable';
import { TruthBag } from "./notation/truth-bag.ts";
import { printTruthBagHtml } from "./notation/truth-bag-printer.ts";
import { clausal_form_iffs_out, clausal_form_implications_out, clausal_form_limplications_out, clausal_form_remove_double_negations } from "./notation/clause.ts";

const nat_id = n2SI(0, 0)
const zero_id = n2SI(0, 1)
const succ = n2SI(0, 2)
const PLUS = n2SI(0, 4)

const x_id = n2SI(1, 0)
const y_id = n2SI(1, 1)
const z_id = n2SI(1, 2)

const succ_zero = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>().push(S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>(), List<ScopedId>().push(zero_id))), List<ScopedId>().push(succ))
//const one  = S3(OperationType.FUNCTIONCALL, List(). add()

let truth_bag = new TruthBag()
truth_bag = truth_bag.add_predicate(nat_id, "NAT", 1, false)
truth_bag = truth_bag.add_function(zero_id, "0", 0, false)
truth_bag = truth_bag.add_function(succ, "succ", 1, false)
truth_bag = truth_bag.add_function(PLUS, "+", 2, true)
truth_bag = truth_bag.add_definition("1", succ_zero)


const x = S3(OperationType.VARIABLE_INSTANCE, List(), List([x_id]))
const y = S3(OperationType.VARIABLE_INSTANCE, List(), List([y_id]))
const z = S3(OperationType.VARIABLE_INSTANCE, List(), List([z_id]))


// Peano 1: 0 is a natural number
const zero = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>(), List([zero_id]))
const zero_is_a_nat = S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(zero), List([nat_id]))
truth_bag = truth_bag.add_sentence(zero_is_a_nat)

const x_eq_x = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(x).push(x), List([]))

const x_eq_y = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(x).push(y), List([]))
const y_eq_x = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(y).push(x), List([]))
const y_eq_z = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(y).push(z), List([]))
const x_eq_z = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(x).push(z), List([]))

// Peano 2: for all x in nat, x = x
const nat_x_implies_x_eq_x = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(x), List([nat_id]))).push(x_eq_x), List([]))
const forall_x__nat_x_implies_x_eq_x = S3(OperationType.FORALL, List([nat_x_implies_x_eq_x]), List([x_id]))
truth_bag = truth_bag.add_sentence(forall_x__nat_x_implies_x_eq_x, "reflection")

// Peano 3: symmetry of equality for natural numbers
const nat_x_and_nat_y = S3(OperationType.AND, List<SentenceTreeNode>().push(S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(x), List([nat_id]))).push(S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(y), List([nat_id]))), List([]))
const x_eq_y_iff_y_eq_x = S3(OperationType.IFF, List<SentenceTreeNode>().push(x_eq_y).push(y_eq_x), List([]))
const equals_symmetry_nats = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(nat_x_and_nat_y).push(x_eq_y_iff_y_eq_x), List([]))
truth_bag = truth_bag.add_sentence(equals_symmetry_nats, "symmetry")

// Peano 4: transitivity of equality for natural numbers
const nat_x_and_nat_y_and_nat_z = S3(OperationType.AND, List<SentenceTreeNode>().push(S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(x), List([nat_id]))).push(S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(y), List([nat_id]))).push(S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(z), List([nat_id]))), List([]))
const x_eq_y_and_y_eq_z_implies_x_eq_z = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(S3(OperationType.AND, List<SentenceTreeNode>().push(x_eq_y).push(y_eq_z), List([]))).push(x_eq_z), List([]))
const nat_transitivity = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(nat_x_and_nat_y_and_nat_z).push(x_eq_y_and_y_eq_z_implies_x_eq_z), List([]))
truth_bag = truth_bag.add_sentence(nat_transitivity, "transitivity")

// Peano 5: closure of equality for natural numbers
const nat_x = S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(x), List([nat_id]))
const nat_y = S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(y), List([nat_id]))
const nat_x_and_x_eq_y_implies_nat_y = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(S3(OperationType.AND, List<SentenceTreeNode>().push(nat_x).push(x_eq_y), List([]))).push(nat_y), List([]))
truth_bag = truth_bag.add_sentence(nat_x_and_x_eq_y_implies_nat_y, "closure")

// Peano 6: for all natural number x, succ x is nat 
const succ_x = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>().push(x), List([succ]))
const nat_x_implies_nat_succ_x = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(nat_x).push(S3(OperationType.PREDICATECALL, List<SentenceTreeNode>().push(succ_x), List([nat_id]))), List([]))
truth_bag = truth_bag.add_sentence(nat_x_implies_nat_succ_x, "closure")

// Peano 7: For all natural numbers x and y, if succ x = succ y, then x = y. That is, succ is an injection.
const succ_x_eq_succ_y = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(succ_x).push(S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>().push(y), List([succ]))), List([]))
const succ_x_eq_succ_y_implies_x_eq_y = S3(OperationType.IMPLIES, List<SentenceTreeNode>().push(succ_x_eq_succ_y).push(x_eq_y), List([]))
truth_bag = truth_bag.add_sentence(succ_x_eq_succ_y_implies_x_eq_y)

// Peano 8: 
// For every natural number x, succ x = 0 is false. That is, there is no natural number whose successor is 0.

const not_eq_succ_x_zero = S3(OperationType.NOT, List<SentenceTreeNode>().push(S3(OperationType.EQUALS, List<SentenceTreeNode>().push(succ_x).push(zero), List([]))), List([]))
const forall_x_not_eq_succ_x_zero = S3(OperationType.FORALL, List([not_eq_succ_x_zero]), List([x_id]))
truth_bag = truth_bag.add_sentence(forall_x_not_eq_succ_x_zero)

const x_plus_zero = S3(OperationType.FUNCTIONCALL, List<SentenceTreeNode>().push(x).push(zero), List([PLUS]))
const x_plus_zero_eq_x = S3(OperationType.EQUALS, List<SentenceTreeNode>().push(x_plus_zero).push(x), List([]))
const forall_x__x_plus_zero_eq_x = S3(OperationType.FORALL, List([x_plus_zero_eq_x]), List([x_id]))
truth_bag = truth_bag.add_sentence(forall_x__x_plus_zero_eq_x)

function doTruthBagTests() {
  console.log("truth_bag contains forall: \t", truth_bag.contains_node_type(OperationType.FORALL))
  console.log("truth_bag contains exists: \t", truth_bag.contains_node_type(OperationType.EXISTS))
  console.log("truth_bag contains imp: \t", truth_bag.contains_node_type(OperationType.IMPLIES))
  console.log("truth_bag contains limp: \t", truth_bag.contains_node_type(OperationType.LIMP))
  console.log("truth_bag contains iff: \t", truth_bag.contains_node_type(OperationType.IFF))
  console.log("truth_bag contains not: \t", truth_bag.contains_node_type(OperationType.NOT))
  console.log("truth_bag contains and: \t", truth_bag.contains_node_type(OperationType.AND))
  console.log("truth_bag contains or: \t", truth_bag.contains_node_type(OperationType.OR))
}

doTruthBagTests()
export function setupCounter(element: HTMLButtonElement, div: HTMLDivElement) {
  let counter = BigInt(1)
  const setCounter = (count: bigint) => {
    counter = count
    truth_bag.ensure_consistency();
    let stringCounter = count.toString()
    if (count > 4) {
      truth_bag = truth_bag.apply_node_transform(clausal_form_implications_out)
      truth_bag = truth_bag.apply_node_transform(clausal_form_limplications_out)
      truth_bag = truth_bag.apply_node_transform(clausal_form_iffs_out)
      truth_bag = truth_bag.apply_node_transform(clausal_form_remove_double_negations)
      doTruthBagTests()
    }
    element.innerHTML = `count is ${stringCounter}`
    div.innerHTML = `count is ${stringCounter}`
    div.innerHTML += `<br/>${printTruthBagHtml(truth_bag)}`
  }
  element.addEventListener('click', () => setCounter(doOperation(counter)))
  setCounter(BigInt(1))
}
