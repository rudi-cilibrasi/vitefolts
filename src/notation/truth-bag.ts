import { Set } from 'immutable'
import { SymbolTable } from './symbol-table';
import { SentenceTreeNode } from './sentence-tree-node';
import { ScopedId } from './scope';
import { printEscapedSentenceTree } from './sentence-tree-printer';
import { OperationType } from './operation-type';
import { has_node_type_in_set, inspect_sentence_node_types } from './stn-inspector-types';
export class TruthBag {
    symbol_table: SymbolTable;
    sentences: Set<SentenceTreeNode>;
    constructor() {
        this.symbol_table = new SymbolTable();
        this.sentences = Set();
    }
    contains_node_type(nodeType: OperationType): boolean {
        for (const sentence of this.sentences) {
            const uset = inspect_sentence_node_types(sentence)
            if (has_node_type_in_set(uset, nodeType)) {
                return true;
            }
        }
        return false;
    }
    apply_node_transform(transform: (node: SentenceTreeNode) => SentenceTreeNode): TruthBag {
        const tb = new TruthBag();
        tb.symbol_table = this.symbol_table;
        tb.sentences = this.sentences.map(transform);
        return tb;
    }
    ensure_consistency() {
        if (typeof this.symbol_table !== 'object') {
            throw new Error(`Expected symbol_table to be an object, but got ${typeof this.symbol_table}`);
        }
    }
    add_function(id: ScopedId, name: string, arity: number, is_infix: boolean) {
        const tb = new TruthBag();
        tb.symbol_table = this.symbol_table.add_function(id, name, arity, is_infix);
        tb.sentences = this.sentences;
        return tb;
    }
    add_predicate(id: ScopedId, name: string, arity: number, is_infix: boolean) {
        const tb = new TruthBag();
        tb.symbol_table = this.symbol_table.add_predicate(id, name, arity, is_infix);
        tb.sentences = this.sentences;
        return tb;
    }
    add_sentence(sentence: SentenceTreeNode, annotation?: string) {
        console.log("Annotation is ", annotation)
        if (annotation === undefined) {
            annotation = ''
        }
        const tb = new TruthBag();
        const desc = printEscapedSentenceTree(sentence, this.symbol_table)
        console.log("Adding: ", printEscapedSentenceTree(sentence, this.symbol_table))
        if (desc === '0 =0 ') {
            debugger;
        }
        tb.sentences = this.sentences.add(sentence)
        tb.symbol_table = this.symbol_table
        if (annotation.length > 0) {
            tb.symbol_table = tb.symbol_table.add_annotation(annotation, sentence)
        }
        return tb
    }
    add_definition(name: string, sentence: SentenceTreeNode) {
        const tb = new TruthBag();
        tb.symbol_table = this.symbol_table.add_definition(name, sentence);
        tb.sentences = this.sentences
        return tb;
    }
    walk_sentence_dfs<T>(node: SentenceTreeNode, userData: T, walker: (node: SentenceTreeNode, userData: T) => T): T {
        for (const child of node.children) {
            userData = this.walk_sentence_dfs(child, userData, walker)
        }
        userData = this.walk_sentence_dfs(node, userData, walker)
        return userData
    }
    walk_truthbag_dfs<T>(userData: T, walker: (node: SentenceTreeNode, userData: T) => T): T {
        for (const sentence of this.sentences) {
            userData = this.walk_sentence_dfs(sentence, userData, walker)
        }
        return userData
    }
}