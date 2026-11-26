/** Workstream D: reference-only first-party characteristic presentation.
 * No character grants, parameter resolution, pricing calculation or route ownership.
 */
import { renderStructuredContent, renderStructuredReference, renderNativeAttribution } from "./native-presentation.js";
import { DEFAULT_RULESET_ID, nativeRuleIdentity, assertSnapshot } from "./rules-context.js";
import { renderStructuredRule } from "./rule-renderers-specialized.js";

const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const has = v => v !== null && v !== undefined && v !== "";
const own = (o,k) => Object.hasOwn(o,k);
const label = k => String(k).replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/[-_]/g," ").replace(/^./, c => c.toUpperCase());
const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = String(text);
    if (cls) n.className = cls;
    return n;
};
const append = (n,...children) => { n.append(...children); return n; };
const current = input => !input.lifecycle || input.lifecycle.isCurrent();
const contextKeys = ["rulesetId","fingerprint","campaignId","campaignRevisionId"];
const sameContext = (a,b) => !!a && !!b && contextKeys.every(k => (a[k] ?? null) === (b[k] ?? null));
const metadata = new Set(["id","name","kind","source","sourcePackage"]);
const wrapper = input => object(input.record?.definition) && input.record.id === input.rule.id
    ? input.record.definition : input.record;
export function supportsOriginCharacteristic(input) {
    const r = wrapper(input);
    return input.context.rulesetId === DEFAULT_RULESET_ID && input.rule.kind === "origin-trait" &&
        object(r) && r.id === input.rule.id && r.kind === "origin-trait" && object(r.trait);
}
const groups = [
    ["Activation and timing", ["activation","trigger","timing","reaction","when","requiredCharacterLevel","rollAdvantage"]],
    ["Saving throws and checks", ["savingThrow","savingThrows","abilityCheck","attackRoll"]],
    ["Uses and recovery", ["uses","freeUses","recharge","resourcePool","sharedUsesFromTrait","slotCasting"]],
    ["Duration", ["duration","durationMinutes","durationRounds","durationHours"]],
    ["Damage and resistance", ["damage","damageResistance","resistances","damageImmunity"]],
    ["Senses and movement", ["sense","rangeFeet","movementMode","speedFeet","walkingSpeedFeet","climbSpeedFeet","flySpeedFeet","swimSpeedFeet","burrowSpeedFeet"]],
    ["Innate spells and choices", ["spell","spellList","spellChoices","spells","level","replacement","spellcastingAbility","grantType","featCategory","choiceCount","choices","requiredChoices"]],
    ["Progression", ["progression","hitPointsPerCharacterLevel","additionalRanksAtCharacterLevel1","additionalRanksPerSubsequentCharacterLevel"]],
    ["Restrictions and applicability", ["requiresOperationalComponent","restriction","restrictions","prerequisites","requiresTraitDefinitionId","allocation","obeysNormalSkillRankLimits"]],
    ["Source-bound parameters", ["originBindings","areaFrom","typeFrom"]],
    ["Inheritance and recombination", ["originComposition","inheritance","recombination"]]
];
const fieldLabels = {
    dc:"Save DC", onSuccess:"On success", value:"Value", recharge:"Recovery",
    level:"Character level", originBindings:"Parameter bindings", spellList:"Spell list",
    freeUses:"Free uses", slotCasting:"Slot casting", percent:"Percent",
    hitPointsPerCharacterLevel:"Maximum HP per character level",
    sourceField:"Source field", lookup:"Lookup", requiredChoices:"Required choices",
    originComposition:"Composition", requiresOperationalComponent:"Requires operational component"
};
const fieldLabel = k => fieldLabels[k] ?? label(k);
const token = v => typeof v === "string" && /^[a-z]+(?:-[a-z]+)+$/.test(v) ? label(v) : v;
const yesNo = v => typeof v === "boolean" ? (v ? "Yes" : "No") : v;
const readable = (k,v) => {
    if (typeof v === "boolean") return yesNo(v);
    if (typeof v === "number" && k.endsWith("Feet")) return v + " ft.";
    if (typeof v === "number" && k === "percent") return v + "%";
    if (typeof v === "number" && k.endsWith("Minutes")) return v + " min.";
    if (typeof v === "number" && k.endsWith("Hours")) return v + " hr.";
    if (typeof v === "number" && k.endsWith("Rounds")) return v + " rounds";
    // Formulas, exact identities, source fields and arbitrary text remain literal.
    if (["action","timing","replaces","ability","recharge","outcome","declarationTiming","activation","sense","movementMode","damageType","grantType","when","onSuccess","replacement"].includes(k)
        || (k === "value" && v === "proficiency-bonus")) return token(v);
    return v;
};
const referenceFields = new Set(["ruleId","traitId","canonicalTraitId","requiresTraitDefinitionId","spellId","targetId"]);
function exactReference(key, value, input) {
    if (!referenceFields.has(key) || typeof value !== "string") return null;
    try { nativeRuleIdentity(value); } catch { return null; }
    return renderStructuredReference(value,input);
}
/** Shared table renderer handles responsive overflow and inert text. Unknown columns survive. */
function progressionTable(rows,input) {
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const columns = ["characterLevel", ...keys.filter(k => k !== "characterLevel")];
    return renderStructuredContent({type:"table",colLabels:columns.map(fieldLabel),
        rows:rows.map(r => columns.map(k => own(r,k) ? readable(k,r[k]) : "—"))}, {input});
}
function fields(value,input,key="",depth=0) {
    if (depth > 64) return renderStructuredContent(value,{input});
    if (key === "progression" && Array.isArray(value) && value.length &&
        value.every(r => object(r) && Number.isInteger(r.characterLevel)))
        return progressionTable(value,input);
    if (key === "dc" && typeof value === "string") return node("code",value);
    const link = exactReference(key,value,input);
    if (link) return link;
    if (Array.isArray(value)) {
        const list = node("ul",undefined,"rules-core-rule-list");
        for (const x of value) list.append(append(node("li"),fields(x,input,key,depth+1)));
        return list;
    }
    if (object(value)) {
        // Keep explicit foreign scope and structured entries under common renderer control.
        if (typeof value.rulesetId === "string" || own(value,"entries") || own(value,"markdown") || own(value,"catalogReferences"))
            return renderStructuredContent(value,{input});
        const dl = node("dl",undefined,"rules-core-inline-details");
        for (const [k,v] of Object.entries(value))
            dl.append(node("dt",fieldLabel(k)),append(node("dd"),fields(v,input,k,depth+1)));
        return dl;
    }
    return renderStructuredContent(readable(key,value),{input});
}
function section(root,title,body) {
    root.append(append(node("section",undefined,"rules-core-structured-section"),
        node("h3",title,"h5"),body));
}
function fieldGroup(root,title,entries,input) {
    if (entries.length) section(root,title,fields(Object.fromEntries(entries),input));
}
function scopedReader(input) {
    if (!input.references || input.references.originReferenceContractVersion !== 1) return null;
    if (!sameContext(input.context,input.references.context)) throw Error("Characteristic reader context mismatch.");
    return input.references;
}
function assertOccurrenceRequest(input,request) {
    if (!sameContext(input.context,request?.context) || request.canonicalTraitId !== input.rule.id)
        throw Error("Characteristic occurrence snapshot or identity mismatch.");
    nativeRuleIdentity(request.selectedSourceId);
    nativeRuleIdentity(request.sourceId);
    if (typeof request.path !== "string" || !/^\/traits\/(0|[1-9][0-9]*)$/.test(request.path))
        throw Error("Invalid characteristic occurrence path.");
}
/** C/B supply selected lineage identity AND defining occurrence; no name-based lookup.
 * Returns authoritative data only. A missing directReference remains unresolved.
 */
