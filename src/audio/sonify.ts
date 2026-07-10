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

// Operators use a consonant palette built around a tonic (C).
//
//  * Each De Morgan / converse dual pair is a pitch INVERSION around the tonic
//    (∀/∃, ∧/∨, →/←): the dual is the reflection of its partner — the audible
//    analogue of the animation flipping ∧ into ∨. A pair is +n / −n semitones,
//    so their frequencies multiply to the tonic squared.
//  * ↔ is self-dual and sits on the tonic (C4). ¬ — the operator that turns ∧
//    into ∨ — sits on C5, the octave of that reflection axis: a perfect fourth
//    above ∧ (G) and a perfect fifth+octave above ∨ (F). So ¬, ∧, ∨ (and ↔)
//    form one consonant C–F–G family — negation harmonizes with and/or.
const TONIC = 0; // C4
const OPERATOR_SEMITONES: Record<string, number> = {
    '↔': TONIC, // C4  — biconditional: self-dual, on the axis
    '¬': 12, // C5  — negation: the complementer, an octave up
    '=': 2, // D4  — equality: a symmetric relation
    // De Morgan / converse dual pairs — mirror images around the tonic:
    '∀': 4, '∃': -4, // E4 / A♭3  (∀ a third above, ∃ a third below)
    '∧': 7, '∨': -7, // G4 / F3   (∧ a fifth above, ∨ a fifth below)
    '→': 9, '←': -9, // A4 / E♭3  (converses)
    // Term-level infix operators, kept consonant and out of the way:
    '·': 5, '/': 5, // F4
    '+': 14, '-': 16, // D5 / E5
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
