import { OperationType } from "./operation-type";
import { getName, getScope, ScopedId } from "./scope";
import { ScopeId } from "./scope";
import { SentenceTreeNode } from "./sentence-tree-node";
import { List } from 'immutable';
import { SymbolTable } from "./symbol-table";
import { SymbolSignatureInfixMask } from "./signature";

function printEscapedSentenceTreeNode(sentence_tree: SentenceTreeNode, indent: number, symbol_table: SymbolTable, getDisplayName: ((a: ScopedId, op: OperationType, symbol_table: SymbolTable) => string)): string {
    const definite = symbol_table.find_definition(sentence_tree);
    if (definite) {
        return definite;
    }
    const operation: OperationType = sentence_tree.operation;
    const children: List<SentenceTreeNode> = sentence_tree.children;
    const symbols: List<ScopedId> = sentence_tree.symbols;
    const showParen = (children.size > 0);
    const leftParen = showParen ? "(" : "";
    const rightParen = showParen ? ")" : "";
    if (typeof symbol_table !== 'object') {
        throw new Error(`Expected symbol_table to be an object, but got ${typeof symbol_table}`);
    }
    switch (operation) {
        case OperationType.VOID:
            return "\\void";
        case OperationType.EQUALS:
            return `${children.map((child) => printEscapedSentenceTreeNode(child, indent + 1, symbol_table, getDisplayName)).join("=")}`;
        case OperationType.AND:
            return `(\\and ${children.map((child) => printEscapedSentenceTreeNode(child, indent + 1, symbol_table, getDisplayName)).join(" ")})`;
        case OperationType.OR:
            return `(\\or ${children.map((child) => printEscapedSentenceTreeNode(child, indent + 1, symbol_table, getDisplayName)).join(" ")})`;
        case OperationType.NOT:
            return `(\\not ${printEscapedSentenceTreeNode(children.get(0)!, indent, symbol_table, getDisplayName)})`;
        case OperationType.IMPLIES:
            return `(\\implies ${printEscapedSentenceTreeNode(children.get(0)!, indent, symbol_table, getDisplayName)} ${printEscapedSentenceTreeNode(children.get(1)!, indent, symbol_table, getDisplayName)})`;
        case OperationType.IFF:
            return `(\\iff ${printEscapedSentenceTreeNode(children.get(0)!, indent, symbol_table, getDisplayName)} ${printEscapedSentenceTreeNode(children.get(1)!, indent, symbol_table, getDisplayName)})`;
        case OperationType.LIMP:
            return `(\\limp ${printEscapedSentenceTreeNode(children.get(0)!, indent, symbol_table, getDisplayName)} ${printEscapedSentenceTreeNode(children.get(1)!, indent, symbol_table, getDisplayName)})`;
        case OperationType.FORALL:
            return `(\\forall (${symbols.map((symbol: ScopedId) => getDisplayName(symbol, OperationType.FORALL, symbol_table)).join(" ")})${printEscapedSentenceTreeNode(children.get(0)!, indent + 1, symbol_table, getDisplayName)})`;
        case OperationType.EXISTS:
            return `(\\exists (${symbols.map((symbol: ScopedId) => getDisplayName(symbol, OperationType.EXISTS, symbol_table)).join(" ")})${printEscapedSentenceTreeNode(children.get(0)!, indent + 1, symbol_table, getDisplayName)})`;
        case OperationType.FUNCTIONCALL:
            const sym_id = symbols.get(0)!
            const sym_entry = symbol_table.find_by_id(symbols.get(0)!)!
            if (sym_entry.is_infix) {
                return children.map((child) => printEscapedSentenceTreeNode(child, indent, symbol_table, getDisplayName)).join(sym_entry.name)
            }
            return `${leftParen}${getDisplayName(symbols.get(0)!, OperationType.FUNCTIONCALL, symbol_table)}${children.map((child) => printEscapedSentenceTreeNode(child, indent, symbol_table, getDisplayName)).join(" ")}${rightParen}`;
        case OperationType.PREDICATECALL:
            const symbol_entry = symbol_table.find_by_id(symbols.get(0)!)!
            if (symbol_entry.is_infix) {
                const chimap = children.map((child) => printEscapedSentenceTreeNode(child, indent, symbol_table, getDisplayName))
                const joinsym = symbol_entry.name
                const result = chimap.join(joinsym)
                return result;
            }
            return `(${getDisplayName(symbols.get(0)!, OperationType.PREDICATECALL, symbol_table)} ${children.map((child) => printEscapedSentenceTreeNode(child, indent, symbol_table, getDisplayName)).join(" ")})`;
        case OperationType.VARIABLE_INSTANCE:
            return `${getDisplayName(symbols.get(0)!, OperationType.VARIABLE_INSTANCE, symbol_table)}`;
        default:
            return "?";
    }
}

