
export class TruthBagInvestigationResult {
    has_implies: boolean;
    constructor() {
        this.has_implies = false;
    }
}
export class TruthBagResolver {
    constructor() {
    }
    investigate(): TruthBagInvestigationResult {
        const result = new TruthBagInvestigationResult();
        return result;
    }
}
