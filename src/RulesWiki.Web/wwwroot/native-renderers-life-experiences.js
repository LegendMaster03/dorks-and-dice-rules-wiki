/** Workstream F: first-party Life Experiences reference presentation only. */
import { DEFAULT_RULESET_ID, nativeRuleIdentity, validateNativeEnvelope } from "./rules-context.js";
import { renderNativeAttribution, renderStructuredContent, renderStructuredReference } from "./native-presentation.js";

const kinds = new Set(["upbringing", "background"]);
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const present = v => v !== undefined && v !== null;
const label = v => String(v).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());
const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (present(text)) n.textContent = String(text);
    if (cls) n.className = cls;
    return n;
};
const section = (parent, title, cls = "") => {
    const n = node("section", null, "rules-core-structured-section " + cls);
    n.append(node("h3", title, "h5"));
    parent.append(n);
    return n;
};
const details = (parent, title, value, input) => {
    if (!present(value) || (object(value) && !Object.keys(value).length) || (Array.isArray(value) && !value.length)) return;
    const n = node("details", null, "rules-core-secondary-details");
    n.append(node("summary", title), renderStructuredContent(value, { input: null }));
    parent.append(n);
};
const current = input => !input.lifecycle || input.lifecycle.isCurrent();
const payload = input => object(input.record?.definition) ? input.record.definition : input.record;
function supports(input) {
    const r = payload(input);
    return input.context.rulesetId === DEFAULT_RULESET_ID && kinds.has(input.rule.kind) &&
        object(r) && r.id === input.rule.id && r.kind === input.rule.kind;
}
// Only these authored fields carry potential catalog identities. In particular,
// choice IDs, benefit IDs, descriptive item names and bare language codes are not IDs.
const referenceFields = new Set(["skill", "competency", "spell", "language", "chooseOne", "chooseFrom",
    "exampleCompetencies", "choiceCategoryId", "equipmentTypeId", "targetId", "fromGroupIds",
    "groupIds", "itemId", "equipmentId", "catalogReferences"]);
