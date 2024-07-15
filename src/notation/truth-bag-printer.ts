import { TruthBag } from "./truth-bag";
import { printSentenceTree } from "./sentence-tree-printer";
import { print_symbol_table } from "./symbol-table-printer";

export function printTruthBagHtml(truthBag: TruthBag): string {
    let result: string = ''
    result += print_symbol_table(truthBag.symbol_table)
    result += "<br/>"
    result += "<table><tr><th>Sentences</th></tr>"
    const sentences = truthBag.sentences;
    for (const sentence of sentences) {
        result += `<tr><td>${printSentenceTree(sentence, truthBag.symbol_table)}</td></tr>`
    }
    result += "</table>"
    return result
}