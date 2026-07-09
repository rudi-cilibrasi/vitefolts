import { Axiom, Conjecture } from './axioms';
import { animateRow, renderStatic } from './anim/animator';
import { printPlainSentence, variableDisplayName } from './anim/plain-printer';
import { eq, not, varr } from './notation/builders';
import { Clause, StepContext, clauseHasEquality, extractClauses } from './notation/cnf';
import { Proof, ProverEnv, SideRef, prove } from './notation/resolution';
import { n2SI, ScopedId } from './notation/scope';
import { SentenceTreeNode } from './notation/sentence-tree-node';
import { SymbolTable } from './notation/symbol-table';
import { print_symbol_table } from './notation/symbol-table-printer';

export interface PipelineStep {
    label: string;
    detail: string;
    transform: (s: SentenceTreeNode, ctx: StepContext) => SentenceTreeNode;
}

export interface ExampleUI {
    name: string;
    hint: string;
    axioms: Axiom[];
    conjectures: Conjecture[];
    symbolTable: SymbolTable;
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
            <p class="tagline">A first-order logic engine — watch axiom sets morph into clausal form,
            then watch a refutation proof unfold. Surviving symbols glide along splines; conversions like
            <span class="hl">∧→∨</span> and <span class="hl">∃→∀</span> animate as reflections.</p>
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
        <section class="prover">
            <h2>Prove a conjecture <span class="sub">linear resolution + paramodulation</span></h2>
            <p class="prover-blurb">Pick a conjecture φ. The prover negates it, converts everything to
            clauses, and searches for the empty clause □ — a refutation of axioms ∧ ¬φ. Each derivation
            animates: the parent clauses fuse, the resolved literals annihilate, and unified variables
            morph into their substituted terms.</p>
            <div class="prover-controls">
                <select id="conjecture"></select>
                <button id="btn-prove" type="button">Prove ▸</button>
            </div>
            <div class="clauses" id="clauses"></div>
            <div class="clauses proof" id="proof"></div>
            <p class="verdict" id="verdict"></p>
        </section>
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
    const conjectureSel = root.querySelector<HTMLSelectElement>('#conjecture')!;
    const proveBtn = root.querySelector<HTMLButtonElement>('#btn-prove')!;
    const clausesEl = root.querySelector<HTMLElement>('#clauses')!;
    const proofEl = root.querySelector<HTMLElement>('#proof')!;
    const verdictEl = root.querySelector<HTMLElement>('#verdict')!;

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
    doneChip.textContent = 'clausal form';
    pipelineEl.appendChild(doneChip);

    let exampleIndex = -1;
    let trees: SentenceTreeNode[] = [];
    let rowGlyphEls: HTMLElement[] = [];
    let stepIndex = 0;
    let busy = false;
    // Bumped whenever state jumps (reset / example switch) so a play-all loop
    // sleeping between steps can't wake up and keep stepping the new state.
    let session = 0;
    // Working symbol table: starts as the example's table and grows as the
    // pipeline mints Skolem functions and the prover renames variables.
    let workingSt: SymbolTable;
    let skolemCounter = 0;
    let freshVarCounter = 0;

    const ctx: StepContext = {
        freshSkolem(arity: number): ScopedId {
            skolemCounter++;
            const id = n2SI(0, 500 + skolemCounter);
            workingSt = workingSt.add_function(id, `σ${skolemCounter}`, arity, false);
            return id;
        },
    };

    const proverEnv: ProverEnv = {
        freshVar(base: ScopedId): ScopedId {
            freshVarCounter++;
            const id = n2SI(3, freshVarCounter);
            const name = variableDisplayName(base, workingSt) + '′';
            workingSt = workingSt.add_variable(id, name);
            return id;
        },
    };

    function current(): ExampleUI {
        return examples[exampleIndex];
    }

    function litToString(positive: boolean, atom: SentenceTreeNode): string {
        return positive ? printPlainSentence(atom, workingSt) : printPlainSentence(not(atom), workingSt);
    }

