/** Workstream C: first-party biological reference only. No inheritance resolver. */
import { DEFAULT_RULESET_ID, assertSnapshot, nativeRuleIdentity, snapshotKey } from "./rules-context.js";
import { renderStructuredContent, renderStructuredReference, renderNativeAttribution } from "./native-presentation.js";

const kinds = new Set(["species", "ancestry"]);
const text = value => String(value ?? "Unresolved");
const label = key => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, x => x.toUpperCase());
const node = (tag, value, cls) => {
    const n = document.createElement(tag);
    if (value !== undefined) n.textContent = text(value);
    if (cls) n.className = cls;
    return n;
};
const section = (title, ...children) => {
    const n = node("section", undefined, "rules-core-structured-section");
    n.append(node("h3", title), ...children);
    return n;
};
const disclosure = (title, child) => {
    const n = node("details"); n.append(node("summary", title), child); return n;
};
const format = (value, input) => value == null ? node("span", "Unresolved / not supplied") : renderStructuredContent(value, { input });
const contextMatches = (a, b) => snapshotKey(a) === snapshotKey(b);

export function supportsBiologicalReader(reader) {
    return reader?.context?.rulesetId === DEFAULT_RULESET_ID &&
        reader.originReferenceContractVersion === 1 &&
        typeof reader.originHierarchy === "function" && typeof reader.originSource === "function";
}

export function createBiologicalHierarchy(envelope, context) {
    assertSnapshot(context, envelope);
    if (context.rulesetId !== DEFAULT_RULESET_ID || envelope.contractVersion !== 1 ||
        envelope.family !== "biological" || envelope.complete !== true || !Array.isArray(envelope.rows))
        throw new Error("Complete biological reference hierarchy required.");
    const rows = new Map(), children = new Map(), roots = [];
    for (const row of envelope.rows) {
        nativeRuleIdentity(row.id);
        if (rows.has(row.id) || !kinds.has(row.kind)) throw new Error("Invalid biological hierarchy identity.");
        rows.set(row.id, row); children.set(row.id, []);
    }
    for (const row of rows.values()) {
        if (row.parentId == null) roots.push(row);
        else {
            if (!rows.has(row.parentId)) throw new Error("Incomplete biological hierarchy.");
            children.get(row.parentId).push(row);
        }
    }
    function chain(id) {
        const result = [], seen = new Set();
        while (id != null) {
            if (seen.has(id) || !rows.has(id)) throw new Error("Invalid biological parent chain.");
            seen.add(id);
            const row = rows.get(id); result.unshift(row); id = row.parentId;
        }
        return result;
    }
    for (const id of rows.keys()) chain(id);
    // Search the complete bounded family. Retain ancestors of every match.
    function visible(query) {
        const q = query.trim().toLowerCase();
        if (!q) return new Set(rows.keys());
        const result = new Set();
        for (const row of rows.values())
            if (row.name.toLowerCase().includes(q) || row.id.includes(q))
                for (const ancestor of chain(row.id)) result.add(ancestor.id);
        return result;
    }
    return { rows, children, roots, chain, visible };
}

export function biologicalDetailModel(hierarchy, source, context) {
    assertSnapshot(context, source);
    const selected = hierarchy.rows.get(source.sourceId);
    if (context.rulesetId !== DEFAULT_RULESET_ID || source.contractVersion !== 1 || !selected ||
        !Array.isArray(source.lineage)) throw new Error("Invalid biological source projection.");
    const expected = hierarchy.chain(selected.id);
    if (source.lineage.length !== expected.length || source.lineage.some((row, i) =>
        row.id !== expected[i].id || row.kind !== expected[i].kind ||
        row.inheritedSource !== (row.id !== selected.id)))
        throw new Error("Biological source lineage does not match hierarchy.");
    if (source.directReference != null && (source.directReference.referenceOnly !== true ||
        selected.selectable !== true)) throw new Error("Invalid direct biological reference.");
    const direct = source.directReference;
    const occurrences = source.lineage.flatMap(row => row.traitOccurrences.map(occurrence => ({
        ...occurrence, sourceName: row.name, inherited: row.inheritedSource,
        occurrenceKey: JSON.stringify([row.id, occurrence.path]),
        bindings: (direct?.candidates ?? []).filter(c => c.sourceId === row.id && c.path === occurrence.path)
    })));
    return { selected, lineage: source.lineage, occurrences, direct,
        effectiveProjectionAvailable: source.effectiveProjectionAvailable };
}

