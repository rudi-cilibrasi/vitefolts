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
            playTone(ac, event.freq, noteMs);
        }
        step++;
        setTimeout(tick, noteMs);
    };
    tick();
}

function playTone(ac: AudioContext, freq: number, ms: number): void {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = ac.currentTime;
    const dur = ms / 1000;
    // Short attack/decay so notes are plucky, not droning.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur);
}
