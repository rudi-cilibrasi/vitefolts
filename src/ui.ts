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

export interface ExampleUI {
    name: string;
    hint: string;
    axioms: Axiom[];
    symbolTable: SymbolTable;
    symbolTableHtml: string;
}

const BASE_DURATION_MS = 1500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setupApp(
    root: HTMLElement,
    examples: ExampleUI[],
    steps: PipelineStep[],
): void {
    root.innerHTML = `
        <header>
            <h1>vitefolts</h1>
            <p class="tagline">A first-order logic engine — watch axiom sets morph into negation normal form.
            Surviving symbols glide along splines; conversions like <span class="hl">∧→∨</span> and
            <span class="hl">∃→∀</span> animate as reflections.</p>
        </header>
        <section class="examples" id="examples"></section>
        <p class="hint" id="hint"></p>
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
            <div id="symtab"></div>
        </details>
        <footer>
            <a href="https://github.com/rudi-cilibrasi/vitefolts" target="_blank" rel="noopener">source on GitHub</a>
        </footer>
    `;

    const examplesEl = root.querySelector<HTMLElement>('#examples')!;
    const hintEl = root.querySelector<HTMLElement>('#hint')!;
    const pipelineEl = root.querySelector<HTMLElement>('#pipeline')!;
    const sentencesEl = root.querySelector<HTMLElement>('#sentences')!;
    const symtabEl = root.querySelector<HTMLElement>('#symtab')!;
    const statusEl = root.querySelector<HTMLElement>('#status')!;
    const stepBtn = root.querySelector<HTMLButtonElement>('#btn-step')!;
    const playBtn = root.querySelector<HTMLButtonElement>('#btn-play')!;
    const resetBtn = root.querySelector<HTMLButtonElement>('#btn-reset')!;
    const speedSel = root.querySelector<HTMLSelectElement>('#speed')!;

    const exampleTabs: HTMLButtonElement[] = examples.map((ex, k) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'ex-tab';
        tab.textContent = ex.name;
        tab.addEventListener('click', () => selectExample(k));
        examplesEl.appendChild(tab);
        return tab;
    });

    const chips: HTMLElement[] = steps.map((step) => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = step.label;
        chip.title = step.detail;
        pipelineEl.appendChild(chip);
        return chip;
    });
    const doneChip = document.createElement('div');
    doneChip.className = 'chip chip-final';
    doneChip.textContent = 'negation normal form';
    pipelineEl.appendChild(doneChip);

    let exampleIndex = -1;
    let trees: SentenceTreeNode[] = [];
    let rowGlyphEls: HTMLElement[] = [];
    let stepIndex = 0;
    let busy = false;
    // Bumped whenever state jumps (reset / example switch) so a play-all loop
    // sleeping between steps can't wake up and keep stepping the new state.
    let session = 0;

    function current(): ExampleUI {
        return examples[exampleIndex];
    }

    function buildRows(axioms: Axiom[]): void {
        sentencesEl.textContent = '';
        rowGlyphEls = [];
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
    }

    function renderAll(): void {
        trees.forEach((tree, k) => renderStatic(rowGlyphEls[k], printPlainSentence(tree, current().symbolTable)));
    }

    function updateChrome(): void {
        exampleTabs.forEach((tab, k) => {
            tab.classList.toggle('active', k === exampleIndex);
            tab.disabled = busy;
        });
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

    function selectExample(k: number): void {
        if (busy || k === exampleIndex) return;
        session++;
        exampleIndex = k;
        const ex = current();
        trees = ex.axioms.map((a) => a.tree);
        stepIndex = 0;
        statusEl.textContent = '';
        hintEl.textContent = ex.hint;
        symtabEl.innerHTML = ex.symbolTableHtml;
        buildRows(ex.axioms);
        renderAll();
        updateChrome();
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
        const symbolTable = current().symbolTable;
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
        const mySession = session;
        while (stepIndex < steps.length && !busy && session === mySession) {
            await doStep();
            await sleep(420 * durationMult());
        }
    }

    function reset(): void {
        if (busy) return;
        session++;
        trees = current().axioms.map((a) => a.tree);
        stepIndex = 0;
        statusEl.textContent = '';
        renderAll();
        updateChrome();
    }

    stepBtn.addEventListener('click', () => { void doStep(); });
    playBtn.addEventListener('click', () => { void playAll(); });
    resetBtn.addEventListener('click', reset);

    selectExample(0);
}
