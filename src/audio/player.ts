import { NoteEvent } from './sonify';

// Minimal Web Audio playback for a melody (issue #48). No external assets —
// notes are synthesized with an oscillator. A single shared AudioContext is
// created lazily on first user gesture (browsers require that).

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) return null; // Web Audio unavailable
    ctx = new Ctor();
    return ctx;
}

// A monotonically increasing token so a new play (or stop) supersedes any
// in-flight sequence.
let activeToken = 0;

export function stopMelody(): void {
    activeToken++;
}

// The audio device takes a moment to actually start producing sound after it
// is first resumed, so notes scheduled immediately after the very first press
// get clipped. Warm it up once — resume, prime with an inaudible tick, and
// wait — so the first press pauses ~1s and every later press plays instantly.
const WARMUP_MS = 1000;
let warmup: Promise<void> | null = null;

function ensureWarm(ac: AudioContext | null): Promise<void> {
    if (warmup !== null) return warmup;
    warmup = (async () => {
        if (ac === null) return;
        try {
            await ac.resume();
        } catch { /* ignore */ }
        try {
            const gain = ac.createGain();
            gain.gain.value = 0.0001; // inaudible priming tone
            const osc = ac.createOscillator();
            osc.frequency.value = 220;
            osc.connect(gain).connect(ac.destination);
            osc.start();
            osc.stop(ac.currentTime + 0.05);
        } catch { /* ignore */ }
        await new Promise<void>((resolve) => setTimeout(resolve, WARMUP_MS));
    })();
    return warmup;
}

export interface PlayOptions {
    direction?: 'forward' | 'reverse';
    noteMs?: number;
    // Called as each event fires, with its index into the ORIGINAL events
    // array (so callers can highlight the matching token regardless of direction).
    onStep?: (index: number, event: NoteEvent) => void;
    onDone?: () => void;
}

export function playMelody(events: NoteEvent[], opts: PlayOptions = {}): void {
    const noteMs = opts.noteMs ?? 260;
    const indices = events.map((_, i) => i);
    const order = opts.direction === 'reverse' ? indices.reverse() : indices;

    const ac = audioContext();
    if (ac !== null && ac.state === 'suspended') void ac.resume();

    const token = ++activeToken;
    let step = 0;
    const tick = (): void => {
        if (token !== activeToken) return; // superseded or stopped
        if (step >= order.length) {
            opts.onDone?.();
            return;
        }
        const idx = order[step];
        const event = events[idx];
        opts.onStep?.(idx, event);
        if (event.kind === 'note' && ac !== null) {
            playTone(ac, event.freq, noteMs, event.role);
        }
        step++;
        setTimeout(tick, noteMs);
    };
    // The first press waits for the one-time device warm-up; later presses
    // find it already resolved and start immediately.
    void ensureWarm(ac).then(() => {
        if (token === activeToken) tick();
    });
}

function playTone(ac: AudioContext, freq: number, ms: number, role: string): void {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = ac.currentTime;

    if (role === 'name') {
        // Constants and predicates are tuned percussive hits (a mallet/tom):
        // a constant pitch — no sweep, so the pitch is clear — with a punchy
        // attack and a short decay. Distinct names read as different beats, so
        // e.g. L and R in wolf-goat-cabbage are easy to tell apart.
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.34, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.26);
        return;
    }

    osc.type = 'triangle';
    osc.frequency.value = freq;
    const dur = ms / 1000;
    // Short attack/decay so notes are plucky, not droning.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur);
}
