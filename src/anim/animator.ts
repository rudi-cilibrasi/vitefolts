import { AlignOp } from "./diff";
import { alignGlyphs } from "./diff";

// Animates a row of glyphs from its current text to a new text.
//
// * Surviving glyphs travel along quadratic Bézier splines (time-parameterized
//   with cubic in/out easing, slightly staggered left to right).
// * mirrorY substitutions (∧ ↔ ∨) animate as a continuous scaleY(1 → -1)
//   reflection: the old glyph literally flips into the new one.
// * flipX substitutions (∀ ↔ ∃, brackets) flip through zero width and swap
//   the character at the midpoint.
// * Deleted glyphs shrink and fade out early; inserted glyphs pop in late.

export interface Glyph {
    ch: string;
    x: number;
    y: number;
}

function makeGlyphSpan(ch: string): HTMLSpanElement {
    const s = document.createElement('span');
    s.className = 'g';
    s.textContent = ch;
    return s;
}

export function renderStatic(container: HTMLElement, text: string): void {
    container.classList.remove('animating');
    container.style.removeProperty('height');
    container.textContent = '';
    for (const ch of text) {
        container.appendChild(makeGlyphSpan(ch));
    }
}

function measureGlyphs(container: HTMLElement): Glyph[] {
    const glyphs: Glyph[] = [];
    for (const child of Array.from(container.children)) {
        const el = child as HTMLElement;
        glyphs.push({ ch: el.textContent ?? '', x: el.offsetLeft, y: el.offsetTop });
    }
    return glyphs;
}

