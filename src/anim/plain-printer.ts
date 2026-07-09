import { List } from "immutable";
import { OperationType } from "../notation/operation-type";
import { getName, getScope, ScopedId } from "../notation/scope";
import { SentenceTreeNode } from "../notation/sentence-tree-node";
import { SymbolTable } from "../notation/symbol-table";

// Plain-unicode printer used by the animation layer. Unlike the HTML printer
// it renders NOT as a leading ¬ so every rendered character is a real glyph
// that can be positioned and animated independently.

function displayName(symbol: ScopedId, op: OperationType, symbol_table: SymbolTable): string {
    if (symbol_table.names.has(symbol)) {
        return symbol_table.names.get(symbol)!;
    }
    const scope_id = getScope(symbol);
    switch (op) {
        case OperationType.FORALL:
        case OperationType.EXISTS:
        case OperationType.FUNCTIONCALL:
        case OperationType.VARIABLE_INSTANCE:
            if (scope_id === 1) {
                return String.fromCharCode('x'.charCodeAt(0) + Number(getName(symbol)));
            }
            return 'x_' + Number(getName(symbol));
        default:
            return String.fromCharCode('P'.charCodeAt(0) + Number(getName(symbol)));
    }
}

function needsParensUnderNot(op: OperationType): boolean {
    return op !== OperationType.PREDICATECALL
        && op !== OperationType.VARIABLE_INSTANCE
        && op !== OperationType.NOT;
}

function printNode(node: SentenceTreeNode, symbol_table: SymbolTable): string {
    const definite = symbol_table.find_definition(node);
    if (definite) {
        return definite;
    }
    const operation: OperationType = node.operation;
    const children: List<SentenceTreeNode> = node.children;
    const bound_vars: List<ScopedId> = node.bound_vars;
    switch (operation) {
        case OperationType.VOID:
            return "∅";
        case OperationType.EQUALS:
            return children.map((c) => printNode(c, symbol_table)).join("=");
        case OperationType.AND:
            return children.map((c) => "[" + printNode(c, symbol_table) + "]").join("∧");
        case OperationType.OR:
            return children.map((c) => "(" + printNode(c, symbol_table) + ")").join("∨");
        case OperationType.NOT: {
            const child = children.get(0)!;
            const body = printNode(child, symbol_table);
            return needsParensUnderNot(child.operation) ? `¬(${body})` : `¬${body}`;
        }
        case OperationType.IMPLIES:
            return `${printNode(children.get(0)!, symbol_table)} → ${printNode(children.get(1)!, symbol_table)}`;
        case OperationType.IFF:
            return `${printNode(children.get(0)!, symbol_table)} ↔ ${printNode(children.get(1)!, symbol_table)}`;
        case OperationType.LIMP:
            return `${printNode(children.get(0)!, symbol_table)} ← ${printNode(children.get(1)!, symbol_table)}`;
        case OperationType.FORALL:
            return `∀${bound_vars.map((s) => displayName(s, OperationType.FORALL, symbol_table)).join(",")}.${printNode(children.get(0)!, symbol_table)}`;
        case OperationType.EXISTS:
            return `∃${bound_vars.map((s) => displayName(s, OperationType.EXISTS, symbol_table)).join(",")}.${printNode(children.get(0)!, symbol_table)}`;
        case OperationType.FUNCTIONCALL: {
            const entry = symbol_table.find_by_id(bound_vars.get(0)!)!;
            if (entry.is_infix) {
                return children.map((c) => {
                    const s = printNode(c, symbol_table);
                    // Parenthesize nested infix calls so (x·y)·z ≠ x·(y·z).
                    const nestedInfix = c.operation === OperationType.FUNCTIONCALL
                        && !symbol_table.find_definition(c)
                        && symbol_table.find_by_id(c.bound_vars.get(0)!)!.is_infix;
                    return nestedInfix ? `(${s})` : s;
                }).join(entry.name);
            }
            const name = displayName(bound_vars.get(0)!, OperationType.FUNCTIONCALL, symbol_table);
            if (children.size === 0) {
                return name;
            }
            return `${name}(${children.map((c) => printNode(c, symbol_table)).join(",")})`;
        }
        case OperationType.PREDICATECALL: {
            const entry = symbol_table.find_by_id(bound_vars.get(0)!)!;
            if (entry.is_infix) {
                return children.map((c) => printNode(c, symbol_table)).join(entry.name);
            }
            const name = displayName(bound_vars.get(0)!, OperationType.PREDICATECALL, symbol_table);
            if (children.size === 0) {
                return name;
            }
            return `${name}(${children.map((c) => printNode(c, symbol_table)).join(",")})`;
        }
        case OperationType.VARIABLE_INSTANCE:
            return displayName(bound_vars.get(0)!, OperationType.VARIABLE_INSTANCE, symbol_table);
        default:
            return "?";
    }
}

export function printPlainSentence(node: SentenceTreeNode, symbol_table: SymbolTable): string {
    return printNode(node, symbol_table);
}

export function variableDisplayName(symbol: ScopedId, symbol_table: SymbolTable): string {
    return displayName(symbol, OperationType.VARIABLE_INSTANCE, symbol_table);
}

export function symbolDisplayName(symbol: ScopedId, op: OperationType, symbol_table: SymbolTable): string {
    return displayName(symbol, op, symbol_table);
}