    function clauseToString(clause: Clause): string {
        if (clause.literals.length === 0) return '□';
        return '{' + clause.literals.map((l) => litToString(l.positive, l.atom)).join(', ') + '}';
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
        trees.forEach((tree, k) => renderStatic(rowGlyphEls[k], printPlainSentence(tree, workingSt)));
    }

    function refreshSymtab(): void {
        symtabEl.innerHTML = print_symbol_table(workingSt);
    }

    function clearProver(): void {
        clausesEl.textContent = '';
        proofEl.textContent = '';
        verdictEl.textContent = '';
        verdictEl.className = 'verdict';
    }

    function populateConjectures(): void {
        conjectureSel.textContent = '';
        current().conjectures.forEach((c, k) => {
            const opt = document.createElement('option');
            opt.value = String(k);
            const text = printPlainSentence(c.tree, current().symbolTable);
            opt.textContent = c.remark ? `${text}   (${c.remark})` : text;
            conjectureSel.appendChild(opt);
        });
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
        proveBtn.disabled = busy;
        conjectureSel.disabled = busy;
        if (finished && !busy && statusEl.textContent === '') {
            statusEl.textContent = 'Done — every sentence is in clausal normal form.';
        }
    }

    function selectExample(k: number): void {
        if (busy || k === exampleIndex) return;
        session++;
        exampleIndex = k;
        const ex = current();
        workingSt = ex.symbolTable;
        skolemCounter = 0;
        freshVarCounter = 0;
        trees = ex.axioms.map((a) => a.tree);
        stepIndex = 0;
        statusEl.textContent = '';
        hintEl.textContent = ex.hint;
        refreshSymtab();
        clearProver();
        populateConjectures();
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
        const newTrees = trees.map((t) => step.transform(t, ctx));
        const newTexts = newTrees.map((t) => printPlainSentence(t, workingSt));
        const oldTexts = trees.map((t) => printPlainSentence(t, workingSt));
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
        refreshSymtab();
        busy = false;
        updateChrome();
        if (stepIndex >= steps.length) {
            statusEl.textContent = 'Done — every sentence is in clausal normal form.';
        }
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
        const ex = current();
        workingSt = ex.symbolTable;
        skolemCounter = 0;
        freshVarCounter = 0;
        trees = ex.axioms.map((a) => a.tree);
        stepIndex = 0;
        statusEl.textContent = '';
        refreshSymtab();
        clearProver();
        renderAll();
        updateChrome();
    }

    interface NumberedClause {
        clause: Clause;
        label: string;
    }

    function addClauseRow(container: HTMLElement, num: number, label: string, text: string): HTMLElement {
        const row = document.createElement('div');
        row.className = 'clause-row pop-in';
        const numEl = document.createElement('div');
        numEl.className = 'clause-num';
        numEl.textContent = `(${num})`;
        const glyphs = document.createElement('div');
        glyphs.className = 'glyphs glyphs-clause';
        const src = document.createElement('div');
        src.className = 'clause-src';
        src.textContent = label;
        row.appendChild(numEl);
        row.appendChild(glyphs);
        row.appendChild(src);
        container.appendChild(row);
        renderStatic(glyphs, text);
        return row;
    }

    function substToString(pairs: Array<[ScopedId, SentenceTreeNode]>): string {
        if (pairs.length === 0) return 'σ = {}';
        const parts = pairs.map(([id, term]) =>
            `${variableDisplayName(id, workingSt)} ↦ ${printPlainSentence(term, workingSt)}`);
        return `σ = {${parts.join(', ')}}`;
    }

