import { List } from 'immutable';
import { and, eq, exists, fn, forall, iff, implies, not, or, pred, varr } from './builders';
import { OperationType } from './operation-type';
import { getName, getScope, n2SI, ScopedId } from './scope';
import { S3, SentenceTreeNode } from './sentence-tree-node';
import { SymbolTable } from './symbol-table';
import { SymbolType } from './symbol-type';

// Text parser for first-order formulas. The grammar accepts exactly what
// plain-printer.ts emits — so any displayed sentence can be pasted back in —
// plus ASCII aliases for every symbol:
//   ∀/forall  ∃/exists  ¬/~  ∧/&  ∨/|  →/->  ←/<-  ↔/<->  ·/*
// Symbol roles are inferred from usage: a name applied in formula position is
// a predicate, in term position a function; bare names are variables when
// quantifier-bound or single letters u–z, otherwise constants.

export class ParseError extends Error {}

interface Token {
    kind: 'id' | 'op';
    value: string;
    pos: number;
}

const OP_ALIASES: Array<[string, string]> = [
    ['<->', '↔'], ['->', '→'], ['<-', '←'],
    ['~', '¬'], ['&', '∧'], ['|', '∨'], ['*', '·'],
];
const SINGLE_OPS = new Set(['∀', '∃', '¬', '∧', '∨', '→', '←', '↔', '=', '(', ')', '[', ']', '.', ',', '·', '+', '-', '/']);
const KEYWORDS = new Map<string, string>([['forall', '∀'], ['exists', '∃']]);
const INFIX_TERM_OPS = new Set(['·', '+', '-', '/']);

function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    outer: while (i < text.length) {
        const ch = text[i];
        if (/\s/.test(ch)) { i++; continue; }
        for (const [alias, canon] of OP_ALIASES) {
            if (text.startsWith(alias, i)) {
                tokens.push({ kind: 'op', value: canon, pos: i });
                i += alias.length;
                continue outer;
            }
        }
        if (SINGLE_OPS.has(ch)) {
            tokens.push({ kind: 'op', value: ch, pos: i });
            i++;
            continue;
        }
        const m = /^[A-Za-z0-9_]+/.exec(text.slice(i));
        if (m) {
            const word = m[0];
            const kw = KEYWORDS.get(word.toLowerCase());
            if (kw !== undefined) {
                tokens.push({ kind: 'op', value: kw, pos: i });
            } else {
                tokens.push({ kind: 'id', value: word, pos: i });
            }
            i += word.length;
            continue;
        }
        throw new ParseError(`Unexpected character “${ch}” at position ${i + 1}`);
    }
    return tokens;
}

// Untyped syntax tree, before symbol roles are resolved.
type UTerm =
    | { k: 'name'; name: string }
    | { k: 'call'; name: string; args: UTerm[] }
    | { k: 'infix'; op: string; l: UTerm; r: UTerm };

type UForm =
    | { k: 'iff' | 'imp' | 'limp'; a: UForm; b: UForm }
    | { k: 'and' | 'or'; items: UForm[] }
    | { k: 'not'; a: UForm }
    | { k: 'forall' | 'exists'; vars: string[]; body: UForm }
    | { k: 'eq'; l: UTerm; r: UTerm }
    | { k: 'atom'; name: string; args: UTerm[] };

// Bound recursion so a deeply nested formula (e.g. thousands of nested
// parentheses or ¬) throws a catchable ParseError instead of overflowing the
// stack. Real formulas nest only a handful deep.
const MAX_PARSE_DEPTH = 1000;