function measureNewLayout(container: HTMLElement, text: string): { glyphs: Glyph[]; height: number } {
    const probe = document.createElement('div');
    probe.className = container.className;
    probe.classList.remove('animating');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.left = '0';
    probe.style.top = '0';
    probe.style.width = `${container.clientWidth}px`;
    container.parentElement!.appendChild(probe);
    renderStatic(probe, text);
    const glyphs = measureGlyphs(probe);
    const height = probe.offsetHeight;
    probe.remove();
    return { glyphs, height };
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(t: number): number {
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

interface Actor {
    el: HTMLSpanElement;
    apply: (t: number) => void;   // t is global progress in [0, 1]
    finalCh?: string;
}

// Position along a quadratic Bézier from (0,0) to (dx,dy), bowed sideways.
function splineOffset(dx: number, dy: number, bowSign: number, t: number): { x: number; y: number } {
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
        return { x: dx * t, y: dy * t };
    }
    const amp = Math.min(28, dist * 0.22) * bowSign;
    const nx = -dy / dist;
    const ny = dx / dist;
    const cx = dx / 2 + nx * amp;
    const cy = dy / 2 + ny * amp;
    const u = 1 - t;
    return {
        x: 2 * u * t * cx + t * t * dx,
        y: 2 * u * t * cy + t * t * dy,
    };
}

// Remap global progress into a sub-window [start, end] of the timeline.
function windowT(t: number, start: number, end: number): number {
    return clamp01((t - start) / (end - start));
}

export function rowNeedsAnimation(container: HTMLElement, newText: string): boolean {
    const oldText = Array.from(container.children).map((c) => c.textContent ?? '').join('');
    return oldText !== newText;
}

export function animateRow(container: HTMLElement, newText: string, duration: number): Promise<void> {
    const oldGlyphs = measureGlyphs(container);
    const oldText = oldGlyphs.map((g) => g.ch).join('');
    if (oldText === newText) {
        return Promise.resolve();
    }
    const oldHeight = container.offsetHeight;
    const { glyphs: newGlyphs, height: newHeight } = measureNewLayout(container, newText);
    const ops: AlignOp[] = alignGlyphs(oldGlyphs.map((g) => g.ch), newGlyphs.map((g) => g.ch));

    container.classList.add('animating');
    container.style.height = `${Math.max(oldHeight, newHeight)}px`;
    container.textContent = '';

    const moveCount = ops.filter((o) => o.type === 'keep' || o.type === 'sub').length;
    const actors: Actor[] = [];
    let moveIndex = 0;
    for (const op of ops) {
        if (op.type === 'del') {
            const g = oldGlyphs[op.i];
            if (g.ch.trim() === '') continue;
            const el = makeGlyphSpan(g.ch);
            el.style.left = `${g.x}px`;
            el.style.top = `${g.y}px`;
            actors.push({
                el,
                apply: (t) => {
                    const w = easeInOutCubic(windowT(t, 0, 0.38));
                    el.style.opacity = `${1 - w}`;
                    el.style.transform = `scale(${1 - 0.7 * w}) rotate(${-25 * w}deg)`;
                },
            });
        } else if (op.type === 'ins') {
            const g = newGlyphs[op.j];
            if (g.ch.trim() === '') continue;
            const el = makeGlyphSpan(g.ch);
            el.style.left = `${g.x}px`;
            el.style.top = `${g.y}px`;
            el.style.opacity = '0';
            actors.push({
                el,
                apply: (t) => {
                    const w = easeInOutCubic(windowT(t, 0.58, 1));
                    el.style.opacity = `${w}`;
                    el.style.transform = `scale(${0.3 + 0.7 * w})`;
                },
            });
        } else {
            const from = oldGlyphs[op.i];
            const to = newGlyphs[op.j];
            const isSpace = from.ch.trim() === '' && to.ch.trim() === '';
            if (isSpace) continue;
            const el = makeGlyphSpan(from.ch);
            el.style.left = `${from.x}px`;
            el.style.top = `${from.y}px`;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const bowSign = moveIndex % 2 === 0 ? 1 : -1;
            // Staggered wave: each surviving glyph departs a little after the
            // one to its left, all arriving before the timeline ends.
            const stagger = moveCount > 1 ? (moveIndex / (moveCount - 1)) * 0.18 : 0;
            const start = stagger;
            const end = 0.82 + stagger;
            moveIndex++;
            if (op.type === 'sub' && op.kind === 'mirrorY') {
                const fromCh = from.ch;
                const toCh = to.ch;
                actors.push({
                    el,
                    finalCh: toCh,
                    apply: (t) => {
                        const w = easeInOutCubic(windowT(t, start, end));
                        const p = splineOffset(dx, dy, bowSign, w);
                        // Continuous reflection: ∧ flipped upside-down *is* ∨.
                        const scaleY = Math.cos(Math.PI * w);
                        if (w >= 0.5 && el.textContent !== toCh) {
                            // Past the flip midpoint show the target glyph,
                            // mirrored, so it un-mirrors into place.
                            el.textContent = toCh;
                        } else if (w < 0.5 && el.textContent !== fromCh) {
                            el.textContent = fromCh;
                        }
                        const s = w < 0.5 ? scaleY : -scaleY;
                        el.style.transform = `translate(${p.x}px, ${p.y}px) scaleY(${s})`;
                    },
                });
            } else if (op.type === 'sub') {
                const fromCh = from.ch;
                const toCh = to.ch;
                actors.push({
                    el,
                    finalCh: toCh,
                    apply: (t) => {
                        const w = easeInOutCubic(windowT(t, start, end));
                        const p = splineOffset(dx, dy, bowSign, w);
                        const scaleX = Math.abs(Math.cos(Math.PI * w));
                        el.textContent = w < 0.5 ? fromCh : toCh;
                        el.style.transform = `translate(${p.x}px, ${p.y}px) scaleX(${Math.max(scaleX, 0.02)})`;
                    },
                });
            } else {
                actors.push({
                    el,
                    apply: (t) => {
                        const w = easeInOutCubic(windowT(t, start, end));
                        const p = splineOffset(dx, dy, bowSign, w);
                        el.style.transform = `translate(${p.x}px, ${p.y}px)`;
                    },
                });
            }
        }
    }
    for (const actor of actors) {
        container.appendChild(actor.el);
    }

    return new Promise((resolve) => {
        const startTime = performance.now();
        const frame = (now: number) => {
            const t = clamp01((now - startTime) / duration);
            for (const actor of actors) {
                actor.apply(t);
            }
            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                renderStatic(container, newText);
                resolve();
            }
        };
        requestAnimationFrame(frame);
    });
}