/** One reader/lease per mounted workspace. No global cache or cross-snapshot reuse. */
export function createBiologicalReader({ reader, isCurrent }) {
    if (!supportsBiologicalReader(reader) || typeof isCurrent !== "function")
        throw new Error("Authorized biological reader and current workspace lease required.");
    let active = true, hierarchyPromise, revision = 0;
    const current = () => active && isCurrent();
    async function hierarchy() {
        if (!current()) return null;
        hierarchyPromise ??= reader.originHierarchy("biological").then(value =>
            createBiologicalHierarchy(value, reader.context));
        try {
            const value = await hierarchyPromise;
            return current() ? value : null;
        } catch (error) {
            hierarchyPromise = null;
            if (current()) throw error;
            return null;
        }
    }
    return {
        hierarchy,
        async select(id) {
            const token = ++revision;
            try {
                const tree = await hierarchy();
                if (!tree || !current() || token !== revision) return null;
                if (!tree.rows.has(id)) throw new Error("Unknown biological reference.");
                const source = await reader.originSource(id);
                if (!current() || token !== revision) return null;
                return biologicalDetailModel(tree, source, reader.context);
            } catch (error) {
                if (!current() || token !== revision) return null;
                throw error;
            }
        },
        dispose() { active = false; revision++; hierarchyPromise = null; }
    };
}

function status(row) {
    return row.selectable === false ? "Not directly selectable" :
        row.selectable === true ? "Selectable reference (subject to authored restrictions)" : "Selectability unresolved";
}

/** B owns the outer panes and route. Native details/summary and links are keyboard
 * operable without pretending to implement an ARIA tree keyboard contract. */
export function renderBiologicalIndex(tree, input, { selectedId = null, onNavigate = null, state = {} } = {}) {
    const root = node("nav", undefined, "origin-biological-index");
    root.setAttribute("aria-label", "Species and Ancestries");
    const searchLabel = node("label", "Search Species and Ancestries");
    const search = node("input"); search.type = "search"; search.className = "form-control";
    search.value = state.query ?? ""; searchLabel.append(search);
    const results = node("div"); const count = node("p");
    count.setAttribute("role", "status");
    root.append(searchLabel, count, results);
    const expanded = state.expanded ??= new Set();
    if (tree.rows.has(selectedId)) for (const row of tree.chain(selectedId).slice(0, -1)) expanded.add(row.id);
    function draw() {
        const shown = tree.visible(search.value);
        function list(rows) {
            const ul = node("ul", undefined, "list-unstyled ps-3");
            for (const row of rows.filter(x => shown.has(x.id))) {
                const li = node("li");
                const link = renderStructuredReference(row.id, input, row.name);
                if (row.id === selectedId) link.setAttribute("aria-current", "page");
                if (onNavigate && link.tagName === "A") link.addEventListener("click", event => {
                    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                    event.preventDefault(); onNavigate(row.id);
                });
                const caption = node("small", row.selectable === false ? " · Not directly selectable" : "");
                const children = tree.children.get(row.id).filter(x => shown.has(x.id));
                if (children.length) {
                    const group = node("details");
                    group.open = !!search.value.trim() || expanded.has(row.id);
                    group.append(node("summary", row.name + " descendants"), list(children));
                    // Parent link remains reachable even while descendants are collapsed.
                    li.append(link, caption, group);
                    group.addEventListener("toggle", () => {
                        if (search.value.trim() || !group.isConnected) return;
                        if (group.open) expanded.add(row.id); else expanded.delete(row.id);
                    });
                } else li.append(link, caption);
                ul.append(li);
            }
            return ul;
        }
        results.replaceChildren(list(tree.roots));
        count.textContent = shown.size + " reference records (including matching ancestors)";
    }
    search.addEventListener("input", () => { state.query = search.value; draw(); });
    draw(); return root;
}

