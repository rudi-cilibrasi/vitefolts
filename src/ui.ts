import { Axiom } from './axioms';
import { animateRow, renderStatic } from './anim/animator';
import { printPlainSentence } from './anim/plain-printer';
import { SentenceTreeNode } from './notation/sentence-tree-node';
import { SymbolTable } from './notation/symbol-table';

export interface PipelineStep {
    label: string;
    detail: string;
    transform: (s: SentenceTreeNode) => SentenceTreeNode;
}

const BASE_DURATION_MS = 1500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setupApp(
    root: HTMLElement,
    axioms: Axiom[],
    steps: PipelineStep[],
    symbolTable: SymbolTable,
    symbolTableHtml: string,
): void {
    root.innerHTML = `
        <header>
            <h1>vitefolts</h1>
            <p class="tagline">A first-order logic engine — watch the Peano axioms morph into negation normal form.
            Surviving symbols glide along splines; conversions like <span class="hl">∧→∨</span> and
            <span class="hl">∃→∀</span> animate as reflections.</p>
        </header>
        <section class="pipeline" id="pipeline"></section>
        <section class="controls">
            <button id="btn-step" type="button">Step ▸</button>
            <button id="btn-play" type="button">Play all ▸▸</button>
            <button id="btn-reset" type="button">↺ Reset</button>
            <label class="speed-label">speed
                <select id="speed">
                    <option value="2">slow</option>
                    <option value="1" selected>normal</option>
                    <option value="0.5">fast</option>
                </select>
            </label>
            <span class="status" id="status"></span>
        </section>
        <section class="sentences" id="sentences"></section>
        <details class="symbols">
            <summary>Symbol table</summary>
            ${symbolTableHtml}
        </details>
        <footer>
            <a href="https://github.com/rudi-cilibrasi/vitefolts" target="_blank" rel="noopener">source on GitHub</a>
        </footer>
    `;

    const pipelineEl = root.querySelector<HTMLElement>('#pipeline')!;
    const sentencesEl = root.querySelector<HTMLElement>('#sentences')!;
    const statusEl = root.querySelector<HTMLElement>('#status')!;
    const stepBtn = root.querySelector<HTMLButtonElement>('#btn-step')!;
    const playBtn = root.querySelector<HTMLButtonElement>('#btn-play')!;
    const resetBtn = root.querySelector<HTMLButtonElement>('#btn-reset')!;
    const speedSel = root.querySelector<HTMLSelectElement>('#speed')!;

    const chips: HTMLElement[] = [];
    for (const step of steps) {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = step.label;
        chip.title = step.detail;
        pipelineEl.appendChild(chip);
        chips.push(chip);
    }
    const doneChip = document.createElement('div');
    doneChip.className = 'chip chip-final';
    doneChip.textContent = 'negation normal form';
    pipelineEl.appendChild(doneChip);

    const rowGlyphEls: HTMLElement[] = [];
    for (const axiom of axioms) {
        const row = document.createElement('div');
        row.className = 'sentence-row';
        const label = document.createElement('div');
        label.className = 'row-label';
        label.textContent = axiom.note;
        const glyphs = document.createElement('div');
        glyphs.className = 'glyphs';
        row.appendChild(label);
        row.appendChild(glyphs);
        sentencesEl.appendChild(row);
        rowGlyphEls.push(glyphs);
    }

    let trees: SentenceTreeNode[] = axioms.map((a) => a.tree);
    let stepIndex = 0;
    let busy = false;

    function renderAll(): void {
        trees.forEach((tree, k) => renderStatic(rowGlyphEls[k], printPlainSentence(tree, symbolTable)));
    }

    function updateChrome(): void {
        chips.forEach((chip, k) => {
            chip.classList.toggle('done', k < stepIndex);
            chip.classList.toggle('current', k === stepIndex);
        });
        doneChip.classList.toggle('current', stepIndex >= steps.length);
        const finished = stepIndex >= steps.length;
        stepBtn.disabled = busy || finished;
        playBtn.disabled = busy || finished;
        resetBtn.disabled = busy;
        speedSel.disabled = busy;
        if (finished && !busy) {
            statusEl.textContent = 'Done — every sentence is in negation normal form.';
        }
    }

    function durationMult(): number {
        return parseFloat(speedSel.value);
    }

    async function doStep(): Promise<void> {
        if (busy || stepIndex >= steps.length) return;
        busy = true;
        const step = steps[stepIndex];
        statusEl.textContent = step.detail;
        updateChrome();
        const newTrees = trees.map(step.transform);
        const newTexts = newTrees.map((t) => printPlainSentence(t, symbolTable));
        const oldTexts = trees.map((t) => printPlainSentence(t, symbolTable));
        const anyChange = newTexts.some((t, k) => t !== oldTexts[k]);
        if (anyChange) {
            const duration = BASE_DURATION_MS * durationMult();
            await Promise.all(rowGlyphEls.map((el, k) => animateRow(el, newTexts[k], duration)));
        } else {
            statusEl.textContent = `${step.detail} — no change needed.`;
            await sleep(400 * durationMult());
        }
        trees = newTrees;
        stepIndex++;
        busy = false;
        updateChrome();
    }

    async function playAll(): Promise<void> {
        while (stepIndex < steps.length && !busy) {
            await doStep();
            await sleep(420 * durationMult());
        }
    }

    function reset(): void {
        if (busy) return;
        trees = axioms.map((a) => a.tree);
        stepIndex = 0;
        statusEl.textContent = '';
        renderAll();
        updateChrome();
    }

    stepBtn.addEventListener('click', () => { void doStep(); });
    playBtn.addEventListener('click', () => { void playAll(); });
    resetBtn.addEventListener('click', reset);

    renderAll();
    updateChrome();
}