class TokenStream {
    tokens: Token[];
    pos = 0;
    depth = 0;
    constructor(text: string) {
        this.tokens = tokenize(text);
    }
    enter(): void {
        if (++this.depth > MAX_PARSE_DEPTH) {
            throw new ParseError('Formula is nested too deeply');
        }
    }
    leave(): void {
        this.depth--;
    }
    peek(): Token | undefined {
        return this.tokens[this.pos];
    }
    peekOp(value: string): boolean {
        const t = this.peek();
        return t !== undefined && t.kind === 'op' && t.value === value;
    }
    takeOp(value: string): boolean {
        if (this.peekOp(value)) { this.pos++; return true; }
        return false;
    }
    expectOp(value: string): void {
        if (!this.takeOp(value)) {
            const t = this.peek();
            throw new ParseError(`Expected “${value}”${t ? ` but found “${t.value}”` : ' but the formula ended'}`);
        }
    }
    takeId(): string {
        const t = this.peek();
        if (t === undefined || t.kind !== 'id') {
            throw new ParseError(`Expected a name${t ? ` but found “${t.value}”` : ' but the formula ended'}`);
        }
        this.pos++;
        return t.value;
    }
    atEnd(): boolean {
        return this.pos >= this.tokens.length;
    }
}

function parseArgs(s: TokenStream): UTerm[] {
    const args: UTerm[] = [];
    if (s.takeOp(')')) return args;
    for (;;) {
        args.push(parseUTerm(s));
        if (s.takeOp(')')) return args;
        s.expectOp(',');
    }
}

function parseUFactor(s: TokenStream): UTerm {
    if (s.takeOp('(')) {
        const t = parseUTerm(s);
        s.expectOp(')');
        return t;
    }
    const name = s.takeId();
    if (s.takeOp('(')) {
        return { k: 'call', name, args: parseArgs(s) };
    }
    return { k: 'name', name };
}

function parseUTerm(s: TokenStream): UTerm {
    let left = parseUFactor(s);
    for (;;) {
        const t = s.peek();
        if (t === undefined || t.kind !== 'op' || !INFIX_TERM_OPS.has(t.value)) return left;
        s.pos++;
        left = { k: 'infix', op: t.value, l: left, r: parseUFactor(s) };
    }
}

function parseAtomOrParen(s: TokenStream): UForm {
    // Try `term = term` first (the lhs may itself start with a parenthesis,
    // as in (x·y)·z = x·(y·z)), backtracking if no “=” materializes.
    const save = s.pos;
    try {
        const l = parseUTerm(s);
        if (s.takeOp('=')) {
            return { k: 'eq', l, r: parseUTerm(s) };
        }
    } catch {
        // fall through to the other alternatives
    }
    s.pos = save;
    if (s.takeOp('(')) {
        const inner = parseUForm(s);
        s.expectOp(')');
        return inner;
    }
    if (s.takeOp('[')) {
        const inner = parseUForm(s);
        s.expectOp(']');
        return inner;
    }
    const name = s.takeId();
    if (s.takeOp('(')) {
        return { k: 'atom', name, args: parseArgs(s) };
    }
    return { k: 'atom', name, args: [] };
}

function parseUnary(s: TokenStream): UForm {
    // Every nesting level (¬, quantifier body, or a parenthesized subformula
    // via parseAtomOrParen) passes through here, so this is the choke point
    // for the recursion-depth bound.
    s.enter();
    try {
        return parseUnaryInner(s);
    } finally {
        s.leave();
    }
}

function parseUnaryInner(s: TokenStream): UForm {
    if (s.takeOp('¬')) {
        return { k: 'not', a: parseUnary(s) };
    }
    if (s.peekOp('∀') || s.peekOp('∃')) {
        const which = s.peek()!.value === '∀' ? 'forall' : 'exists';
        s.pos++;
        const vars = [s.takeId()];
        while (s.takeOp(',')) vars.push(s.takeId());
        s.expectOp('.');
        // Quantifier bodies extend as far to the right as possible.
        return { k: which, vars, body: parseUForm(s) };
    }
    return parseAtomOrParen(s);
}

function parseConj(s: TokenStream): UForm {
    const items = [parseUnary(s)];
    while (s.takeOp('∧')) items.push(parseUnary(s));
    return items.length === 1 ? items[0] : { k: 'and', items };
}

function parseDisj(s: TokenStream): UForm {
    const items = [parseConj(s)];
    while (s.takeOp('∨')) items.push(parseConj(s));
    return items.length === 1 ? items[0] : { k: 'or', items };
}

