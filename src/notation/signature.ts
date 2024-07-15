export type SymbolSignature = number;

export const SymbolSignaturePredicateMask = 0x00040000;
export const SymbolSignatureFunctionMask = 0x00020000;
export const SymbolSignatureVariableMask = 0x00010000;
export const SymbolSignatureInfixMask = 0x01000000;
export const SymbolSignaturePrefixMask = 0x02000000;
export const SymbolSignatureArityMask = 0x0000FFFF;