    async function animateProof(numbered: NumberedClause[], proof: Proof): Promise<void> {
        const duration = BASE_DURATION_MS * durationMult();
        // Numbers assigned to derived clauses as they appear.
        const derivedNums: number[] = [];
        let nextNum = numbered.length + 1;
        let centerClause = numbered[proof.startIndex].clause;
        let centerNum = proof.startIndex + 1;

        const refNum = (ref: SideRef): number => {
            if (ref.kind === 'input') return ref.index + 1;
            // derived[0] is the start clause; derived[i] is the resolvent of step i-1.
            return ref.index === 0 ? proof.startIndex + 1 : derivedNums[ref.index - 1];
        };

        for (const step of proof.steps) {
            const num = nextNum++;
            derivedNums.push(num);
            const resolventText = clauseToString(step.resolvent);
            const centerText = clauseToString(centerClause);
            let startText: string;
            let info: string;
            if (step.kind === 'factor') {
                startText = centerText;
                info = `factor (${centerNum}) with ${substToString(step.substPairs)}`;
            } else {
                const sideText = clauseToString(step.sideRenamed!);
                startText = `${centerText} ⊗ ${sideText}`;
                const verb = step.kind === 'paramodulate' ? 'paramodulate' : 'resolve';
                info = `${verb} (${centerNum}) with (${refNum(step.sideRef!)}), ${substToString(step.substPairs)}`;
            }
            const row = addClauseRow(proofEl, num, step.kind, startText);
            const glyphs = row.querySelector<HTMLElement>('.glyphs')!;
            const infoEl = document.createElement('div');
            infoEl.className = 'step-info';
            row.appendChild(infoEl);
            await sleep(150 * durationMult());
            await animateRow(glyphs, resolventText, duration);
            infoEl.textContent = info;
            infoEl.classList.add('visible');
            centerClause = step.resolvent;
            centerNum = num;
            await sleep(280 * durationMult());
        }
    }

    async function doProve(): Promise<void> {
        if (busy) return;
        const conjIndex = parseInt(conjectureSel.value, 10);
        const conjecture = current().conjectures[conjIndex];
        if (!conjecture) return;
        clearProver();

        // Make sure the displayed pipeline has run to clausal form first.
        const mySession = session;
        while (stepIndex < steps.length) {
            await doStep();
            if (session !== mySession) return;
        }

        busy = true;
        updateChrome();
        statusEl.textContent = '';

        try {
            // Clausify axioms (already in CNF) and the negated conjecture.
            const numbered: NumberedClause[] = [];
            const ex = current();
            trees.forEach((tree, k) => {
                for (const clause of extractClauses(tree)) {
                    numbered.push({ clause, label: ex.axioms[k].note });
                }
            });
            let negated = not(conjecture.tree);
            for (const step of steps) {
                negated = step.transform(negated, ctx);
            }
            const sosIndices: number[] = [];
            for (const clause of extractClauses(negated)) {
                sosIndices.push(numbered.length);
                numbered.push({ clause, label: '¬ conjecture' });
            }
            if (numbered.some((n) => clauseHasEquality(n.clause))) {
                const x = n2SI(1, 0);
                numbered.push({ clause: { literals: [{ positive: true, atom: eq(varr(x), varr(x)) }] }, label: 'reflexivity' });
            }
            refreshSymtab();

            verdictEl.textContent = `Refuting: axioms ∧ ¬(${printPlainSentence(conjecture.tree, ex.symbolTable)}) — searching for □ …`;
            for (let i = 0; i < numbered.length; i++) {
                addClauseRow(clausesEl, i + 1, numbered[i].label, clauseToString(numbered[i].clause));
                await sleep(90 * durationMult());
            }

            const proof = prove(numbered.map((n) => n.clause), sosIndices, proverEnv);
            if (proof === null) {
                verdictEl.textContent = '✗ No refutation found within the search limits — the conjecture does not follow from these axioms (or needs a deeper proof).';
                verdictEl.className = 'verdict fail';
            } else {
                await animateProof(numbered, proof);
                verdictEl.textContent = `□ Empty clause derived in ${proof.steps.length} step${proof.steps.length === 1 ? '' : 's'} — contradiction. The conjecture is a theorem.`;
                verdictEl.className = 'verdict ok';
            }
        } catch (err) {
            verdictEl.textContent = `✗ Prover error: ${err instanceof Error ? err.message : String(err)}`;
            verdictEl.className = 'verdict fail';
            throw err;
        } finally {
            busy = false;
            updateChrome();
        }
    }

    stepBtn.addEventListener('click', () => { void doStep(); });
    playBtn.addEventListener('click', () => { void playAll(); });
    resetBtn.addEventListener('click', reset);
    proveBtn.addEventListener('click', () => { void doProve(); });

    selectExample(0);
}
