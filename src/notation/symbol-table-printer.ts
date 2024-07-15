import { SymbolTable } from "./symbol-table";
import { SymbolType } from "./symbol-type";

function describe_symbol_type(stype: SymbolType): string {
    switch (stype) {
        case SymbolType.FUNCTION: return "Function";
        case SymbolType.PREDICATE: return "Predicate";
        case SymbolType.VARIABLE: return "Variable";
        default: return "Unknown";
    }
}

export function print_symbol_table(st: SymbolTable): string {
    let result: string = '';
    result += "<table><tr><th>Name</th><th>Type</th><th>Arity</th></tr>";

    for (const ste of st.all_entries()) {
        result += `<tr><td>${ste.name}</td><td>${describe_symbol_type(ste.stype)}</td><td>${ste.arity}</td></tr>`;
    }
    result += "</table>";
    return result;
}