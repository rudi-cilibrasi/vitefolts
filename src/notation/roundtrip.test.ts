import { describe, expect, it } from 'vitest';
import { printPlainSentence } from '../anim/plain-printer';
import { Registry, parseSentence } from './parser';
import { SymbolTable } from './symbol-table';

// The parser's grammar accepts exactly what plain-printer.ts emits, so the
// printed form must be a fixpoint: printing, re-parsing, and printing again
// yields the identical string. (Exact tree equality can't be asserted because
// each parse allocates fresh bound-variable ids — the printed form is the
// stable, id-independent representative.)
function normalize(text: string): string {
    const reg = new Registry();
    const tree = parseSentence(text, reg);
    const st = reg.applyTo(new SymbolTable());
    return printPlainSentence(tree, st);
}

const CASES = [
    'MAN(socrates)',
    'forall x. MAN(x) -> MORTAL(x)',
    'forall x,y,z. (x·y)·z = x·(y·z)',
    'forall x. G(x) -> exists y. (G(y) & x·y = e)',
    '~exists x. (GOD(x) & MAN(x))',
    'P <-> Q',
    'A -> B -> C',
    'REACH(L,L,L,L) -> REACH(R,L,R,L)',
    'forall x. x + succ(y) = succ(x + y)',
];

describe('parser/printer round-trip is a fixpoint', () => {
    for (const text of CASES) {
        it(`stabilizes: ${text}`, () => {
            const once = normalize(text);
            const twice = normalize(once);
            expect(twice).toBe(once);
            // And the normalized form re-parses without error.
            expect(() => normalize(twice)).not.toThrow();
        });
    }
});
