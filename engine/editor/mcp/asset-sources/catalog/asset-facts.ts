import type { AssetFact } from './asset-source';
export function collectFacts(candidates: Readonly<Record<string, AssetFact | null>>): Record<string, AssetFact> {
    const facts: Record<string, AssetFact> = {};
    for (const [name, fact] of Object.entries(candidates)) {
        if (fact !== null && fact !== '')
            facts[name] = fact;
    }
    return facts;
}