export async function readCharacteristicOccurrence(input,request) {
    assertOccurrenceRequest(input,request);
    const reader = scopedReader(input);
    if (!reader) throw Error("Characteristic occurrence reference unavailable.");
    if (!current(input)) return null;
    const projection = assertSnapshot(input.context,await reader.originSource(request.selectedSourceId));
    if (!current(input)) return null;
    if (projection.sourceId !== request.selectedSourceId || projection.contractVersion !== 1)
        throw Error("Invalid characteristic source projection.");
    const source = projection.lineage.find(r => r.id === request.sourceId);
    const matches = source?.traitOccurrences.filter(o => o.sourceId === request.sourceId &&
        o.path === request.path && o.canonicalTraitId === request.canonicalTraitId) ?? [];
    if (matches.length !== 1) throw Error("Characteristic occurrence is not present in the selected lineage.");
    const candidates = (projection.directReference?.candidates ?? []).filter(c =>
        c.sourceId === request.sourceId && c.path === request.path);
    return {source, selected:projection.lineage.at(-1), occurrence:matches[0], candidates,
        directReferenceAvailable:projection.directReference !== null && projection.directReference !== undefined};
}
function renderOccurrence(root,input,context,canonical) {
    const {source,selected,occurrence,candidates,directReferenceAvailable} = context;
    const body = node("div");
    body.append(append(node("p"),node("strong","Selected lineage: "),renderStructuredReference(selected.id,input,selected.name)));
    body.append(append(node("p"),node("strong","Defining source: "),renderStructuredReference(source.id,input,source.name)));
    if (source.inheritedSource) body.append(node("p","Inherited source occurrence; not an active character manifestation."));
    if (candidates.length) {
        for (const c of candidates) {
            if (object(c.authoredParameters) && Object.keys(c.authoredParameters).length)
                body.append(fields(c.authoredParameters, input));
            const offer = Object.fromEntries(Object.entries(c).filter(([key]) =>
                !["sourceId", "path", "slot", "authoredParameters"].includes(key)));
            if (Object.keys(offer).length)
                body.append(append(node("details", undefined, "rules-core-secondary-details"),
                    node("summary", c.slot ? "Source offer — " + label(c.slot) : "Source offer"), fields(offer, input)));
        }
    } else body.append(node("p",directReferenceAvailable ?
        "No exact configured offer supplied for this occurrence. Parameters remain unresolved." :
        "Direct-reference configuration unavailable. Parameters remain unresolved."));
    const bindings = object(canonical.originBindings) ? Object.keys(canonical.originBindings) : [];
    for (const key of bindings) {
        if (!candidates.some(c => object(c.authoredParameters) && own(c.authoredParameters,key) && has(c.authoredParameters[key])))
            body.append(node("p",fieldLabel(key)+": unresolved in this reference."));
    }
    // Expanded occurrence can contain authored overrides; show it separately, never merge into canonical.
    body.append(append(node("details"),node("summary","Expanded source occurrence"),fields(occurrence.trait,input)));
    section(root,"Configured source occurrence",body);
}
function sourceList(root,input,projection) {
    const body = node("div");
    if (!projection.sources.length) body.append(node("p","No source relationships returned by the current catalog."));
    for (const [relation,title] of [["biological-occurrence","Biological source occurrences"],
        ["construct-operational-reference","Construct operational references"]]) {
        const list = node("ul",undefined,"rules-core-rule-list");
        for (const source of projection.sources.filter(s => s.relation === relation)) {
            list.append(append(node("li"),renderStructuredReference(source.sourceId,input,source.name ?? source.sourceId),
                node("span"," · "+source.path)));
        }
        if (list.childNodes.length) body.append(node("h4",title,"h6"),list);
    }
    section(root,"Source relationships",body);
}
export async function renderOriginCharacteristic(input,{occurrence = null} = {}) {
    if (!supportsOriginCharacteristic(input)) throw Error("Unsupported characteristic record.");
    const r = wrapper(input), trait = r.trait, reader = scopedReader(input);
    if (!current(input)) return null;
    // Read at most one reverse projection and one explicitly selected lineage. No source fan-out.
    const relationships = reader ? assertSnapshot(input.context,await reader.originTraitSources(input.rule.id)) : null;
    if (!current(input)) return null;
    if (relationships && (relationships.traitId !== input.rule.id || relationships.contractVersion !== 1 || relationships.complete !== true))
        throw Error("Invalid characteristic relationship projection.");
    const configured = occurrence ? await readCharacteristicOccurrence(input,occurrence) : null;
    if (!current(input)) return null;
    const operational = trait.requiresOperationalComponent === true ||
        relationships?.sources.some(s => s.relation === "construct-operational-reference");
    const root = renderStructuredRule(r,{nativeTitle:input.rule.name,renderContent:v=>renderStructuredContent(v,{input})},{
        summary:[["Reference type", configured ? "Configured characteristic" : operational ? "Construct operational characteristic" : "Canonical characteristic"],
            ["Rules status", r.rulesStatus ?? r.status ?? trait.rulesStatus ?? trait.status]],
        sections:[]});
    root.classList.add("card","card-body","mb-3","native-reference-article","native-origin-characteristic");
    if (configured) renderOccurrence(root, input, configured, trait);
    root.append(node("p","Reference only. This view does not establish ownership, eligibility or activation."));
    if (has(trait.description)) section(root, configured ? "Canonical rules" : "Description", renderStructuredContent(trait.description, {input}));
    const used = new Set(["id","name","description","reviewNotes"]);
    for (const [title,keys] of groups) {
        const entries = keys.filter(k=>own(trait,k)&&has(trait[k])).map(k=>[k,trait[k]]);
        entries.forEach(([k])=>used.add(k));
        if (title === "Inheritance and recombination" && own(r,"originComposition") && has(r.originComposition))
            entries.push(["authoredComposition",r.originComposition]);
        fieldGroup(root,title,entries,input);
    }
    if (!configured && object(trait.originBindings) && Object.keys(trait.originBindings).length)
        section(root,"Configuration",node("p","Source-bound parameters are unresolved in this canonical reference."));
    fieldGroup(root,"Additional characteristic fields",Object.entries(trait).filter(([k])=>!used.has(k)),input);
    const remaining = Object.entries(r).filter(([k])=>!metadata.has(k)&&!["trait","originComposition","reviewNotes"].includes(k));
    fieldGroup(root,"Additional definition fields",remaining,input);
    if (r !== input.record) fieldGroup(root,"Record context",Object.entries(input.record).filter(([k])=>!metadata.has(k)&&k!=="definition"),input);
    for (const notes of [r.reviewNotes,trait.reviewNotes].filter(has))
        root.append(append(node("details",undefined,"rules-core-secondary-details"),
            node("summary","Historical review notes (not current rules)"),renderStructuredContent(notes,{input})));
    if (relationships) sourceList(root,input,relationships);
    else section(root,"Source relationships",node("p","Source relationship reference unavailable for this catalog snapshot."));
    root.append(renderNativeAttribution(input));
    return root;
}
export function registerOriginCharacteristicRenderer(registry, {requireCapability = false} = {}) {
    registry.register({id:"origins.characteristic",priority:40,
        supports:input=>supportsOriginCharacteristic(input) && (!requireCapability || input.references?.originReferenceContractVersion === 1),
        render:input=>renderOriginCharacteristic(input,{occurrence:input.originOccurrence ?? null})});
}
