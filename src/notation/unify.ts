import { OperationType } from './operation-type';
import { ScopedId } from './scope';
import { S3F, SentenceTreeNode } from './sentence-tree-node';

// First-order term unification with occurs check, over the term fragment of
// SentenceTreeNode (VARIABLE_INSTANCE and FUNCTIONCALL). Substitutions are
// triangular: bindings may map a variable to a term containing further bound
// variables; deref/applySubst chase the chain.

export type Subst = Map<ScopedId, SentenceTreeNode>;

export function isVar(t: SentenceTreeNode): boolean {
    return t.operation === OperationType.VARIABLE_INSTANCE;
}

export function varId(t: SentenceTreeNode): ScopedId {
    return t.bound_vars.get(0)!;
}

export function deref(t: SentenceTreeNode, subst: Subst): SentenceTreeNode {
    while (isVar(t)) {
        const bound = subst.get(varId(t));
        if (bound === undefined) break;
        t = bound;
    }
    return t;
}

function occurs(id: ScopedId, t: SentenceTreeNode, subst: Subst): boolean {
    t = deref(t, subst);
    if (isVar(t)) {
        return varId(t) === id;
    }
    return t.children.some((c) => occurs(id, c, subst));
}

export function unifyTerms(a: SentenceTreeNode, b: SentenceTreeNode, subst: Subst): boolean {
    a = deref(a, subst);
    b = deref(b, subst);
    if (isVar(a) && isVar(b) && varId(a) === varId(b)) {
        return true;
    }
    if (isVar(a)) {
        if (occurs(varId(a), b, subst)) return false;
        subst.set(varId(a), b);
        return true;
    }
    if (isVar(b)) {
        return unifyTerms(b, a, subst);
    }
    if (a.operation !== b.operation) return false;
    if (a.operation === OperationType.FUNCTIONCALL && a.bound_vars.get(0) !== b.bound_vars.get(0)) {
        return false;
    }
    if (a.children.size !== b.children.size) return false;
    for (let i = 0; i < a.children.size; i++) {
        if (!unifyTerms(a.children.get(i)!, b.children.get(i)!, subst)) return false;
    }
    return true;
}

// Atoms are PREDICATECALL or EQUALS nodes. Direct orientation only; callers
// that want symmetric equality matching try the swapped atom themselves.
export function unifyAtoms(a: SentenceTreeNode, b: SentenceTreeNode, subst: Subst): boolean {
    if (a.operation !== b.operation) return false;
    if (a.operation === OperationType.PREDICATECALL && a.bound_vars.get(0) !== b.bound_vars.get(0)) {
        return false;
    }
    if (a.children.size !== b.children.size) return false;
    for (let i = 0; i < a.children.size; i++) {
        if (!unifyTerms(a.children.get(i)!, b.children.get(i)!, subst)) return false;
    }
    return true;
}

export function applySubst(t: SentenceTreeNode, subst: Subst): SentenceTreeNode {
    if (isVar(t)) {
        const bound = subst.get(varId(t));
        return bound === undefined ? t : applySubst(bound, subst);
    }
    if (t.children.size === 0) return t;
    const children = t.children.map((c) => applySubst(c, subst));
    return S3F({ operation: t.operation, children, bound_vars: t.bound_vars });
}

export function termSize(t: SentenceTreeNode): number {
    let size = 1;
    for (const c of t.children) {
        size += termSize(c);
    }
    return size;
}
