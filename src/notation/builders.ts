import { List } from 'immutable';
import { OperationType } from './operation-type';
import { ScopedId } from './scope';
import { S3, SentenceTreeNode } from './sentence-tree-node';

// Small combinators so axiom sets and conjectures read close to their
// mathematical form.

export const and = (...cs: SentenceTreeNode[]) => S3(OperationType.AND, List(cs), List([]));
export const or = (...cs: SentenceTreeNode[]) => S3(OperationType.OR, List(cs), List([]));
export const not = (c: SentenceTreeNode) => S3(OperationType.NOT, List([c]), List([]));
export const implies = (a: SentenceTreeNode, b: SentenceTreeNode) => S3(OperationType.IMPLIES, List([a, b]), List([]));
export const iff = (a: SentenceTreeNode, b: SentenceTreeNode) => S3(OperationType.IFF, List([a, b]), List([]));
export const forall = (vars: ScopedId[], body: SentenceTreeNode) => S3(OperationType.FORALL, List([body]), List(vars));
export const exists = (vars: ScopedId[], body: SentenceTreeNode) => S3(OperationType.EXISTS, List([body]), List(vars));
export const eq = (a: SentenceTreeNode, b: SentenceTreeNode) => S3(OperationType.EQUALS, List([a, b]), List([]));
export const fn = (id: ScopedId, ...args: SentenceTreeNode[]) => S3(OperationType.FUNCTIONCALL, List(args), List([id]));
export const pred = (id: ScopedId, ...args: SentenceTreeNode[]) => S3(OperationType.PREDICATECALL, List(args), List([id]));
export const varr = (id: ScopedId) => S3(OperationType.VARIABLE_INSTANCE, List(), List([id]));
