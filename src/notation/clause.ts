import { List } from "immutable";
import { OperationType } from "./operation-type";
import { S3F, SentenceTreeNode } from "./sentence-tree-node";
import { has_node_type_in_set, inspect_sentence_node_types } from "./stn-inspector-types";

export function clausal_form_negations_in(sentence: SentenceTreeNode): SentenceTreeNode {
    const usedNodeTypes = inspect_sentence_node_types(sentence);
    const has_it = has_node_type_in_set(usedNodeTypes, OperationType.NOT);
    if (!has_it) {
        return sentence;
    }
    if (sentence.operation !== OperationType.NOT) {
        const children = sentence.children.map(clausal_form_negations_in);
        return S3F({ operation: sentence.operation, children, bound_vars: sentence.bound_vars });
    }
    const child = sentence.children.get(0)!;
    const childOp = child!.operation;
    if (childOp == OperationType.EQUALS || childOp == OperationType.PREDICATECALL) {
        return sentence;
    }
    if (childOp !== OperationType.FORALL && childOp !== OperationType.EXISTS && childOp !== OperationType.AND && childOp !== OperationType.OR) {
        console.log("Unexpected operation type in clausal_form_negations_in " + `${OperationType[childOp]}`);
        throw new Error("Unexpected operation type in clausal_form_negations_in " + `${OperationType[childOp]}`);
    }
    console.log("Found negated operation " + OperationType[childOp]);
    if (childOp === OperationType.FORALL || childOp === OperationType.EXISTS) {
        const quantifiedChild = child.children.get(0)!;
        const otherOp = childOp == OperationType.FORALL ? OperationType.EXISTS : OperationType.FORALL;
        const negatedQChild = S3F({ operation: OperationType.NOT, children: List<SentenceTreeNode>().push(quantifiedChild), bound_vars: List() });
        const fixedNegatedQChild = clausal_form_negations_in(negatedQChild);
        const fixedChild = S3F({ operation: otherOp, children: List<SentenceTreeNode>().push(fixedNegatedQChild), bound_vars: child.bound_vars });
        return fixedChild;
    }
    const otherOp = childOp == OperationType.AND ? OperationType.OR : OperationType.AND;
    const joinedChildren = child.children;
    const negatedChildren = joinedChildren.map((c) => S3F({ operation: OperationType.NOT, children: List<SentenceTreeNode>().push(c), bound_vars: List() }));
    const negatedFixedChildren = negatedChildren.map((c) => clausal_form_negations_in(c));
    const fixedJoin = S3F({ operation: otherOp, children: negatedFixedChildren, bound_vars: child.bound_vars });
    return fixedJoin;
}

export function clausal_form_remove_double_negations(sentence: SentenceTreeNode): SentenceTreeNode {
    const usedNodeTypes = inspect_sentence_node_types(sentence);
    const has_it = has_node_type_in_set(usedNodeTypes, OperationType.NOT);
    if (!has_it) {
        return sentence;
    }
    if (sentence.operation === OperationType.NOT) {
        const child = sentence.children.get(0);
        if (child!.operation === OperationType.NOT) {
            const grandchild = child!.children.get(0);
            return clausal_form_remove_double_negations(grandchild!);
        }
    }
    let children = sentence.children.map(clausal_form_remove_double_negations);
    return S3F({ operation: sentence.operation, children, bound_vars: sentence.bound_vars });
}

export function clausal_form_iffs_out(sentence: SentenceTreeNode): SentenceTreeNode {
    const usedNodeTypes = inspect_sentence_node_types(sentence);
    const has_it = has_node_type_in_set(usedNodeTypes, OperationType.IFF);
    if (!has_it) {
        return sentence;
    }
    if (sentence.operation === OperationType.IFF) {
        const left = sentence.children.get(0);
        const right = sentence.children.get(1);
        const left_clausal = clausal_form_iffs_out(left!);
        const right_clausal = clausal_form_iffs_out(right!);
        const not_left = S3F({ operation: OperationType.NOT, children: List<SentenceTreeNode>().push(left_clausal), bound_vars: List() });
        const not_right = S3F({ operation: OperationType.NOT, children: List<SentenceTreeNode>().push(right_clausal), bound_vars: List() });
        return S3F({ operation: OperationType.AND, children: List<SentenceTreeNode>().push(S3F({ operation: OperationType.OR, children: List<SentenceTreeNode>().push(not_left).push(right_clausal), bound_vars: List() })).push(S3F({ operation: OperationType.OR, children: List<SentenceTreeNode>().push(left_clausal).push(not_right), bound_vars: List() })), bound_vars: List() });
    }
    let children = sentence.children.map(clausal_form_iffs_out);
    return S3F({ operation: sentence.operation, children, bound_vars: sentence.bound_vars });
}

export function clausal_form_implications_out(sentence: SentenceTreeNode): SentenceTreeNode {
    const usedNodeTypes = inspect_sentence_node_types(sentence);
    const has_it = has_node_type_in_set(usedNodeTypes, OperationType.IMPLIES);
    if (!has_it) {
        return sentence;
    }
    if (sentence.operation === OperationType.IMPLIES) {
        const left = sentence.children.get(0);
        const right = sentence.children.get(1);
        const not_left = S3F({ operation: OperationType.NOT, children: List<SentenceTreeNode>().push(clausal_form_implications_out(left!)), bound_vars: List() });
        const right_clausal = clausal_form_implications_out(right!);
        return S3F({ operation: OperationType.OR, children: List<SentenceTreeNode>().push(not_left).push(right_clausal), bound_vars: List() });
    }
    let children = sentence.children.map(clausal_form_implications_out);
    return S3F({ operation: sentence.operation, children, bound_vars: sentence.bound_vars });
}
export function clausal_form_limplications_out(sentence: SentenceTreeNode): SentenceTreeNode {
    const usedNodeTypes = inspect_sentence_node_types(sentence);
    const has_it = has_node_type_in_set(usedNodeTypes, OperationType.LIMP);
    if (!has_it) {
        return sentence;
    }
    if (sentence.operation === OperationType.LIMP) {
        const left = sentence.children.get(0);
        const right = sentence.children.get(1);
        const not_right = S3F({ operation: OperationType.NOT, children: List<SentenceTreeNode>().push(clausal_form_limplications_out(right!)), bound_vars: List() });
        const left_clausal = clausal_form_limplications_out(left!);
        return S3F({ operation: OperationType.OR, children: List<SentenceTreeNode>().push(left_clausal).push(not_right), bound_vars: List() });
    }
    let children = sentence.children.map(clausal_form_limplications_out);
    return S3F({ operation: sentence.operation, children, bound_vars: sentence.bound_vars });
}