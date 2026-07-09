import { AlignOp } from "./diff";
import { alignGlyphs } from "./diff";

// Animates a row of MathML between two renders, Nam's sprite idea done with
// DOM nodes instead of rasters:
//
// 1. The old and new formulas are both real MathML renders; the new one is
//    measured in an offscreen probe. Every token (<mi>/<mo>/<mn>) yields a
//    position plus its computed font, so typography comes from the browser's
//    math layout engine.
// 2. During the animation the MathML is swapped for absolutely-positioned
//    "sprite" spans cloned from those tokens (real text nodes — crisp at any
//    scale, no alpha masks needed).
// 3. Surviving tokens travel along quadratic Bézier splines (eased, slightly
//    staggered); mirrorY substitutions (∧ ↔ ∨) flip as a continuous
//    scaleY(1 → -1) reflection; flipX substitutions (∀ ↔ ∃, brackets) flip
//    through zero and swap at the midpoint; deletions shrink out early and
//    insertions pop in late.
// 4. At the end the sprites are replaced by the true MathML render.

interface MToken {
    text: string;
    x: number;
    y: number;
    h: number;
    fontFamily: string;
    fontSize: string;
    fontStyle: string;
}

export function renderMath(container: HTMLElement, inner: string): void {
    container.classList.remove('animating');
    container.style.removeProperty('height');
    container.dataset.mml = inner;
    container.innerHTML = `<math>${inner}</math>`;
}

export function currentMath(container: HTMLElement): string {
    return container.dataset.mml ?? '';
}

function collectTokens(container: HTMLElement): MToken[] {
    const cRect = container.getBoundingClientRect();
    const tokens: MToken[] = [];
    for (const el of Array.from(container.querySelectorAll('mi, mo, mn, mtext'))) {
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        tokens.push({
            text: el.textContent ?? '',
            x: r.left - cRect.left + container.scrollLeft,
            y: r.top - cRect.top + container.scrollTop,
            h: r.height,
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontStyle: cs.fontStyle,
        });
    }
    return tokens;
}

function measureNewLayout(container: HTMLElement, inner: string): { tokens: MToken[]; height: number } {
    const probe = document.createElement('div');
    probe.className = container.className;
    probe.classList.remove('animating');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.left = '0';
    probe.style.top = '0';
    probe.style.width = `${container.clientWidth}px`;
    container.parentElement!.appendChild(probe);
    renderMath(probe, inner);
    const tokens = collectTokens(probe);
    const height = probe.offsetHeight;
    probe.remove();
    return { tokens, height };
}

function makeSprite(token: MToken): HTMLSpanElement {
    const s = document.createElement('span');
    s.className = 'g';
    s.textContent = token.text;
    s.style.left = `${token.x}px`;
    s.style.top = `${token.y}px`;
    s.style.height = `${token.h}px`;
    s.style.lineHeight = `${token.h}px`;
    s.style.fontFamily = token.fontFamily;
    s.style.fontSize = token.fontSize;
    s.style.fontStyle = token.fontStyle;
    return s;
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

export function animateMath(container: HTMLElement, newInner: string, duration: number): Promise<void> {
    if (currentMath(container) === newInner) {
        return Promise.resolve();
    }
    const oldTokens = collectTokens(container);
    const oldHeight = container.offsetHeight;
    const { tokens: newTokens, height: newHeight } = measureNewLayout(container, newInner);
    const ops: AlignOp[] = alignGlyphs(oldTokens.map((t) => t.text), newTokens.map((t) => t.text));

    container.classList.add('animating');
    container.style.height = `${Math.max(oldHeight, newHeight)}px`;
    container.textContent = '';

    const moveCount = ops.filter((o) => o.type === 'keep' || o.type === 'sub').length;
    const actors: Actor[] = [];
    let moveIndex = 0;
    for (const op of ops) {
        if (op.type === 'del') {
            const el = makeSprite(oldTokens[op.i]);
            actors.push({
                el,
                apply: (t) => {
                    const w = easeInOutCubic(windowT(t, 0, 0.38));
                    el.style.opacity = `${1 - w}`;
                    el.style.transform = `scale(${1 - 0.7 * w}) rotate(${-25 * w}deg)`;
                },
            });
        } else if (op.type === 'ins') {
            const el = makeSprite(newTokens[op.j]);
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
            const from = oldTokens[op.i];
            const to = newTokens[op.j];
            const el = makeSprite(from);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const bowSign = moveIndex % 2 === 0 ? 1 : -1;
            // Staggered wave: each surviving token departs a little after the
            // one to its left, all arriving before the timeline ends.
            const stagger = moveCount > 1 ? (moveIndex / (moveCount - 1)) * 0.18 : 0;
            const start = stagger;
            const end = 0.82 + stagger;
            moveIndex++;
            if (op.type === 'sub' && op.kind === 'mirrorY') {
                const fromCh = from.text;
                const toCh = to.text;
                actors.push({
                    el,
                    apply: (t) => {
                        const w = easeInOutCubic(windowT(t, start, end));
                        const p = splineOffset(dx, dy, bowSign, w);
                        // Continuous reflection: ∧ flipped upside-down *is* ∨.
                        const scaleY = Math.cos(Math.PI * w);
                        if (w >= 0.5 && el.textContent !== toCh) {
                            el.textContent = toCh;
                        } else if (w < 0.5 && el.textContent !== fromCh) {
                            el.textContent = fromCh;
                        }
                        const s = w < 0.5 ? scaleY : -scaleY;
                        el.style.transform = `translate(${p.x}px, ${p.y}px) scaleY(${s})`;
                    },
                });
            } else if (op.type === 'sub') {
                const fromCh = from.text;
                const toCh = to.text;
                actors.push({
                    el,
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
                renderMath(container, newInner);
                resolve();
            }
        };
        requestAnimationFrame(frame);
    });
}
