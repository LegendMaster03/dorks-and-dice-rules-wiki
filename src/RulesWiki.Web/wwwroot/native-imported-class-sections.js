/** Native class reading sections use the shared structured renderer and exact
 * catalog identities. No option eligibility or character choices are executed. */
import { nativeClassReferences } from "./native-class-presentation-model.js";
import { validateNativeEnvelope, nativeRuleIdentity } from "./rules-context.js";
import { renderStructuredContent, renderStructuredReference } from "./native-presentation.js";
import { classReturnLink } from "./native-class-view-state.js";

const n = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = String(text);
    if (cls) el.className = cls;
    return el;
};
const section = (id, title) => {
    const el = n("section", undefined, "native-class-section");
    el.id = "native-class-" + id;
    el.append(n("h3", title));
    return el;
};
const array = value => Array.isArray(value) ? value : [];
const displayId = id => id.split(".").at(-1).replace(/-/g, " ");
export function classRuleLink(input, id, label = displayId(id)) {
    const link = renderStructuredReference(id, input, label);
    link.classList.add("native-class-rule-link");
    return link;
}
const field = (root, title, value, render) => {
    if (value === undefined || value === null) return;
    root.append(n("h4", title), render(value));
};
async function catalogRecords(input, category, current) {
    const reader = input.references;
    if (!reader) throw new Error("Related catalog unavailable.");
    const summaries = [];
    let offset = 0, total = null;
    do {
        if (!current()) throw new Error("Class reading context changed.");
        const page = await reader.search({ category, offset, limit: 100 });
        if (page.rulesetId !== input.context.rulesetId || page.fingerprint !== input.context.fingerprint ||
            !Array.isArray(page.rules) || !Number.isInteger(page.total) || page.total < 0 ||
            (total !== null && total !== page.total) ||
            page.rules.length !== Math.min(100, Math.max(0, page.total - offset)))
            throw new Error("Related catalog changed.");
        total = page.total;
        summaries.push(...page.rules.filter(rule => rule.kind === category));
        offset += page.rules.length;
        if (offset > total) throw new Error("Invalid related catalog page.");
    } while (offset < total);
    const results = [];
    const ids = [...new Set(summaries.map(rule => nativeRuleIdentity(rule.id)))];
    for (let start = 0; start < ids.length; start += 6) {
        if (!current()) throw new Error("Class reading context changed.");
        const page = await Promise.all(ids.slice(start, start + 6).map(async id =>
            validateNativeEnvelope(input.context, id, await reader.resolve(id)).rule));
        if (!current()) throw new Error("Class reading context changed.");
        results.push(...page.filter(rule => rule.kind === category));
    }
    return results;
}
function lazyCatalog(input, title, category, predicate, render, key, readCatalog) {
    const details = n("details", undefined, "native-class-disclosure");
    details.id = "native-class-catalog-" + key;
    details.setAttribute("data-class-lazy", "true");
    details.append(n("summary", title));
    const body = n("div", undefined, "native-class-feature-content");
    body.append(n("p", "Expand to load related references."));
    details.append(body);
    let loaded = false;
    const current = () => details.isConnected && (!input.lifecycle || input.lifecycle.isCurrent());
    const ready = () => {
        details.setAttribute("data-options-ready", "true");
        details.dispatchEvent(new Event("native-class-section-ready", { bubbles: true }));
    };
    details.addEventListener("toggle", async () => {
        if (!details.open || loaded || !current()) return;
        loaded = true;
        try {
            const matches = (await readCatalog(category, current)).filter(predicate);
            if (!current()) return;
            body.replaceChildren();
            if (!matches.length) body.append(n("p", "No matching records are available in this catalog."));
            for (const rule of matches) {
                const item = n("article", undefined, "native-class-option-overview");
                item.append(n("h4", rule.name), classRuleLink(input, rule.id, "View full reference"));
                field(item, "Prerequisites", rule.definition.prerequisite ?? rule.definition.prerequisites, render);
                body.append(item);
            }
            ready();
        } catch {
            if (!current()) return;
            loaded = false;
            body.replaceChildren(n("p", "Related references unavailable. Close and reopen to retry."));
            ready();
        }
    });
    return details;
}
function progressionTable(value, render) {
    if (Array.isArray(value)) return render({ type: "table", colLabels: ["Level", "Progression value"],
        rows: value.map((entry, index) => [index + 1, entry]) });
    if (value && typeof value === "object" && Object.keys(value).every(key => /^\d+$/.test(key)))
        return render({ type: "table", colLabels: ["Level", "Progression value"], rows: Object.entries(value) });
    return render(value);
}
export function importedClassSections(input, model) {
    const record = model.record, render = value => renderStructuredContent(value, { input });
    // A class view may contain multiple option groups from the same category.
    // Share one lazy read per category for this mounted snapshot, never globally.
    const categoryReads = new Map();
    const readCatalog = (category, current) => {
        if (!categoryReads.has(category)) {
            const pending = catalogRecords(input, category, current);
            categoryReads.set(category, pending);
            pending.catch(() => { if (categoryReads.get(category) === pending) categoryReads.delete(category); });
        }
        return categoryReads.get(category);
    };
    const sections = [];
    const overview = section("overview", "Overview, equipment and prerequisites");
    field(overview, "Class rules", record.entries, render);
    field(overview, "Starting equipment", record.startingEquipment?.entries ?? record.startingEquipment?.default ?? record.startingEquipment, render);
    if (record.startingEquipment?.goldAlternative !== undefined)
        field(overview, "Gold alternative", record.startingEquipment.goldAlternative, render);
    if (record.startingEquipment?.additionalFromBackground !== undefined)
        field(overview, "Additional equipment from background", record.startingEquipment.additionalFromBackground, render);
    field(overview, "Multiclassing", record.multiclassing, render);
    field(overview, "Prerequisites", record.prerequisite ?? record.prerequisites, render);
    if (overview.children.length > 1) sections.push(overview);

    const resources = section("resources", "Spellcasting and class resources");
    for (const [title, key] of [
        ["Caster progression", "casterProgression"], ["Cantrip progression", "cantripProgression"],
        ["Spells known progression", "spellsKnownProgression"], ["Prepared spells", "preparedSpells"],
        ["Prepared spells progression", "preparedSpellsProgression"], ["Prepared spell changes", "preparedSpellsChange"],
        ["Fixed spells known by level", "spellsKnownProgressionFixedByLevel"],
        ["Fixed spells known", "spellsKnownProgressionFixed"], ["Allow lower-level fixed spells", "spellsKnownProgressionFixedAllowLowerLevel"],
        ["Additional spells", "additionalSpells"]]) field(resources, title, record[key], render);
    if (resources.children.length > 1) sections.push(resources);

    const specialization = section("specializations", "Specializations and optional features");
    if (model.kind === "class" && record.subclassTitle) {
        specialization.append(n("h4", record.subclassTitle));
        if (input.references) specialization.append(lazyCatalog(input, "Browse subclasses", "subclass", rule =>
            nativeClassReferences(rule.definition, "class").includes(input.rule.id) && rule.definition.className === record.name, render, "subclasses", readCatalog));
    }
    if (model.kind === "subclass") {
        for (const id of model.parentIds) {
            const back = classReturnLink(id, input.context.fingerprint, input.context);
            const link = classRuleLink(input, id, back?.label ?? "Parent class: " + record.className);
            if (back) link.setAttribute("href", back.href);
            specialization.append(link);
        }
    }
    const classIds = model.kind === "class" ? [input.rule.id] : model.parentIds;
    for (const [index, group] of array(record.optionalfeatureProgression).entries()) {
        const panel = n("section");
        panel.append(n("h4", group.name || "Optional feature progression"), progressionTable(group.progression ?? group, render));
        if (input.references && array(group.featureType).length) panel.append(lazyCatalog(input, "Browse " + (group.name || "optional features"), "optional-feature", rule => {
            const option = rule.definition;
            const owners = nativeClassReferences(option, "class"), subclasses = nativeClassReferences(option, "subclass");
            return array(option.featureType).some(type => group.featureType.includes(type)) &&
                (!owners.length || owners.some(id => classIds.includes(id))) &&
                (!subclasses.length || subclasses.includes(input.rule.id));
        }, render, "optional-" + index, readCatalog));
        specialization.append(panel);
    }
    for (const [index, group] of array(record.featProgression).entries()) {
        const panel = n("section");
        panel.append(n("h4", group.name || "Feat progression"), progressionTable(group.progression ?? group, render));
        if (input.references && array(group.category).length) panel.append(lazyCatalog(input, "Browse " + (group.name || "feats"), "feat", rule =>
            group.category.includes(rule.definition.category), render, "feat-" + index, readCatalog));
        specialization.append(panel);
    }
    if (specialization.children.length > 1) sections.push(specialization);

    if (model.spellList.length) {
        const spells = section("spells", "Class spell list");
        for (const [index, group] of model.spellList.entries()) {
            const details = n("details", undefined, "native-class-disclosure");
            details.id = "native-class-spell-group-" + index;
            details.append(n("summary", group.level === 0 ? "Cantrips" : "Spell level " + group.level));
            const list = n("ul");
            const links = new Map();
            for (const id of group.spellIds) {
                const item = n("li");
                const link = classRuleLink(input, id);
                links.set(id, link);
                item.append(link);
                list.append(item);
            }
            let loaded = false;
            const current = () => details.isConnected && (!input.lifecycle || input.lifecycle.isCurrent());
            details.addEventListener("toggle", async () => {
                if (!details.open || loaded || !current() || !input.references) return;
                loaded = true;
                try {
                    for (let start = 0; start < group.spellIds.length; start += 6) {
                        if (!current()) return;
                        const records = await Promise.all(group.spellIds.slice(start, start + 6).map(async id =>
                            validateNativeEnvelope(input.context, id, await input.references.resolve(id)).rule));
                        if (!current()) return;
                        for (const rule of records) if (rule.kind === "spell") links.get(rule.id).textContent = rule.name;
                    }
                } catch { if (current()) loaded = false; /* Keep exact ID links when labels are unavailable. */ }
            });
            details.append(list);
            spells.append(details);
        }
        sections.push(spells);
    }
    // Preserve the complete source, including unfamiliar fields, without using
    // them to invent a class mechanic or treating imported UIDs as native IDs.
    const details = section("source-data", "Additional class data");
    const raw = n("details", undefined, "native-class-disclosure");
    raw.append(n("summary", "Complete authoritative class record"), render(record));
    details.append(raw);
    if (model.unresolvedEntries.length) field(details, "Unrecognized feature references", model.unresolvedEntries, render);
    sections.push(details);
    return sections;
}