function exactId(value) {
    try { return nativeRuleIdentity(value); } catch { return null; }
}
function collect(value, ids, field = "") {
    if (typeof value === "string" && referenceFields.has(field) && exactId(value)) ids.add(value);
    else if (Array.isArray(value)) value.forEach(v => collect(v, ids, field));
    else if (object(value)) {
        if (value.rulesetId && value.rulesetId !== DEFAULT_RULESET_ID) return;
        for (const [key, v] of Object.entries(value))
            if (!["reviewNotes", "source", "sourcePackage"].includes(key)) collect(v, ids, key);
    }
}
const selectionRule = "rule.species-subspecies-upbringing";
// Resolve a bounded number of exact authored identities, once per view.
// Optional missing targets remain text. Snapshot/authorization failures in
// required lineage/hierarchy reads propagate to the existing lifecycle.
async function resolveLinks(input, records) {
    const ids = new Set([selectionRule]);
    records.forEach(r => collect(r, ids));
    const resolved = new Map();
    if (typeof input.references?.resolve !== "function" || ids.size > 64) return resolved;
    for (const id of ids) {
        if (!current(input)) return new Map();
        try {
            const envelope = await input.references.resolve(id);
            if (!current(input)) return new Map();
            const rule = validateNativeEnvelope(input.context, id, envelope).rule;
            resolved.set(id, rule.name);
        } catch (error) {
            // Do not link unresolved/denied targets, or use an alternate reader.
            // A stale optional reference invalidates the entire view.
            if (error?.status === 409 || /snapshot|fingerprint|stale/i.test(String(error?.message))) throw error;
            if (error?.status === 401 || error?.status === 403) throw error;
        }
    }
    return resolved;
}
function reference(id, state, name) {
    const text = name ?? state.resolved.get(id) ?? id;
    return state.resolved.has(id) || state.authoritative.has(id)
        ? renderStructuredReference(id, state.input, text) : node("span", text);
}
function valueNode(v, state, field = "") {
    if (typeof v === "string" && referenceFields.has(field) && exactId(v)) return reference(v, state);
    if (Array.isArray(v)) {
        const list = node("ul", null, "mb-1");
        for (const x of v) {
            const li = node("li");
            li.append(valueNode(x, state, field)); list.append(li);
        }
        return list;
    }
    if (object(v)) {
        if (v.rulesetId && v.rulesetId !== DEFAULT_RULESET_ID) return renderStructuredContent(v, { input: null });
        const dl = node("dl", null, "rules-core-inline-details");
        for (const [key, entry] of Object.entries(v)) if (present(entry)) {
            const dd = node("dd"); dd.append(valueNode(entry, state, key));
            dl.append(node("dt", label(key)), dd);
        }
        return dl;
    }
    return renderStructuredContent(v, { input: null });
}
function fields(parent, value, state, consumed) {
    const extra = Object.fromEntries(Object.entries(value).filter(([k, v]) => !consumed.has(k) && present(v)));
    if (Object.keys(extra).length) parent.append(valueNode(extra, state));
}
function provenance(parent, state, source, pointer) {
    const p = node("p", null, "small text-muted");
    p.append(document.createTextNode("Source: "), reference(source.id, state, source.name));
    // Exact occurrence identity stays available without displaying repository
    // branch, commit or file paths as gameplay metadata.
    p.dataset.sourceId = source.id;
    p.dataset.sourcePointer = pointer;
    parent.append(p);
}
const grantLabels = {
    "skill-training": "Skill training", "competency-training": "Competency training",
    "qualification-training": "Equipment qualification", "benefit-choice": "Alternative training benefits",
    "background-feature": "Background feature", "upbringing-feature": "Upbringing feature"
};
function grantLabel(b) {
    if (b.grantType) return grantLabels[b.grantType] ?? label(b.grantType);
    if (present(b.language) || present(b.extraLanguages)) return "Language training";
    if (present(b.bonus) || present(b.proficiencyBonusMultiplier)) return "Scoped check modifier";
    if (b.spell) return "Spellcasting";
    return "Benefit";
}
function qualification(parent, q, state, source, pointer) {
    if (!object(q)) { if (present(q)) parent.append(valueNode(q, state)); return; }
    const block = node("div", null, "mt-2");
    block.append(node("h5", "Equipment proficiency requirements"));
    block.append(node("p", "Training details for the authored benefits above; these do not grant equipment ownership.", "small"));
    for (const [group, entries] of Object.entries(q)) {
        block.append(node("h6", group === "fixed" ? "Fixed qualifications" : group === "choices" ? "Qualification choices" : label(group)));
        if (!Array.isArray(entries)) { block.append(valueNode(entries, state)); continue; }
        entries.forEach((entry, i) => {
            const row = node("div", null, "mb-2");
            if (object(entry) && present(entry.count)) row.append(node("p", "Choose " + entry.count, "fw-semibold"));
            row.append(valueNode(entry, state));
            provenance(row, state, source, pointer + "/" + group + "/" + i);
            block.append(row);
        });
    }
    parent.append(block);
}
function benefit(parent, b, state, source, pointer) {
    if (!object(b)) { parent.append(valueNode(b, state)); return; }
    const block = node("div", null, "border rounded p-3 mb-2");
    block.append(node("h4", b.name ?? label(b.id ?? grantLabel(b)), "h6"));
    block.append(node("p", grantLabel(b), "small fw-semibold"));
    if (present(b.description)) block.append(renderStructuredContent(b.description, { input: null }));
    if (present(b.choiceCount)) block.append(node("p", "Choose " + b.choiceCount + (b.distinctChoices ? " distinct options" : ""), "fw-semibold"));
    if (present(b.extraLanguages)) block.append(node("p", "Learn " + b.extraLanguages + " additional language(s)", "fw-semibold"));
    if (object(b.competencyTraining)) {
        const t = b.competencyTraining;
        if (present(t.ranks)) block.append(node("p", "Ranks granted: " + t.ranks));
        if (typeof t.proficient === "boolean") block.append(node("p", "Proficiency granted: " + (t.proficient ? "Yes" : "No")));
        fields(block, t, state, new Set(["ranks", "proficient"]));
    }
    // Keep every option branch nested inside its outer choice. No controls or
    // selected state exist in the reference reader.
    if (Array.isArray(b.options)) {
        const list = node("ol", null, "ps-3");
        b.options.forEach((option, i) => {
            const li = node("li", null, "mb-2");
            if (!object(option)) li.append(valueNode(option, state));
            else {
                li.append(node("h5", option.name ?? label(option.id ?? "Option"), "h6"));
                if (Array.isArray(option.benefits)) option.benefits.forEach((child, j) =>
                    benefit(li, child, state, source, pointer + "/options/" + i + "/benefits/" + j));
                qualification(li, option.equipmentProficiencyGrants, state, source, pointer + "/options/" + i + "/equipmentProficiencyGrants");
                fields(li, option, state, new Set(["id", "name", "benefits", "equipmentProficiencyGrants"]));
                provenance(li, state, source, pointer + "/options/" + i);
            }
            list.append(li);
        });
        block.append(list);
    }
    qualification(block, b.equipmentProficiencyGrants, state, source, pointer + "/equipmentProficiencyGrants");
    fields(block, b, state, new Set(["id", "name", "grantType", "description", "choiceCount", "extraLanguages",
        ...(object(b.competencyTraining) ? ["competencyTraining"] : []),
        ...(Array.isArray(b.options) ? ["options"] : []),
        "equipmentProficiencyGrants"]));
    provenance(block, state, source, pointer);
    parent.append(block);
}
function benefits(parent, source, state) {
    const r = source.definition;
    if (Array.isArray(r.benefits) && r.benefits.length) r.benefits.forEach((b, i) => benefit(parent, b, state, source, "/benefits/" + i));
    else if (present(r.benefits) && !Array.isArray(r.benefits)) parent.append(valueNode(r.benefits, state));
    else parent.append(node("p", "No benefits are supplied in this record."));
    qualification(parent, r.equipmentProficiencyGrants, state, source, "/equipmentProficiencyGrants");
}
// This is a local authored cross-reference for display, not an eligible
// option calculation. Ambiguous or absent IDs are left unresolved.
function uniqueLocalId(entries, id) {
    if (!Array.isArray(entries) || typeof id !== "string") return null;
    const matches = entries.filter(entry => object(entry) && entry.id === id);
    return matches.length === 1 ? matches[0] : null;
}
function equipment(parent, equipment, state, source) {
    const s = section(parent, "Starting equipment", "life-experience-equipment");
    s.append(node("p", "Ordinary inventory described by this Background, separate from training and qualifications.", "small"));
    if (!object(equipment)) { s.append(valueNode(equipment, state)); return; }
    if (present(equipment.description)) s.append(renderStructuredContent(equipment.description, { input: null }));
    if (Array.isArray(equipment.items)) equipment.items.forEach((item, i) => {
        const block = node("div", null, "border rounded p-2 mb-2");
        if (!object(item)) block.append(valueNode(item, state));
        else {
            block.append(node("h4", (item.name ?? "Item") + (present(item.quantity) ? " × " + item.quantity : ""), "h6"));
            if (present(item.choiceCount)) block.append(node("p", "Choose " + item.choiceCount));
            const choice = uniqueLocalId(source.definition.benefits, item.sourceBenefitChoiceId);
            if (present(item.sourceBenefitChoiceId)) {
                const related = node("p", "Related training choice: " + (choice?.name ?? item.sourceBenefitChoiceId), "small");
                related.dataset.sourceBenefitChoiceId = item.sourceBenefitChoiceId;
                block.append(related);
            }
            if (Array.isArray(item.conditionalItemChoices)) {
                block.append(node("h5", "Conditional item choices", "h6"));
                item.conditionalItemChoices.forEach((condition, j) => {
                    if (!object(condition)) { block.append(valueNode(condition, state)); return; }
                    const branch = node("div", null, "border rounded p-2 mb-2");
                    if (present(condition.whenOptionId)) {
                        const option = uniqueLocalId(choice?.options, condition.whenOptionId);
                        branch.append(node("h6", "When " + (option?.name ?? condition.whenOptionId) + " is chosen"));
                        branch.dataset.whenOptionId = condition.whenOptionId;
                    }
                    fields(branch, condition, state, new Set(["whenOptionId"]));
                    provenance(branch, state, source, "/startingEquipment/items/" + i + "/conditionalItemChoices/" + j);
                    block.append(branch);
                });
            }
            fields(block, item, state, new Set(["name", "quantity", "choiceCount", "sourceBenefitChoiceId",
                ...(Array.isArray(item.conditionalItemChoices) ? ["conditionalItemChoices"] : [])]));
        }
        provenance(block, state, source, "/startingEquipment/items/" + i);
        s.append(block);
    });
    if (present(equipment.currency)) {
        s.append(node("h4", "Currency", "h6"), valueNode(equipment.currency, state));
    }
    fields(s, equipment, state, new Set(["description", "currency", ...(Array.isArray(equipment.items) ? ["items"] : [])]));
}
const knownRecord = new Set(["id", "name", "kind", "status", "rulesStatus", "selectable", "description", "parent",
    "allowParentSelection", "benefits", "equipmentProficiencyGrants", "startingEquipment", "suggestedCharacteristics",
    "suggestedSchemes", "suggestedSpecialties", "reviewNotes", "source", "sourcePackage"]);
