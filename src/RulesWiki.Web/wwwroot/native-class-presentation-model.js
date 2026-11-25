/** Reading-only projection of imported class records. No native record is mutated. */
import { classFamilyIdentityFields, progressionSurfaces } from "./class-family-model.js";
import { nativeRuleIdentity, validateNativeEnvelope } from "./rules-context.js";

const list = value => Array.isArray(value) ? value : [];
const validId = value => {
    try { return nativeRuleIdentity(value); } catch { return null; }
};
export function importedClassKind(record) {
    if (record?.kind === "class" && Array.isArray(record.classFeatures) && record.hd
        && !record.definition) return "class";
    if (record?.kind === "subclass" && Array.isArray(record.subclassFeatures)
        && typeof record.className === "string") return "subclass";
    return null;
}
export function nativeClassReferences(record, prefix) {
    return [...new Set(list(record?.catalogReferences).map(validId).filter(id => id?.startsWith(prefix + ".")))];
}
function parseFeature(value, kind) {
    const subclass = kind === "subclass";
    const raw = typeof value === "string" ? value : value?.[subclass ? "subclassFeature" : "classFeature"];
    if (typeof raw !== "string") return null;
    const fields = raw.split("|");
    const level = Number(fields[subclass ? 5 : 3]);
    if (!fields[0] || !fields[1] || !Number.isInteger(level) || level < 1) return null;
    // The key is strictly a local presentation occurrence, not a native ID.
    const escaped = Array.from(raw, char => /^[a-zA-Z0-9.-]$/.test(char) ? char : "~" + char.codePointAt(0).toString(16) + "~").join("");
    return { key: "imported-feature-" + escaped, raw, name: fields[0], className: fields[1],
        classSource: fields[2], level, kind: subclass ? "subclass-feature" : "class-feature",
        subclassShortName: subclass ? fields[3] : null, subclassSource: subclass ? fields[4] : null,
        source: fields[subclass ? 6 : 4] || null,
        gainSubclassFeature: value?.gainSubclassFeature === true };
}
export function createImportedClassPresentation(record) {
    const kind = importedClassKind(record);
    if (!kind) return null;
    const references = (kind === "class" ? record.classFeatures : record.subclassFeatures)
        .map(item => parseFeature(item, kind));
    const occurrences = new Map();
    const features = references.filter(Boolean).map(feature => {
        const count = (occurrences.get(feature.key) ?? 0) + 1;
        occurrences.set(feature.key, count);
        return count === 1 ? feature : { ...feature, key: feature.key + "~occurrence-" + count };
    });
    const tables = progressionSurfaces(record);
    const levels = new Set(features.map(feature => feature.level));
    // Index-based levels are already supplied by the existing class-family table model.
    for (const table of tables) {
        const column = table.columns.findIndex(value => value.key === "level");
        if (column >= 0) for (const row of table.rows)
            if (Number.isInteger(row[column])) levels.add(row[column]);
    }
    const rows = [...levels].sort((a,b) => a-b).map(level => ({
        level, featureGrants: features.filter(feature => feature.level === level).map(feature => feature.key)
    }));
    return { kind, identityFields: classFamilyIdentityFields(record, kind), rows, tables,
        features: new Map(features.map(feature => [feature.key, feature])),
        unresolvedEntries: references.map((feature, index) => feature ? null :
            (kind === "class" ? record.classFeatures[index] : record.subclassFeatures[index])).filter(value => value !== null),
        parentIds: kind === "subclass" ? nativeClassReferences(record, "class") : [],
        spellList: list(record.spellList).map(group => ({ level: group?.level,
            spellIds: [...new Set(list(group?.spellIds).map(validId).filter(id => id?.startsWith("spell.")))] })),
        record };
}
const sameSource = (actual, expected) => !expected ||
    (typeof actual === "string" && actual.toUpperCase() === expected.toUpperCase());

/** Resolve only exact IDs supplied in catalogReferences, never an ID synthesized
 * from a display name or from a 5etools tag. Current import IDs end with the
 * authored feature level; verify the loaded tuple before returning it. */
export function createImportedFeatureResolver(model, reader, context, isCurrent = () => true) {
    const requests = new Map();
    const ensureCurrent = () => { if (!isCurrent()) throw new Error("Class reading context changed."); };
    const read = id => {
        ensureCurrent();
        if (!requests.has(id)) {
            const pending = Promise.resolve().then(() => reader.resolve(id)).then(envelope => {
                ensureCurrent();
                return validateNativeEnvelope(context, id, envelope);
            });
            requests.set(id, pending);
            pending.catch(() => requests.delete(id));
        }
        return requests.get(id);
    };
    return async key => {
        const feature = model.features.get(key);
        if (!feature || !reader) throw new Error("Feature reference unavailable.");
        const candidates = nativeClassReferences(model.record, feature.kind)
            .filter(id => id.endsWith("." + feature.level));
        const envelopes = await Promise.all(candidates.map(read));
        ensureCurrent();
        const matches = envelopes.filter(({ rule }) => {
            const item = rule.definition;
            return rule.kind === feature.kind && rule.name === feature.name &&
                item.className === feature.className && item.level === feature.level &&
                sameSource(item.classSource, feature.classSource) &&
                sameSource(item.source?.abbreviation ?? item.featureSource ?? item.classSource, feature.source) &&
                (feature.kind !== "subclass-feature" ||
                    (item.subclassShortName === feature.subclassShortName &&
                        sameSource(item.subclassSource, feature.subclassSource)));
        });
        if (matches.length !== 1) throw new Error("The authoritative feature relationship is missing or ambiguous.");
        return matches[0];
    };
}
