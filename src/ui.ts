import { Axiom, Conjecture } from './axioms';
import { animateRow, renderStatic } from './anim/animator';
import { printPlainSentence, variableDisplayName } from './anim/plain-printer';
import { eq, not, varr } from './notation/builders';
import { Clause, StepContext, clauseHasEquality, extractClauses } from './notation/cnf';
import { ParseError, Registry, parseSentence } from './notation/parser';
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

const STARTER_AXIOMS = `parent: PARENT(alice, bob)
parent: PARENT(bob, carol)
grandparent rule: [PARENT(x,y)]∧[PARENT(y,z)] → GRAND(x,z)`;

const STARTER_CONJECTURES = `GRAND(alice, carol)
∃z.GRAND(alice, z)
GRAND(carol, alice)  # not entailed — watch the search fail`;

const CUSTOM_HINT = 'Your own theory. Edit the axioms and conjectures below, hit Apply, then step the pipeline or prove a conjecture. Use “✎ edit in editor” on any example to start from it.';

// Live ASCII → symbol conversion so no special keyboard is needed.
// Trailing-match pairs applied as the user types; ←> handles the case where
// <- already converted before the > of a <-> arrived.
const TYPE_ALIASES: Array<[string, string]> = [
    ['<->', '↔'], ['←>', '↔'], ['->', '→'], ['<-', '←'],
    ['&', '∧'], ['|', '∨'], ['~', '¬'], ['*', '·'],
];
const WORD_ALIAS_TRAILING = /(^|[^A-Za-z0-9_])(forall|exists)([^A-Za-z0-9_])$/;

function convertTrailing(el: HTMLTextAreaElement | HTMLInputElement): void {
    const pos = el.selectionStart ?? el.value.length;
    const value = el.value;
    const before = value.slice(0, pos);
    // Leave # comments alone.
    const lineStart = before.lastIndexOf('\n') + 1;
    if (before.slice(lineStart).includes('#')) return;
    const wordMatch = WORD_ALIAS_TRAILING.exec(before);
    if (wordMatch !== null) {
        const sym = wordMatch[2] === 'forall' ? '∀' : '∃';
        const wordStart = before.length - wordMatch[2].length - wordMatch[3].length;
        const boundary = wordMatch[3] === ' ' ? '' : wordMatch[3];
        el.value = before.slice(0, wordStart) + sym + boundary + value.slice(pos);
        const newPos = wordStart + sym.length + boundary.length;
        el.setSelectionRange(newPos, newPos);
        return;
    }
    for (const [alias, sym] of TYPE_ALIASES) {
        if (!before.endsWith(alias)) continue;
        el.value = before.slice(0, before.length - alias.length) + sym + value.slice(pos);
        const newPos = pos - alias.length + sym.length;
        el.setSelectionRange(newPos, newPos);
        return;
    }
}

// Full-text conversion for pasted content.
function convertAll(text: string): string {
    return text.split('\n').map((line) => {
        const hash = line.indexOf('#');
        let head = hash === -1 ? line : line.slice(0, hash);
        const tail = hash === -1 ? '' : line.slice(hash);
        head = head.replace(/(^|[^A-Za-z0-9_])forall(?![A-Za-z0-9_])/g, '$1∀');
        head = head.replace(/(^|[^A-Za-z0-9_])exists(?![A-Za-z0-9_])/g, '$1∃');
        head = head.replace(/([∀∃]) +/g, '$1');
        for (const [alias, sym] of TYPE_ALIASES) {
            head = head.split(alias).join(sym);
        }
        return head + tail;
    }).join('\n');
}

function attachAsciiConversion(el: HTMLTextAreaElement | HTMLInputElement): void {
    el.addEventListener('input', () => convertTrailing(el));
    el.addEventListener('paste', () => {
        setTimeout(() => {
            const converted = convertAll(el.value);
            if (converted !== el.value) el.value = converted;
        });
    });
}

// Symbol → what to type on a US keyboard. Drives the legend and the toolbar tooltips.
const KEY_HINTS: Array<[string, string]> = [
    ['∀', 'forall'], ['∃', 'exists'], ['¬', '~'], ['∧', '&'], ['∨', '|'],
    ['→', '->'], ['↔', '<->'], ['·', '*'],
];

function keyLegendHtml(intro: string): string {
    const items = KEY_HINTS
        .map(([sym, keys]) => `<span class="key-pair"><kbd>${keys.replace(/</g, '&lt;')}</kbd><span class="key-sym">${sym}</span></span>`)
        .join('');
    return `<div class="keylegend"><span class="keylegend-intro">${intro}</span>${items}</div>`;
}