function printSentenceTreeNode(sentence_tree: SentenceTreeNode, indent: number, symbol_table: SymbolTable, getDisplayName: ((n: ScopedId, op: OperationType, symbol_table: SymbolTable) => string)): string {
    const definite = symbol_table.find_definition(sentence_tree);
    if (definite) {
        return definite;
    }
    const operation: OperationType = sentence_tree.operation;
    const children: List<SentenceTreeNode> = sentence_tree.children;
    const symbols: List<ScopedId> = sentence_tree.symbols;
    const showParen = (children.size > 0);
    const leftParen = showParen ? "(" : "";
    const rightParen = showParen ? ")" : "";
    if (typeof symbol_table !== 'object') {
        throw new Error(`Expected symbol_table to be an object, but got ${typeof symbol_table}`);
    }
    switch (operation) {
        case OperationType.VOID:
            return "∅"
        case OperationType.EQUALS:
            return children.map((child) => printSentenceTreeNode(child, indent + 1, symbol_table, getDisplayName)).join('=');
        case OperationType.AND:
            return children.map((child) => printSentenceTreeNode(child, indent + 1, symbol_table, getDisplayName)).join(`${"&nbsp;".repeat(indent)}∧`);
        case OperationType.OR:
            return children.map((child) => printSentenceTreeNode(child, indent + 1, symbol_table, getDisplayName)).join(`${"&nbsp;".repeat(indent)}∨`);
        case OperationType.NOT:
            return `¬${printSentenceTreeNode(children.get(0)!, indent, symbol_table, getDisplayName)}`;
        case OperationType.IMPLIES:
            return `${printSentenceTreeNode(children.get(0)!, indent, symbol_table, getDisplayName)} → ${printSentenceTreeNode(children.get(1)!, indent, symbol_table, getDisplayName)}`;
        case OperationType.IFF:
            return `${printSentenceTreeNode(children.get(0)!, indent, symbol_table, getDisplayName)} ↔ ${printSentenceTreeNode(children.get(1)!, indent, symbol_table, getDisplayName)}`;
        case OperationType.LIMP:
            return `${printSentenceTreeNode(children.get(0)!, indent, symbol_table, getDisplayName)} ← ${printSentenceTreeNode(children.get(1)!, indent, symbol_table, getDisplayName)}`;
        case OperationType.FORALL:
            return `∀${symbols.map((symbol: ScopedId) => getDisplayName(symbol, OperationType.FORALL, symbol_table)).join(",")}.${printSentenceTreeNode(children.get(0)!, indent + 1, symbol_table, getDisplayName)}`;
        case OperationType.EXISTS:
            return `∃${symbols.map((symbol: ScopedId) => getDisplayName(symbol, OperationType.EXISTS, symbol_table)).join(",")}.${printSentenceTreeNode(children.get(0)!, indent + 1, symbol_table, getDisplayName)}`;
        case OperationType.FUNCTIONCALL:
            const sym_entry = symbol_table.find_by_id(symbols.get(0)!)!
            if (sym_entry.is_infix) {
                return children.map((child) => printEscapedSentenceTreeNode(child, indent, symbol_table, getDisplayName)).join(sym_entry.name)
            }
            return `${getDisplayName(symbols.get(0)!, OperationType.FUNCTIONCALL, symbol_table)}${leftParen}${children.map((child) => printSentenceTreeNode(child, indent, symbol_table, getDisplayName)).join(",")}${rightParen}`;
        case OperationType.PREDICATECALL:
            const symbol_entry = symbol_table.find_by_id(symbols.get(0)!)!
            if (symbol_entry.is_infix) {
                return children.map((child) => printEscapedSentenceTreeNode(child, indent, symbol_table, getDisplayName)).join(symbol_entry.name)
            }
            return `${getDisplayName(symbols.get(0)!, OperationType.PREDICATECALL, symbol_table)}${leftParen}${children.map((child) => printSentenceTreeNode(child, indent, symbol_table, getDisplayName)).join(",")}${rightParen}`;
        case OperationType.VARIABLE_INSTANCE:
            return `${getDisplayName(symbols.get(0)!, OperationType.VARIABLE_INSTANCE, symbol_table)}`;
        default:
            return "?";
    }
}

function simpleGetName(symbol: ScopedId, op: OperationType, symbol_table: SymbolTable): string {
    if (typeof symbol_table !== 'object') {
        throw new Error(`Expected symbol_table to be an object, but got ${typeof symbol_table}`);
    }
    if (symbol_table.names.has(symbol)) {
        return symbol_table.names.get(symbol)!;
    }
    const scope_id = getScope(symbol);
    switch (op) {
        case OperationType.FORALL:
        case OperationType.EXISTS:
        case OperationType.FUNCTIONCALL:
        case OperationType.VARIABLE_INSTANCE:
            if (scope_id === 1n) {
                return String.fromCharCode('x'.charCodeAt(0) + Number(getName(symbol)))
            }
            return 'x_' + Number(getName(symbol))
        case OperationType.PREDICATECALL:
        default:
            return String.fromCharCode('P'.charCodeAt(0) + Number(getName(symbol)))
    }
}

export function printSentenceTree(sentence_tree: SentenceTreeNode, symbol_table: SymbolTable): string {
    if (typeof symbol_table !== 'object') {
        throw new Error(`Expected symbol_table to be an object, but got ${typeof symbol_table}`);
    }
    return printSentenceTreeNode(sentence_tree, 0, symbol_table, simpleGetName);
}

export function printEscapedSentenceTree(sentence_tree: SentenceTreeNode, symbol_table: SymbolTable): string {
    if (typeof symbol_table !== 'object') {
        throw new Error(`Expected symbol_table to be an object, but got ${typeof symbol_table}`);
    }
    const desc = printEscapedSentenceTreeNode(sentence_tree, 0, symbol_table, simpleGetName);
    return desc;
}