function parseImp(s: TokenStream): UForm {
    const parts: UForm[] = [parseDisj(s)];
    const ops: string[] = [];
    while (s.peekOp('→') || s.peekOp('←')) {
        ops.push(s.peek()!.value);
        s.pos++;
        parts.push(parseDisj(s));
    }
    if (ops.length === 0) return parts[0];
    if (ops.some((o) => o !== ops[0])) {
        throw new ParseError('Mixed → and ← without parentheses — please add parentheses');
    }
    if (ops[0] === '→') {
        // Right-associative: A → B → C means A → (B → C).
        let result = parts[parts.length - 1];
        for (let i = parts.length - 2; i >= 0; i--) {
            result = { k: 'imp', a: parts[i], b: result };
        }
        return result;
    }
    let result = parts[0];
    for (let i = 1; i < parts.length; i++) {
        result = { k: 'limp', a: result, b: parts[i] };
    }
    return result;
}

function parseUForm(s: TokenStream): UForm {
    let left = parseImp(s);
    while (s.takeOp('↔')) {
        left = { k: 'iff', a: left, b: parseImp(s) };
    }
    return left;
}

// ---------------------------------------------------------------------------
// Symbol resolution: assign predicate/function/variable roles and ids.

interface SymbolInfo {
    id: ScopedId;
    kind: 'predicate' | 'function';
    arity: number;
    infix: boolean;
}

interface NewSymbol {
    id: ScopedId;
    name: string;
    kind: 'predicate' | 'function' | 'variable';
    arity: number;
    infix: boolean;
}

function isVariableName(name: string): boolean {
    return /^[u-z]$/.test(name);
}

export class Registry {
    private symbols = new Map<string, SymbolInfo>();
    private freeVarIds = new Map<string, ScopedId>();
    private additions: NewSymbol[] = [];
    private nextSymbolNum = 0;
    private nextVarNum = 0;
    private usedSymbolNums = new Set<number>();
    private usedVarNums = new Set<number>();

    static fromSymbolTable(st: SymbolTable): Registry {
        const reg = new Registry();
        for (const entry of st.all_entries()) {
            if (getScope(entry.id) === 1) {
                // Variables registered by earlier parses — never reuse their ids.
                reg.usedVarNums.add(Number(getName(entry.id)));
                continue;
            }
            const kind = entry.stype === SymbolType.PREDICATE ? 'predicate'
                : entry.stype === SymbolType.FUNCTION ? 'function' : null;
            if (kind === null) continue;
            reg.symbols.set(entry.name, { id: entry.id, kind, arity: entry.arity, infix: entry.is_infix });
            if (getScope(entry.id) === 0) {
                reg.usedSymbolNums.add(Number(getName(entry.id)));
            }
        }
        // Keep clear of the anonymous x/y/z ids the built-in examples use.
        reg.nextVarNum = 50;
        return reg;
    }

    newSymbols(): NewSymbol[] {
        return this.additions;
    }

    private allocSymbolId(): ScopedId {
        while (this.usedSymbolNums.has(this.nextSymbolNum)) this.nextSymbolNum++;
        this.usedSymbolNums.add(this.nextSymbolNum);
        return n2SI(0, this.nextSymbolNum);
    }

    lookup(name: string, kind: 'predicate' | 'function', arity: number, infix: boolean): ScopedId {
        const existing = this.symbols.get(name);
        if (existing !== undefined) {
            if (existing.kind !== kind || existing.arity !== arity) {
                throw new ParseError(
                    `“${name}” is used as a ${kind} with ${arity} argument(s) but was already a ${existing.kind} with ${existing.arity}`);
            }
            return existing.id;
        }
        const id = this.allocSymbolId();
        this.symbols.set(name, { id, kind, arity, infix });
        this.additions.push({ id, name, kind, arity, infix });
        return id;
    }

