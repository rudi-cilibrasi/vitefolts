import { describe, expect, it } from 'vitest';
import { sentenceToLatex } from './latex-printer';
import { Registry, parseSentence } from './parser';
import { SymbolTable } from './symbol-table';

function latex(text: string): string {
    const reg = new Registry();
    const tree = parseSentence(text, reg);
    const st = reg.applyTo(new SymbolTable());
    return sentenceToLatex(tree, st);
}

describe('sentenceToLatex', () => {
    it('sets multi-letter names upright and renders application', () => {
        expect(latex('MAN(socrates)')).toBe('\\mathrm{MAN}(\\mathrm{socrates})');
    });

    it('renders quantifier and implication', () => {
        expect(latex('forall x. MAN(x) -> MORTAL(x)')).toBe(
            '\\forall x.\\, \\mathrm{MAN}(x) \\rightarrow \\mathrm{MORTAL}(x)',
        );
    });

    it('renders equality with single-letter constants italic', () => {
        expect(latex('a = a')).toBe('a = a');
    });

    it('parenthesizes a negated compound and uses \\neg', () => {
        const out = latex('~exists x. (GOD(x) & MAN(x))');
        expect(out).toContain('\\neg');
        expect(out).toContain('\\exists');
        expect(out).toContain('\\wedge');
        expect(out).toContain('\\left(');
    });

    it('renders infix · as \\cdot with nested parens', () => {
        const out = latex('forall x,y,z. (x·y)·z = x·(y·z)');
        expect(out).toContain('\\cdot');
        expect(out).toContain('\\left(');
    });
});
