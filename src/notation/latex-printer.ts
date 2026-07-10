import { List } from 'immutable';
import { OperationType } from './operation-type';
import { ScopedId, getName, getScope } from './scope';
import { SentenceTreeNode } from './sentence-tree-node';
import { SymbolTable } from './symbol-table';

// LaTeX printer for sentences (issue #19). A math-mode-ready string mirroring
// what plain-printer.ts renders in Unicode, so `$...$` of the output typesets
// the same formula. Self-contained within notation/ so the extracted engine
// library can render LaTeX without the animation layer.

const INFIX_LATEX: Record<string, string> = {
    '·': ' \\cdot ',
    '*': ' \\cdot ',
    '+': ' + ',
    '-': ' - ',
    '/': ' / ',
};

// A multi-character alphabetic name (a predicate/function like MORTAL) is set
// upright with \mathrm so it doesn't render as a product of italic letters;
// single letters stay italic. Underscores are escaped.
function mathName(raw: string): string {
    const escaped = raw.replace(/_/g, '\\_');
    if (raw.length > 1 && /^[A-Za-z]/.test(raw)) {
        return `\\mathrm{${escaped}}`;
    }
    return escaped;
}

function displayName(symbol: ScopedId, op: OperationType, st: SymbolTable): string {
    if (st.names.has(symbol)) {
        return st.names.get(symbol)!;
    }
    const scope = getScope(symbol);
    switch (op) {
        case OperationType.FORALL:
        case OperationType.EXISTS:
        case OperationType.FUNCTIONCALL:
        case OperationType.VARIABLE_INSTANCE:
            if (scope === 1) {
                return String.fromCharCode('x'.charCodeAt(0) + Number(getName(symbol)));
            }
            return 'x_{' + Number(getName(symbol)) + '}';
        default:
            return String.fromCharCode('P'.charCodeAt(0) + Number(getName(symbol)));
    }
}

function isCompound(op: OperationType): boolean {
    return op === OperationType.AND || op === OperationType.OR
        || op === OperationType.IMPLIES || op === OperationType.IFF
        || op === OperationType.LIMP || op === OperationType.FORALL
        || op === OperationType.EXISTS;
}

function parenthesized(node: SentenceTreeNode, st: SymbolTable): string {
    const body = printNode(node, st);
    return isCompound(node.operation) ? `\\left( ${body} \\right)` : body;
}

function printNode(node: SentenceTreeNode, st: SymbolTable): string {
    const definite = st.find_definition(node);
    if (definite) {
        return mathName(definite);
    }
    const children: List<SentenceTreeNode> = node.children;
    const bound: List<ScopedId> = node.bound_vars;
    switch (node.operation) {
        case OperationType.VOID:
            return '\\emptyset';
        case OperationType.EQUALS:
            return children.map((c) => printNode(c, st)).join(' = ');
        case OperationType.AND:
            return children.map((c) => parenthesized(c, st)).join(' \\wedge ');
        case OperationType.OR:
            return children.map((c) => parenthesized(c, st)).join(' \\vee ');
        case OperationType.NOT: {
            const child = children.get(0)!;
            return `\\neg ${parenthesized(child, st)}`;
        }
        case OperationType.IMPLIES:
            return `${parenthesized(children.get(0)!, st)} \\rightarrow ${parenthesized(children.get(1)!, st)}`;
        case OperationType.IFF:
            return `${parenthesized(children.get(0)!, st)} \\leftrightarrow ${parenthesized(children.get(1)!, st)}`;
        case OperationType.LIMP:
            return `${parenthesized(children.get(0)!, st)} \\leftarrow ${parenthesized(children.get(1)!, st)}`;
        case OperationType.FORALL:
            return `\\forall ${bound.map((s) => displayName(s, OperationType.FORALL, st)).join(', ')}.\\, ${printNode(children.get(0)!, st)}`;
        case OperationType.EXISTS:
            return `\\exists ${bound.map((s) => displayName(s, OperationType.EXISTS, st)).join(', ')}.\\, ${printNode(children.get(0)!, st)}`;
        case OperationType.FUNCTIONCALL: {
            const entry = st.find_by_id(bound.get(0)!)!;
            if (entry.is_infix) {
                const sep = INFIX_LATEX[entry.name] ?? ` ${mathName(entry.name)} `;
                return children.map((c) => {
                    const s = printNode(c, st);
                    const nestedInfix = c.operation === OperationType.FUNCTIONCALL
                        && !st.find_definition(c)
                        && st.find_by_id(c.bound_vars.get(0)!)!.is_infix;
                    return nestedInfix ? `\\left( ${s} \\right)` : s;
                }).join(sep);
            }
            const name = mathName(displayName(bound.get(0)!, OperationType.FUNCTIONCALL, st));
            if (children.size === 0) return name;
            return `${name}(${children.map((c) => printNode(c, st)).join(', ')})`;
        }
        case OperationType.PREDICATECALL: {
            const entry = st.find_by_id(bound.get(0)!)!;
            if (entry.is_infix) {
                return children.map((c) => printNode(c, st)).join(` ${mathName(entry.name)} `);
            }
            const name = mathName(displayName(bound.get(0)!, OperationType.PREDICATECALL, st));
            if (children.size === 0) return name;
            return `${name}(${children.map((c) => printNode(c, st)).join(', ')})`;
        }
        case OperationType.VARIABLE_INSTANCE:
            return displayName(bound.get(0)!, OperationType.VARIABLE_INSTANCE, st);
        default:
            return '?';
    }
}

// LaTeX (math-mode body) for one sentence.
export function sentenceToLatex(node: SentenceTreeNode, symbolTable: SymbolTable): string {
    return printNode(node, symbolTable);
}
