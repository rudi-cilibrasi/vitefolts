import { describe, expect, it } from 'vitest';
import { Token, classify, melodyFrom, noteFor } from './sonify';

const t = (tag: 'mi' | 'mo' | 'mn', text: string): Token => ({ tag, text });

describe('token classification', () => {
    it('classifies operators, variables, names, numbers, parens, and rests', () => {
        expect(classify(t('mo', '∀'))).toBe('operator');
        expect(classify(t('mo', '→'))).toBe('operator');
        expect(classify(t('mi', 'x'))).toBe('variable');
        expect(classify(t('mi', 'z'))).toBe('variable');
        expect(classify(t('mi', 'MORTAL'))).toBe('name');
        expect(classify(t('mi', 'socrates'))).toBe('name');
        expect(classify(t('mn', '0'))).toBe('number');
        expect(classify(t('mo', '('))).toBe('paren');
        expect(classify(t('mo', ','))).toBe('rest');
        expect(classify(t('mo', '.'))).toBe('rest');
    });
});

describe('note mapping is consistent and structural', () => {
    it('gives the same symbol the same note every time', () => {
        expect(noteFor(t('mo', '∀'))).toEqual(noteFor(t('mo', '∀')));
    });

    it('gives distinct variables distinct pitches', () => {
        const nx = noteFor(t('mi', 'x'));
        const ny = noteFor(t('mi', 'y'));
        expect(nx.kind).toBe('note');
        expect(ny.kind).toBe('note');
        if (nx.kind === 'note' && ny.kind === 'note') {
            expect(nx.freq).not.toBe(ny.freq);
        }
    });

    it('gives all predicate/function names one shared pitch', () => {
        const a = noteFor(t('mi', 'MORTAL'));
        const b = noteFor(t('mi', 'GOD'));
        expect(a.kind).toBe('note');
        expect(b.kind).toBe('note');
        if (a.kind === 'note' && b.kind === 'note') {
            expect(a.freq).toBe(b.freq); // same pitch; only the glyph differs
        }
    });

    it('renders commas as rests', () => {
        expect(noteFor(t('mo', ',')).kind).toBe('rest');
    });

    const freq = (glyph: string): number => {
        const e = noteFor(t('mo', glyph));
        if (e.kind !== 'note') throw new Error(`${glyph} is a rest`);
        return e.freq;
    };

    it('sounds De Morgan / converse duals as inversions around the tonic', () => {
        const tonic = freq('↔'); // the axis
        // A dual pair mirrors around the tonic, so freq(a)·freq(b) = tonic².
        for (const [a, b] of [['∀', '∃'], ['∧', '∨'], ['→', '←']]) {
            expect(freq(a) * freq(b)).toBeCloseTo(tonic * tonic, 3);
        }
    });

    it('makes ¬ harmonic with ∧, ∨, and ↔ (octave of the tonic axis)', () => {
        // ¬ is the octave above ↔ (the reflection axis) — a perfect fourth
        // above ∧ and a perfect fifth above ∨ (mod octave): all consonant.
        expect(freq('¬')).toBeCloseTo(2 * freq('↔'), 3);
        const ratioMod = (x: number, y: number) => { let r = x / y; while (r >= 2) r /= 2; return r; };
        expect(ratioMod(freq('¬'), freq('∧'))).toBeCloseTo(4 / 3, 2); // perfect fourth
        expect(ratioMod(freq('¬'), freq('∨'))).toBeCloseTo(3 / 2, 2); // perfect fifth
    });

    it('produces a melody event per token', () => {
        const melody = melodyFrom([t('mo', '∀'), t('mi', 'x'), t('mo', '.'), t('mi', 'MAN'), t('mo', '→'), t('mi', 'MORTAL')]);
        expect(melody).toHaveLength(6);
        expect(melody.filter((e) => e.kind === 'note')).toHaveLength(5); // the dot is a rest
    });
});