    private allocVarId(): ScopedId {
        while (this.usedVarNums.has(this.nextVarNum)) this.nextVarNum++;
        this.usedVarNums.add(this.nextVarNum);
        return n2SI(1, this.nextVarNum);
    }

    freeVar(name: string): ScopedId {
        const existing = this.freeVarIds.get(name);
        if (existing !== undefined) return existing;
        const id = this.allocVarId();
        this.freeVarIds.set(name, id);
        this.additions.push({ id, name, kind: 'variable', arity: 0, infix: false });
        return id;
    }

    boundVar(name: string): ScopedId {
        const id = this.allocVarId();
        this.additions.push({ id, name, kind: 'variable', arity: 0, infix: false });
        return id;
    }

    // Register every symbol this registry has allocated into a symbol table.
    applyTo(st: SymbolTable): SymbolTable {
        for (const s of this.additions) {
            if (s.kind === 'predicate') st = st.add_predicate(s.id, s.name, s.arity, s.infix);
            else if (s.kind === 'function') st = st.add_function(s.id, s.name, s.arity, s.infix);
            else st = st.add_variable(s.id, s.name);
        }
        return st;
    }
}

function resolveTerm(t: UTerm, reg: Registry, bound: Map<string, ScopedId>): SentenceTreeNode {
    switch (t.k) {
        case 'name': {
            const boundId = bound.get(t.name);
            if (boundId !== undefined) return varr(boundId);
            if (isVariableName(t.name)) return varr(reg.freeVar(t.name));
            return fn(reg.lookup(t.name, 'function', 0, false));
        }
        case 'call':
            return fn(reg.lookup(t.name, 'function', t.args.length, false),
                ...t.args.map((a) => resolveTerm(a, reg, bound)));
        case 'infix':
            return fn(reg.lookup(t.op, 'function', 2, true),
                resolveTerm(t.l, reg, bound), resolveTerm(t.r, reg, bound));
    }
}

function resolveForm(f: UForm, reg: Registry, bound: Map<string, ScopedId>): SentenceTreeNode {
    switch (f.k) {
        case 'iff':
            return iff(resolveForm(f.a, reg, bound), resolveForm(f.b, reg, bound));
        case 'imp':
            return implies(resolveForm(f.a, reg, bound), resolveForm(f.b, reg, bound));
        case 'limp':
            return S3(OperationType.LIMP,
                List([resolveForm(f.a, reg, bound), resolveForm(f.b, reg, bound)]), List([]));
        case 'and':
            return and(...f.items.map((i) => resolveForm(i, reg, bound)));
        case 'or':
            return or(...f.items.map((i) => resolveForm(i, reg, bound)));
        case 'not':
            return not(resolveForm(f.a, reg, bound));
        case 'forall':
        case 'exists': {
            const inner = new Map(bound);
            const ids = f.vars.map((name) => {
                const id = reg.boundVar(name);
                inner.set(name, id);
                return id;
            });
            const body = resolveForm(f.body, reg, inner);
            return f.k === 'forall' ? forall(ids, body) : exists(ids, body);
        }
        case 'eq':
            return eq(resolveTerm(f.l, reg, bound), resolveTerm(f.r, reg, bound));
        case 'atom': {
            if (f.args.length === 0) {
                const boundId = bound.get(f.name);
                if (boundId !== undefined || isVariableName(f.name)) {
                    throw new ParseError(`“${f.name}” is a variable — a formula cannot be a bare variable`);
                }
            }
            return pred(reg.lookup(f.name, 'predicate', f.args.length, false),
                ...f.args.map((a) => resolveTerm(a, reg, bound)));
        }
    }
}

export function parseSentence(text: string, reg: Registry): SentenceTreeNode {
    const s = new TokenStream(text);
    if (s.atEnd()) {
        throw new ParseError('Empty formula');
    }
    const form = parseUForm(s);
    if (!s.atEnd()) {
        const t = s.peek()!;
        throw new ParseError(`Unexpected “${t.value}” after the end of the formula`);
    }
    return resolveForm(form, reg, new Map());
}
