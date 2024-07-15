import { ScopedId } from './scope';
import { SymbolType } from './symbol-type';


export class SymbolTableEntry {
    id: ScopedId;
    name: string;
    stype: SymbolType;
    arity: number;
    is_infix: boolean;
    constructor(id: ScopedId, name: string, stype: SymbolType, arity: number, is_infix: boolean) {
        this.id = id;
        this.name = name;
        this.stype = stype;
        this.arity = arity;
        this.is_infix = is_infix;
    }
}