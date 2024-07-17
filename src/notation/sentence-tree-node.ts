import { OperationType } from "./operation-type";
import { ScopedId } from "./scope";
import { List, Record } from 'immutable';

export type SentenceTreeNode = Record<{
    operation: OperationType;
    children: List<SentenceTreeNode>;
    bound_vars: List<bigint>;
}> & Readonly<{
    operation: OperationType;
    children: List<SentenceTreeNode>;
    bound_vars: List<bigint>;
}>;

export const SentenceTreeNodeFactory = Record({ operation: OperationType.VOID, children: List<SentenceTreeNode>(), bound_vars: List<ScopedId>() });
export const S3F = SentenceTreeNodeFactory;
export function S3(o: OperationType, c: List<SentenceTreeNode>, s: List<ScopedId>): SentenceTreeNode {
    return S3F({ operation: o, children: c, bound_vars: s });
}
