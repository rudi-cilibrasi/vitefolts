
export enum ScopeId {
    GLOBAL = 0,
    LOCAL = 1,
}

export type NameId = bigint;
export type ScopedId = bigint;

const MAX_SCOPE_BITS = BigInt(40);
const MAX_SCOPE_BITS_MASK = BigInt((BigInt(1) << BigInt(MAX_SCOPE_BITS)) - BigInt(1));

// num To NameId
export function n2N(num: number): NameId {
    return BigInt(num);
}

// num to ScopeId
export function n2S(num: number): ScopeId {
    return num as ScopeId;
}

export function n2SI(scope: number, id: number): ScopedId {
    return makeScopedId(n2S(scope), n2N(id));
}

export function makeScopedId(scope: ScopeId, name: NameId): ScopedId {
    return BigInt((BigInt(scope) << BigInt(MAX_SCOPE_BITS)) + name);
}

export function getScope(id: ScopedId): ScopeId {
    const scopeBigInt = BigInt(id >> BigInt(MAX_SCOPE_BITS));
    return Number(scopeBigInt) as ScopeId;
}

export function getName(id: ScopedId): NameId {
    if (id === undefined) {
        debugger;
        return BigInt(0);
    }
    return BigInt(id & MAX_SCOPE_BITS_MASK);
}