interface SplitLine {
    formula: string;
    label: string;
    comment: string;
}

function splitLine(raw: string): SplitLine {
    let body = raw;
    let comment = '';
    const hash = body.indexOf('#');
    if (hash !== -1) {
        comment = body.slice(hash + 1).trim();
        body = body.slice(0, hash);
    }
    let label = '';
    const colon = body.indexOf(':');
    if (colon !== -1) {
        label = body.slice(0, colon).trim();
        body = body.slice(colon + 1);
    }
    return { formula: body.trim(), label, comment };
}

function parseTheory(axText: string, conjText: string): ExampleUI {
    const reg = new Registry();
    const axioms: Axiom[] = [];
    const conjectures: Conjecture[] = [];
    const errors: string[] = [];
    axText.split('\n').forEach((raw, ln) => {
        const { formula, label } = splitLine(raw);
        if (formula === '') return;
        try {
            axioms.push({ tree: parseSentence(formula, reg), note: label });
        } catch (err) {
            errors.push(`Axiom line ${ln + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
    });
    conjText.split('\n').forEach((raw, ln) => {
        const { formula, comment } = splitLine(raw);
        if (formula === '') return;
        try {
            conjectures.push({ tree: parseSentence(formula, reg), remark: comment || undefined });
        } catch (err) {
            errors.push(`Conjecture line ${ln + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
    });
    if (errors.length > 0) {
        throw new ParseError(errors.join('\n'));
    }
    if (axioms.length === 0) {
        throw new ParseError('The theory needs at least one axiom.');
    }
    const symbolTable = reg.applyTo(new SymbolTable());
    return { name: 'Custom ✎', hint: CUSTOM_HINT, axioms, conjectures, symbolTable };
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
        <section class="editor" id="editor" hidden>
            <div class="editor-col">
                <label for="ax-input">Axioms — one per line, optionally “label: formula”, # comments</label>
                <div class="symbar" data-for="ax-input"></div>
                <textarea id="ax-input" rows="8" spellcheck="false"></textarea>
            </div>
            <div class="editor-col">
                <label for="conj-input">Conjectures — one per line</label>
                <div class="symbar" data-for="conj-input"></div>
                <textarea id="conj-input" rows="4" spellcheck="false"></textarea>
            </div>
            <div class="editor-actions">
                <button id="btn-apply" type="button">Apply theory ▸</button>
                <span class="editor-help">Variables are single letters u–z (or anything quantifier-bound);
                other names become constants, functions, or predicates from how you use them.
                Click a symbol button above to insert it, or just type ASCII:</span>
            </div>
            ${keyLegendHtml('No special keyboard needed — these convert as you type:')}
            <pre class="editor-error" id="editor-error"></pre>
        </section>
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
                <input id="conj-typed" type="text" spellcheck="false"
                    placeholder="… or type your own, e.g. exists x. MORTAL(x)"
                    title="ASCII converts as you type: forall→∀ exists→∃ ~→¬ &→∧ |→∨ ->→→ <->→↔ *→·" />
                <button id="btn-prove" type="button">Prove ▸</button>
            </div>
            ${keyLegendHtml('Typing here converts ASCII to symbols:')}
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
    const conjTypedInput = root.querySelector<HTMLInputElement>('#conj-typed')!;
    const proveBtn = root.querySelector<HTMLButtonElement>('#btn-prove')!;
    const clausesEl = root.querySelector<HTMLElement>('#clauses')!;
    const proofEl = root.querySelector<HTMLElement>('#proof')!;
    const verdictEl = root.querySelector<HTMLElement>('#verdict')!;
    const editorEl = root.querySelector<HTMLElement>('#editor')!;
    const axInput = root.querySelector<HTMLTextAreaElement>('#ax-input')!;
    const conjInput = root.querySelector<HTMLTextAreaElement>('#conj-input')!;
    const applyBtn = root.querySelector<HTMLButtonElement>('#btn-apply')!;
    const editorErrEl = root.querySelector<HTMLElement>('#editor-error')!;

    const allExamples: ExampleUI[] = [...examples, parseTheory(STARTER_AXIOMS, STARTER_CONJECTURES)];
    const customIndex = allExamples.length - 1;
    axInput.value = STARTER_AXIOMS;
    conjInput.value = STARTER_CONJECTURES;

    const exampleTabs: HTMLButtonElement[] = allExamples.map((ex, k) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'ex-tab';
        tab.textContent = ex.name;
        tab.addEventListener('click', () => loadExample(k));
        examplesEl.appendChild(tab);
        return tab;
    });
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ex-tab ex-edit';
    editBtn.textContent = '✎ edit in editor';
    editBtn.title = 'Copy the current example into the Custom editor';
    examplesEl.appendChild(editBtn);

    const keyHintFor = new Map(KEY_HINTS);
    for (const bar of Array.from(root.querySelectorAll<HTMLElement>('.symbar'))) {
        const target = root.querySelector<HTMLTextAreaElement>(`#${bar.dataset.for}`)!;
        for (const sym of ['∀', '∃', '¬', '∧', '∨', '→', '↔', '=', '·']) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = sym;
            const hint = keyHintFor.get(sym);
            b.title = hint !== undefined ? `insert ${sym} — or just type ${hint}` : `insert ${sym}`;
            b.addEventListener('click', () => {
                const at = target.selectionStart ?? target.value.length;
                target.setRangeText(sym, at, target.selectionEnd ?? at, 'end');
                target.focus();
            });
            bar.appendChild(b);
        }
    }
    attachAsciiConversion(axInput);
    attachAsciiConversion(conjInput);
    attachAsciiConversion(conjTypedInput);

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
        return allExamples[exampleIndex];
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
        if (current().conjectures.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '— no conjectures defined —';
            conjectureSel.appendChild(opt);
            return;
        }
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
        conjTypedInput.disabled = busy;
        applyBtn.disabled = busy;
        editBtn.disabled = busy;
        if (finished && !busy && statusEl.textContent === '') {
            statusEl.textContent = 'Done — every sentence is in clausal normal form.';
        }
    }

    function loadExample(k: number, force = false): void {
        if (busy || (!force && k === exampleIndex)) return;
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
        editorEl.hidden = k !== customIndex;
        conjTypedInput.value = '';
        refreshSymtab();
        clearProver();
        populateConjectures();
        buildRows(ex.axioms);
        renderAll();
        updateChrome();
    }

    function serializeAxioms(ex: ExampleUI): string {
        return ex.axioms
            .map((a) => (a.note ? `${a.note}: ` : '') + printPlainSentence(a.tree, ex.symbolTable))
            .join('\n');
    }

    function serializeConjectures(ex: ExampleUI): string {
        return ex.conjectures
            .map((c) => printPlainSentence(c.tree, ex.symbolTable) + (c.remark ? `  # ${c.remark}` : ''))
            .join('\n');
    }

    function applyEditor(): void {
        if (busy) return;
        try {
            allExamples[customIndex] = parseTheory(axInput.value, conjInput.value);
            editorErrEl.textContent = '';
            loadExample(customIndex, true);
        } catch (err) {
            if (exampleIndex !== customIndex) {
                loadExample(customIndex, true);
            }
            editorErrEl.textContent = err instanceof Error ? err.message : String(err);
        }
    }

    function editCurrentExample(): void {
        if (busy) return;
        const ex = current();
        axInput.value = serializeAxioms(ex);
        conjInput.value = serializeConjectures(ex);
        applyEditor();
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
        let conjTree: SentenceTreeNode;
        const typed = conjTypedInput.value.trim();
        if (typed !== '') {
            try {
                const reg = Registry.fromSymbolTable(workingSt);
                conjTree = parseSentence(typed, reg);
                workingSt = reg.applyTo(workingSt);
            } catch (err) {
                verdictEl.textContent = `✗ Could not parse the conjecture: ${err instanceof Error ? err.message : String(err)}`;
                verdictEl.className = 'verdict fail';
                return;
            }
        } else {
            const conjecture = current().conjectures[parseInt(conjectureSel.value, 10)];
            if (!conjecture) {
                verdictEl.textContent = 'Pick a conjecture from the menu or type one first.';
                verdictEl.className = 'verdict';
                return;
            }
            conjTree = conjecture.tree;
        }
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
            let negated = not(conjTree);
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

            verdictEl.textContent = `Refuting: axioms ∧ ¬(${printPlainSentence(conjTree, workingSt)}) — searching for □ …`;
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
    applyBtn.addEventListener('click', applyEditor);
    editBtn.addEventListener('click', editCurrentExample);
    conjTypedInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') void doProve();
    });

    loadExample(0);
}
