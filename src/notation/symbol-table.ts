import { List, Map } from 'immutable'
import { SymbolSignature, SymbolSignatureArityMask, SymbolSignatureFunctionMask, SymbolSignatureInfixMask, SymbolSignaturePredicateMask, SymbolSignaturePrefixMask, SymbolSignatureVariableMask } from './signature'
import { makeScopedId, ScopedId, n2SI } from './scope'
import { SymbolTableEntry } from './symbol-table-entry'
import { SymbolType } from './symbol-type'
import { SentenceTreeNode } from './sentence-tree-node'

export type SymbolTableForward = Map<ScopedId, SymbolSignature>;
export type SymbolTableReverse = Map<SymbolSignature, ScopedId>;
export type DisplayNameForward = Map<ScopedId, string>;

export class SymbolTable {
    symbols: SymbolTableForward = Map();
    names: DisplayNameForward = Map();
    definitionsForward: Map<string, SentenceTreeNode> = Map();
    definitionsReverse: Map<SentenceTreeNode, string> = Map();
    annotations: Map<SentenceTreeNode, string> = Map();
    constructor() { }
    all_entries(): List<SymbolTableEntry> {
        let result = List<SymbolTableEntry>();
        for (const [key, _] of this.symbols) {
            const ste = this.find_by_id(key)!;
            result = result.push(ste);
        }
        return result.sort();
    }
    find_by_name(name: string): SymbolTableEntry | undefined {
        for (const [key, value] of this.names) {
            if (value === name) {
                return this.find_by_id(key);
            }
        }
    }
    find_definition(sentence_tree_node: SentenceTreeNode): string | undefined {
        return this.definitionsReverse.get(sentence_tree_node);
    }
    find_by_id(id: ScopedId): SymbolTableEntry | undefined {
        const sig = this.symbols.get(id)!;
        const arity = sig & SymbolSignatureArityMask;
        let stype: SymbolType = 0 as SymbolType;
        if (sig & SymbolSignatureFunctionMask) {
            stype = SymbolType.FUNCTION;
        } else if (sig & SymbolSignaturePredicateMask) {
            stype = SymbolType.PREDICATE;
        } else if (sig & SymbolSignatureVariableMask) {
            stype = SymbolType.VARIABLE;
        }
        const name = this.names.get(id);
        const result = new SymbolTableEntry(id, name!, stype, arity, sig & SymbolSignatureInfixMask ? true : false);

        return result;
    }
    add_variable(id: ScopedId, name: string): SymbolTable {
        const op = SymbolSignatureVariableMask
        const arity = 0;
        const sig = op | arity;
        if (name.length === 0) {
            throw new Error(`Cannot use empty string as a name`);
        }
        if (this.symbols.has(id)) {
            throw new Error(`Symbol ${id} already exists`);
        }
        const st = new SymbolTable();
        st.names = this.names.set(id, name);
        st.symbols = this.symbols.set(id, sig);
        st.definitionsForward = this.definitionsForward
        st.definitionsReverse = this.definitionsReverse
        return st;
    }
    add_predicate(id: ScopedId, name: string, arity: number, is_infix: boolean): SymbolTable {
        const op = SymbolSignaturePredicateMask;
        const sig = op | arity | (is_infix ? SymbolSignatureInfixMask : SymbolSignaturePrefixMask);
        if (name.length === 0) {
            throw new Error(`Cannot use empty string as a name`);
        }
        if (arity < 0) {
            throw new Error(`Arity must be non-negative`);
        }
        if (this.symbols.has(id)) {
            throw new Error(`Symbol ${id} already exists`);
        }
        const st = new SymbolTable();
        st.names = this.names.set(id, name);
        st.symbols = this.symbols.set(id, sig);
        st.definitionsForward = this.definitionsForward
        st.definitionsReverse = this.definitionsReverse
        return st;
    }
    add_function(id: ScopedId, name: string, arity: number, is_infix: boolean): SymbolTable {
        const op = SymbolSignatureFunctionMask;
        const sig = op | arity | (is_infix ? SymbolSignatureInfixMask : SymbolSignaturePrefixMask);
        if (name.length === 0) {
            throw new Error(`Cannot use empty string as a name`);
        }
        if (arity < 0) {
            throw new Error(`Arity must be non-negative`);
        }
        if (this.symbols.has(id)) {
            throw new Error(`Symbol ${id} already exists`);
        }
        const st = new SymbolTable();
        st.names = this.names.set(id, name);
        st.symbols = this.symbols.set(id, sig);
        st.definitionsForward = this.definitionsForward
        st.definitionsReverse = this.definitionsReverse
        return st;
    }
    add_definition(name: string, sentence: SentenceTreeNode): SymbolTable {
        const st = new SymbolTable();
        st.names = this.names
        st.symbols = this.symbols
        st.definitionsForward = this.definitionsForward.set(name, sentence)
        st.definitionsReverse = this.definitionsReverse.set(sentence, name)
        return st;
    }
    get_annotation(sentence: SentenceTreeNode): string | undefined {
        return this.annotations.get(sentence)
    }
    add_annotation(annotation: string, sentence: SentenceTreeNode): SymbolTable {
        const st = new SymbolTable();
        st.names = this.names
        st.symbols = this.symbols
        st.annotations = this.annotations.set(sentence, annotation)
        console.log("Added annotation for sentence ", annotation)
        return st;
    }
}