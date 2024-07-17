import { SentenceTreeNode } from "./sentence-tree-node";

type UsedNodeTypesSetTag = { _used_node_types_set: void };

export function has_node_type_in_set(set: UsedNodeTypesSet, nodeType: number): boolean {
    return (set & (1 << nodeType)) !== 0;
}

export type UsedNodeTypesSet = number & UsedNodeTypesSetTag;
function inspect_sentence_node_types_reduce(node: SentenceTreeNode, num: UsedNodeTypesSet): UsedNodeTypesSet {
    num = (Number(num) | (1 << node.operation)) as UsedNodeTypesSet;
    for (const child of node.children) {
        num = inspect_sentence_node_types_reduce(child, num);
    }
    return num;
}

export function inspect_sentence_node_types(node: SentenceTreeNode): UsedNodeTypesSet {
    return inspect_sentence_node_types_reduce(node, 0 as UsedNodeTypesSet);
}