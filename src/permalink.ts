// Encode a custom theory (axioms + conjectures text) into a URL-safe string so
// it can live in the location hash and localStorage — a shareable, reloadable
// theory with no backend.

interface Theory {
    axioms: string;
    conjectures: string;
}

function toBase64Url(json: string): string {
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodeTheory(axioms: string, conjectures: string): string {
    return toBase64Url(JSON.stringify({ a: axioms, c: conjectures }));
}

export function decodeTheory(encoded: string): Theory | null {
    try {
        const obj = JSON.parse(fromBase64Url(encoded));
        if (obj !== null && typeof obj.a === 'string' && typeof obj.c === 'string') {
            return { axioms: obj.a, conjectures: obj.c };
        }
        return null;
    } catch {
        return null;
    }
}
