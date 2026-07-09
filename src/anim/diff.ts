// Glyph-level alignment between the old and new rendering of a sentence.
// Standard edit-distance DP, extended with a cheap "reflection substitution"
// for symbol pairs that are (or read as) mirror images of each other, so a
// De Morgan step aligns ∧ with ∨ instead of deleting one and inserting the
// other. That alignment is what lets the animator show the conversion as a
// time-parameterized reflection rather than a fade.

export type SubKind = 'mirrorY' | 'flipX';

export type AlignOp =
    | { type: 'keep'; i: number; j: number }
    | { type: 'sub'; i: number; j: number; kind: SubKind }
    | { type: 'del'; i: number }
    | { type: 'ins'; j: number };

// ∧ and ∨ are true vertical mirror images: animate as a continuous
// scaleY(1 → -1) reflection of the same glyph.
const MIRROR_Y_PAIRS: ReadonlyArray<readonly [string, string]> = [
    ['∧', '∨'],
];

// Pairs that convert into each other during clausal-form steps but are not
// literal mirrors: animate as a flip through zero with a midpoint glyph swap.
const FLIP_X_PAIRS: ReadonlyArray<readonly [string, string]> = [
    ['∀', '∃'],
    ['→', '←'],
    ['[', '('],
    [']', ')'],
];

function pairKind(a: string, b: string): SubKind | undefined {
    for (const [p, q] of MIRROR_Y_PAIRS) {
        if ((a === p && b === q) || (a === q && b === p)) return 'mirrorY';
    }
    for (const [p, q] of FLIP_X_PAIRS) {
        if ((a === p && b === q) || (a === q && b === p)) return 'flipX';
    }
    return undefined;
}

const COST_DEL = 1.0;
const COST_INS = 1.0;
const COST_MIRROR = 0.25;
const COST_FLIP = 0.45;

export function alignGlyphs(oldChars: string[], newChars: string[]): AlignOp[] {
    const n = oldChars.length;
    const m = newChars.length;
    const W = m + 1;
    const cost = new Float64Array((n + 1) * (m + 1));
    // back: 0 = diag (keep/sub), 1 = up (del), 2 = left (ins)
    const back = new Uint8Array((n + 1) * (m + 1));
    for (let i = 1; i <= n; i++) {
        cost[i * W] = i * COST_DEL;
        back[i * W] = 1;
    }
    for (let j = 1; j <= m; j++) {
        cost[j] = j * COST_INS;
        back[j] = 2;
    }
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const a = oldChars[i - 1];
            const b = newChars[j - 1];
            let diag = Infinity;
            if (a === b) {
                diag = cost[(i - 1) * W + (j - 1)];
            } else {
                const kind = pairKind(a, b);
                if (kind !== undefined) {
                    diag = cost[(i - 1) * W + (j - 1)] + (kind === 'mirrorY' ? COST_MIRROR : COST_FLIP);
                }
            }
            const up = cost[(i - 1) * W + j] + COST_DEL;
            const left = cost[i * W + (j - 1)] + COST_INS;
            let best = diag, dir = 0;
            if (up < best) { best = up; dir = 1; }
            if (left < best) { best = left; dir = 2; }
            cost[i * W + j] = best;
            back[i * W + j] = dir;
        }
    }
    const ops: AlignOp[] = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
        const dir = back[i * W + j];
        if (i > 0 && j > 0 && dir === 0) {
            const a = oldChars[i - 1];
            const b = newChars[j - 1];
            if (a === b) {
                ops.push({ type: 'keep', i: i - 1, j: j - 1 });
            } else {
                ops.push({ type: 'sub', i: i - 1, j: j - 1, kind: pairKind(a, b)! });
            }
            i--; j--;
        } else if (i > 0 && (dir === 1 || j === 0)) {
            ops.push({ type: 'del', i: i - 1 });
            i--;
        } else {
            ops.push({ type: 'ins', j: j - 1 });
            j--;
        }
    }
    ops.reverse();
    return ops;
}
