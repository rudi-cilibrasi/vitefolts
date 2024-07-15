import { Set } from 'immutable'
import { SymbolTable } from './symbol-table';
import { SentenceTreeNode } from './sentence-tree-node';
import { ScopedId } from './scope';
import { printEscapedSentenceTree } from './sentence-tree-printer';
export class TruthBag {
    symbol_table: SymbolTable;
    sentences: Set<SentenceTreeNode>;
    constructor() {
        this.symbol_table = new SymbolTable();
        this.sentences = Set();
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
    add_sentence(sentence: SentenceTreeNode) {
        const tb = new TruthBag();
        const desc = printEscapedSentenceTree(sentence, this.symbol_table)
        console.log("Adding: ", printEscapedSentenceTree(sentence, this.symbol_table))
        if (desc === '0 =0 ') {
            debugger;
        }
        tb.sentences = this.sentences.add(sentence)
        tb.symbol_table = this.symbol_table
        return tb
    }
    add_definition(name: string, sentence: SentenceTreeNode) {
        const tb = new TruthBag();
        tb.symbol_table = this.symbol_table.add_definition(name, sentence);
        tb.sentences = this.sentences
        return tb;
    }
}