function extraRecord(parent, record, state) {
    const extras = Object.fromEntries(Object.entries(record).filter(([k]) => !knownRecord.has(k)));
    details(parent, "Additional authored fields", extras, state.input);
    details(parent, "Historical review notes (not current rules)", record.reviewNotes, state.input);
    // The complete record preserves unknown nested fields and exact local IDs.
    details(parent, "Original authored record", record, state.input);
}
function baseArticle(input, r) {
    const article = node("article", null, "card card-body mb-3 native-reference-article life-experience-reader");
    article.style.overflowWrap = "anywhere";
    article.style.minWidth = "0";
    article.append(node("h2", input.rule.name), node("p", label(input.rule.kind), "text-muted"));
    for (const key of ["status", "rulesStatus"])
        if (present(r[key])) article.append(node("p", label(key) + ": " + r[key], "small"));
    article.append(node("p", "Selectable: " + (r.selectable === true ? "Yes" : r.selectable === false ? "No" : "Not supplied"), "small"));
    if (present(r.description)) article.append(renderStructuredContent(r.description, { input: null }));
    return article;
}
export async function renderLifeExperience(input) {
    if (!supports(input)) throw new Error("Unsupported Life Experiences record.");
    const r = payload(input), reader = input.references;
    const upbringing = r.kind === "upbringing";
    if (!current(input)) return node("article");
    let lineage = [{ id: r.id, name: r.name, kind: r.kind, definition: r, inheritedSource: false }];
    let suggestions = [];
    if (upbringing) {
        if (reader?.originReferenceContractVersion !== 1) throw new Error("Upbringing reference contract is unavailable.");
        const source = await reader.originSource(r.id);
        if (!current(input)) return node("article");
        lineage = source.lineage;
        if (lineage.some(row => row.kind !== "upbringing") || lineage.at(-1)?.id !== r.id)
            throw new Error("Invalid Upbringing reference lineage.");
        const biological = await reader.originHierarchy("biological");
        if (!current(input)) return node("article");
        suggestions = biological.rows.filter(row => row.defaultUpbringingId === r.id);
    }
    const state = { input, resolved: await resolveLinks(input, lineage.map(row => row.definition)),
        authoritative: new Set([...lineage.map(row => row.id), ...suggestions.map(row => row.id)]) };
    if (!current(input)) return node("article");
    const article = baseArticle(input, r);
    if (upbringing) {
        const chain = section(article, "Parent lineage");
        const list = node("ol");
        for (const row of lineage) {
            const li = node("li");
            li.append(reference(row.id, state, row.name));
            if (row.definition.selectable === false) li.append(document.createTextNode(" (inheritance-only; not independently selectable)"));
            list.append(li);
        }
        chain.append(list, node("p", "Select one effective Upbringing. A Species or Ancestry suggestion is neither a restriction nor an additional grant. A selected child inherits its parent benefits once."));
        if (r.selectable === false) chain.append(node("p", "This parent is readable but contributes only through a selected child."));
        for (const row of lineage) {
            const s = section(article, (row.inheritedSource ? "Inherited benefits — " : "Local benefits — ") + row.name,
                row.inheritedSource ? "life-experience-inherited" : "life-experience-local");
            benefits(s, row, state);
            if (row.inheritedSource) extraRecord(s, row.definition, state);
        }
        const s = section(article, "Authored Species and Ancestry suggestions", "life-experience-suggestions");
        s.append(node("p", "Suggestions only; no Species restriction or additional benefit is implied."));
        if (!suggestions.length) s.append(node("p", "No authored suggestions reference this Upbringing."));
        else {
            const list = node("ul");
            for (const row of suggestions) { const li = node("li"); li.append(reference(row.id, state, row.name)); list.append(li); }
            s.append(list);
        }
    } else {
        benefits(section(article, "Training and features"), lineage[0], state);
    }
    if (present(r.startingEquipment)) equipment(article, r.startingEquipment, state, lineage.at(-1));
    for (const [key, title] of [["suggestedCharacteristics", "Suggested characteristics"], ["suggestedSchemes", "Suggested schemes"], ["suggestedSpecialties", "Suggested specialties"]])
        if (present(r[key])) section(article, title).append(valueNode(r[key], state));
    const rules = section(article, "Applicable rules");
    rules.append(reference(selectionRule, state, "Character Origin Selection and Inheritance"),
        node("p", "Duplicate training and authorized choices are governed by Rules Core. This reader does not apply grants, create inventory, or choose replacements."));
    extraRecord(article, r, state);
    if (r !== input.record) details(article, "Additional record context", Object.fromEntries(Object.entries(input.record).filter(([k]) => k !== "definition")), input);
    article.append(renderNativeAttribution(input));
    // Life Experience fields can be nested several choice levels deep. A
    // resizable desktop pane is not necessarily wide enough for max-content
    // label columns, even when the viewport is wide. Keep this adapter's
    // field stacks and list indents bounded independently of shared CSS.
    for (const dl of article.querySelectorAll(".rules-core-inline-details")) {
        dl.style.gridTemplateColumns = "minmax(0, 1fr)";
        dl.style.minWidth = "0";
    }
    for (const field of article.querySelectorAll(".rules-core-inline-details > dt, .rules-core-inline-details > dd"))
        field.style.minWidth = "0";
    for (const list of article.querySelectorAll("ul, ol")) list.style.paddingInlineStart = "1.2rem";
    // The existing native-rule-detail decorator owns the package notice.
    return article;
}
export function registerLifeExperienceRenderers(registry) {
    registry.register({ id: "origins.life-experiences", priority: 50, supports, render: renderLifeExperience });
}
