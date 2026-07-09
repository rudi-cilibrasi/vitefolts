import { List } from 'immutable';
import { not } from '../notation/builders';
import { Clause } from '../notation/cnf';
import { OperationType } from '../notation/operation-type';
import { ScopedId } from '../notation/scope';
import { SentenceTreeNode } from '../notation/sentence-tree-node';
import { SymbolTable } from '../notation/symbol-table';
import { symbolDisplayName } from './plain-printer';

// MathML printer for display. Emits the inner content of a <math> element as
// a flat run of token elements (<mi>/<mo>/<mn>), mirroring the notation of
// plain-printer.ts exactly — same brackets, same parenthesization — so the
// on-screen formula matches what the editor parses. The animation layer
// measures these tokens and animates styled clones of them between renders.

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const mo = (s: string): string => `<mo>${esc(s)}</mo>`;
// The quantifier dot and similar separators get no operator spacing.
const moTight = (s: string): string => `<mo lspace="0" rspace="0">${esc(s)}</mo>`;

function nameToken(name: string, italic: boolean): string {
    if (/^[0-9]+$/.test(name)) {
        return `<mn>${esc(name)}</mn>`;
    }
    // Multi-character <mi> renders upright by default; variables (possibly
    // primed, like x′) should stay italic.
    const variant = italic && name.length > 1 ? ' mathvariant="italic"' : '';
    return `<mi${variant}>${esc(name)}</mi>`;
}

function needsParensUnderNot(op: OperationType): boolean {
    return op !== OperationType.PREDICATECALL
        && op !== OperationType.VARIABLE_INSTANCE
        && op !== OperationType.NOT;
}

function printNode(node: SentenceTreeNode, st: SymbolTable): string {
    const definite = st.find_definition(node);
    if (definite) {
        return nameToken(definite, false);
    }
    const children: List<SentenceTreeNode> = node.children;
    const bound_vars: List<ScopedId> = node.bound_vars;
    switch (node.operation) {
        case OperationType.VOID:
            return mo('∅');
        case OperationType.EQUALS:
            return children.map((c) => printNode(c, st)).join(mo('='));
        case OperationType.AND:
            return children.map((c) => mo('[') + printNode(c, st) + mo(']')).join(mo('∧'));
        case OperationType.OR:
            return children.map((c) => mo('(') + printNode(c, st) + mo(')')).join(mo('∨'));
        case OperationType.NOT: {
            const child = children.get(0)!;
            const body = printNode(child, st);
            return needsParensUnderNot(child.operation) ? mo('¬') + mo('(') + body + mo(')') : mo('¬') + body;
        }
        case OperationType.IMPLIES:
            return printNode(children.get(0)!, st) + mo('→') + printNode(children.get(1)!, st);
        case OperationType.IFF:
            return printNode(children.get(0)!, st) + mo('↔') + printNode(children.get(1)!, st);
        case OperationType.LIMP:
            return printNode(children.get(0)!, st) + mo('←') + printNode(children.get(1)!, st);
        case OperationType.FORALL:
        case OperationType.EXISTS: {
            const q = node.operation === OperationType.FORALL ? '∀' : '∃';
            const vars = bound_vars
                .map((s) => nameToken(symbolDisplayName(s, node.operation, st), true))
                .join(moTight(','));
            return mo(q) + vars + moTight('.') + printNode(children.get(0)!, st);
        }
        case OperationType.FUNCTIONCALL: {
            const entry = st.find_by_id(bound_vars.get(0)!)!;
            if (entry.is_infix) {
                return children.map((c) => {
                    const s = printNode(c, st);
                    const nestedInfix = c.operation === OperationType.FUNCTIONCALL
                        && !st.find_definition(c)
                        && st.find_by_id(c.bound_vars.get(0)!)!.is_infix;
                    return nestedInfix ? mo('(') + s + mo(')') : s;
                }).join(mo(entry.name));
            }
            const name = nameToken(symbolDisplayName(bound_vars.get(0)!, OperationType.FUNCTIONCALL, st), false);
            if (children.size === 0) {
                return name;
            }
            return name + mo('(') + children.map((c) => printNode(c, st)).join(moTight(',')) + mo(')');
        }
        case OperationType.PREDICATECALL: {
            const entry = st.find_by_id(bound_vars.get(0)!)!;
            if (entry.is_infix) {
                return children.map((c) => printNode(c, st)).join(mo(entry.name));
            }
            const name = nameToken(symbolDisplayName(bound_vars.get(0)!, OperationType.PREDICATECALL, st), false);
            if (children.size === 0) {
                return name;
            }
            return name + mo('(') + children.map((c) => printNode(c, st)).join(moTight(',')) + mo(')');
        }
        case OperationType.VARIABLE_INSTANCE:
            return nameToken(symbolDisplayName(bound_vars.get(0)!, OperationType.VARIABLE_INSTANCE, st), true);
        default:
            return mo('?');
    }
}

export function mmlSentence(node: SentenceTreeNode, st: SymbolTable): string {
    return printNode(node, st);
}

export function mmlClause(clause: Clause, st: SymbolTable): string {
    if (clause.literals.length === 0) {
        return mo('□');
    }
    const lits = clause.literals
        .map((l) => (l.positive ? printNode(l.atom, st) : printNode(not(l.atom), st)))
        .join(mo(','));
    return mo('{') + lits + mo('}');
}

// The starting frame of a proof-step animation: center ⊗ side.
export function mmlFusion(center: string, side: string): string {
    return center + mo('⊗') + side;
}
