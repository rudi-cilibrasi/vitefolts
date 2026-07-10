// Pure formula → melody mapping (issue #48). A rendered formula is a flat run
// of MathML tokens (<mi> names/variables, <mo> operators, <mn> numbers); this
// turns each token into a note event. The mapping is fixed and consistent, so
// the same symbol always sounds the same — letting a learner hear a formula
// and hear how a clausal-form step changes it. Notes are chosen on the circle
// of fifths so sequences come out harmonic rather than noisy.

export type TokenTag = 'mi' | 'mo' | 'mn';
export type Role = 'operator' | 'variable' | 'name' | 'number' | 'paren' | 'rest';

export interface Token {
    tag: TokenTag;
    text: string;
}

export type NoteEvent =
    | { kind: 'note'; role: Role; glyph: string; freq: number }
    | { kind: 'rest'; role: Role; glyph: string };

const C4 = 261.6255653; // middle C
export function freqFromSemitones(semitones: number): number {
    return C4 * Math.pow(2, semitones / 12);
}

// Circle-of-fifths semitone offsets — consonant when played in sequence.
const OPERATOR_SEMITONES: Record<string, number> = {
    '∀': 0, // C
    '∃': 7, // G
    '¬': 2, // D
    '∧': 9, // A
    '∨': 4, // E
    '↔': 11, // B
    '→': 6, // F#
    '←': 1, // C#
    '=': 5, // F
    '·': 8, // G#
    '+': 3, // D#
    '-': 10, // A#
    '/': 8,
};

// Each variable letter gets its own note, a register above the operators, so a
// substitution x ↦ y is audible.
const VARIABLE_SEMITONES: Record<string, number> = {
    u: 19, v: 21, w: 23, x: 24, y: 26, z: 28,
};

// Predicates and functions share one steady lower note — the ear tracks
// structure, not which name.
const NAME_SEMITONES = -5; // G3
const NUMBER_SEMITONES = -3; // A3
const PAREN_SEMITONES = -12; // C3, a soft low blip

function isVariableGlyph(text: string): boolean {
    return /^[u-z]$/.test(text);
}

// Classify a single token by its tag and glyph.
export function classify(token: Token): Role {
    if (token.tag === 'mn') return 'number';
    if (token.tag === 'mi') return isVariableGlyph(token.text) ? 'variable' : 'name';
    // token.tag === 'mo'
    const t = token.text;
    if (t === ',') return 'rest'; // too frequent to be a pitch
    if (t === '(' || t === ')' || t === '[' || t === ']') return 'paren';
    if (t === '.') return 'rest'; // quantifier dot
    return 'operator';
}

export function noteFor(token: Token): NoteEvent {
    const role = classify(token);
    const glyph = token.text;
    switch (role) {
        case 'rest':
            return { kind: 'rest', role, glyph };
        case 'operator': {
            const semis = OPERATOR_SEMITONES[glyph];
            // Unknown operator glyph: skip silently rather than guess a pitch.
            if (semis === undefined) return { kind: 'rest', role: 'rest', glyph };
            return { kind: 'note', role, glyph, freq: freqFromSemitones(semis) };
        }
        case 'variable':
            return { kind: 'note', role, glyph, freq: freqFromSemitones(VARIABLE_SEMITONES[glyph]!) };
        case 'name':
            return { kind: 'note', role, glyph, freq: freqFromSemitones(NAME_SEMITONES) };
        case 'number':
            return { kind: 'note', role, glyph, freq: freqFromSemitones(NUMBER_SEMITONES) };
        case 'paren':
            return { kind: 'note', role, glyph, freq: freqFromSemitones(PAREN_SEMITONES) };
    }
}

// Turn a token run into a melody. Same tokens → same melody, always.
export function melodyFrom(tokens: Token[]): NoteEvent[] {
    return tokens.map(noteFor);
}
