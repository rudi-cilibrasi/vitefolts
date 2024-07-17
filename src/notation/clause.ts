import { List } from "immutable";
import { OperationType } from "./operation-type";
import { S3F, SentenceTreeNode } from "./sentence-tree-node";
import { has_node_type_in_set, inspect_sentence_node_types } from "./stn-inspector-types";

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