function referenceInput(input, row) {
    // Keep the exact qualified link function and reader supplied by B.
    return { ...input, rule: { id: row.id, name: row.name, kind: row.kind },
        record: row.definition, source: row.definition.source ?? null,
        sourcePackage: row.definition.sourcePackage ?? null };
}
function offerTable(offers, model, input, fixed = false) {
    const list = node("dl");
    for (const offer of offers) {
        const origin = model.lineage.find(x => x.id === offer.sourceId);
        const title = node("dt", label(offer.slot ?? "Characteristic") + " — " + (origin?.name ?? offer.sourceId));
        const body = node("dd");
        if (fixed) body.append(format(offer.value, input));
        else {
            for (const key of ["offeredValue", "authoredParameters", "requiredChoices", "unresolvedEvidence", "sourceRestriction"])
                if (offer[key] != null) body.append(node("h5", label(key)), format(offer[key], input));
        }
        list.append(title, body);
    }
    if (!offers.length) list.append(node("dd", "No values supplied by this projection."));
    return list;
}
export function renderBiologicalDetail(model, input) {
    if (!supportsBiologicalReader(input.references) || !contextMatches(input.context, input.references.context))
        throw new Error("Biological detail context mismatch.");
    const article = node("article", undefined, "origin-biological-detail");
    const selected = model.selected, own = model.lineage.at(-1), definition = own.definition;
    const breadcrumb = node("nav");
    breadcrumb.setAttribute("aria-label", "Biological lineage");
    model.lineage.forEach((row, index) => {
        if (index) breadcrumb.append(node("span", " / "));
        breadcrumb.append(renderStructuredReference(row.id, input, row.name));
    });
    article.append(breadcrumb, node("h2", selected.name), node("p", status(selected)),
        node("p", "Status: " + text(selected.rulesStatus ?? selected.status)),
        node("p", "Reference only. Authored source offers and inherited reference values are not effective character grants or eligibility."));
    if (definition.description != null) article.append(format(definition.description, input));
    if (model.direct) {
        article.append(section("Fixed intrinsic reference offers", offerTable(model.direct.fixedValues, model, input, true)),
            section("Source offers, bindings, restrictions and choices", offerTable(model.direct.candidates, model, input)));
        if (model.direct.issues?.length) article.append(section("Unresolved reference issues", format(model.direct.issues, input)));
    } else article.append(section("Direct reference", node("p", "No direct reference projection is supplied for this record. Authored source evidence remains readable.")));
    const sourceSection = section("Authored lineage and characteristics");
    for (const row of model.lineage) {
        const block = node("section");
        block.append(node("h4", row.name + (row.inheritedSource ? " — Inherited source" : " — Selected source")));
        const authored = Object.fromEntries(Object.entries(row.definition).filter(([key]) =>
            !["id", "kind", "name", "traits", "reviewNotes", "source", "sourcePackage", "description"].includes(key)));
        block.append(disclosure("Authored source properties and other fields", format(authored, input)));
        for (const key of ["creatureType", "size", "sizeChoice", "walkingSpeedFeet", "climbingSpeedFeet", "swimmingSpeedFeet", "flyingSpeedFeet", "overridesAncestorWalkingSpeed", "acquisitionMethods"])
            if (Object.hasOwn(row.definition, key)) block.append(node("h5", label(key)), format(row.definition[key], input));
        for (const occurrence of model.occurrences.filter(o => o.sourceId === row.id)) {
            const trait = occurrence.trait;
            const item = node("section", undefined, "origin-characteristic-occurrence");
            item.dataset.occurrenceKey = occurrence.occurrenceKey;
            const heading = node("h5");
            const name = trait.name ?? occurrence.localId ?? "Characteristic";
            heading.append(occurrence.canonicalTraitId
                ? renderStructuredReference(occurrence.canonicalTraitId, input, name)
                : node("span", name + " (inline source definition)"));
            item.append(heading, node("p", row.name + (occurrence.inherited ? " — Inherited reference occurrence" : " — Own authored occurrence")));
            const { reviewNotes, ...content } = trait;
            item.append(format(content, input));
            if (occurrence.bindings.length) item.append(disclosure("Configured source bindings", offerTable(occurrence.bindings, model, input)));
            if (reviewNotes != null) item.append(disclosure("Historical review notes (not rules)", format(reviewNotes, input)));
            block.append(item);
        }
        if (row.definition.reviewNotes != null)
            block.append(disclosure("Historical review notes (not rules)", format(row.definition.reviewNotes, input)));
        block.append(renderNativeAttribution(referenceInput(input, row)));
        sourceSection.append(block);
    }
    article.append(sourceSection);
    const upbringing = selected.defaultUpbringingId
        ? renderStructuredReference(selected.defaultUpbringingId, input)
        : node("p", "No suggested Upbringing is authored for this record.");
    article.append(section("Suggested Upbringing", upbringing),
        section("Biological Origination and inheritance",
            node("p", "A Species/Ancestry definition lineage is not an individual's Heritage. Direct reference selection and mixed biological inheritance are distinct; inherited instances are not automatically expressed Manifestations."),
            renderStructuredReference("rule.creature-origination", input, "Creature Origination, biological transmission and transformation"),
            node("p", "Subsequent transformation or reconstruction changes an existing individual under the applicable rule; this reader does not perform those changes."),
            renderStructuredReference("rule.species-subspecies-upbringing", input, "Species, Ancestry and Upbringing rules")));
    // Outer workspace owns the single package attribution notice.
    return article;
}

/** Optional authored explanation pane. Explicit rule IDs only; no per-row reads. */
export async function renderBiologicalExplanation(input) {
    if (!supportsBiologicalReader(input.references) || !contextMatches(input.context, input.references.context) ||
        !input.lifecycle?.isCurrent()) return null;
    const reader = input.references;
    const [origination, inheritance] = await Promise.all([
        reader.resolve("rule.creature-origination"), reader.resolve("rule.species-subspecies-upbringing")
    ]);
    if (!input.lifecycle.isCurrent()) return null;
    const o = origination.rule.definition, i = inheritance.rule.definition;
    const biological = o.methodDefinitions?.find(m => m.id === "biological");
    return section("Biological inheritance reference",
        node("p", "Authored reference evidence, not a mixed-Heritage calculator or character configuration."),
        section("Ordinary biological reproduction", format(biological?.description, input)),
        section("Contributed Heritage and Manifestations", format(o.biologicalTransmission, input)),
        section("Species/Ancestry definition inheritance", format(i.originInheritance, input)),
        renderStructuredReference("rule.creature-origination", input, "Transformation and Rite of Rebirth — full rule"),
        renderStructuredReference("rule.species-subspecies-upbringing", input, "Full Species, Ancestry and Upbringing rule"));
}
