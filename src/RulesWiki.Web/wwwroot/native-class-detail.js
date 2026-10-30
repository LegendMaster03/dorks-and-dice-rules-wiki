import { renderClassCustomizations, discoverOwnedOptions } from "./native-class-customization.js";
// Native class reference. The class document and linked feature records are
// authoritative; this renderer only presents their contents.
const CLASS_STYLE_ID = "rules-wiki-native-class-styles";
const EXCLUDED_PROGRESS_COLUMNS = new Set([
    "level", "featureGrants", "improvements", "baseAttackBonus", "baseSaves",
    "iterativeBaseAttackBonuses", "spellSlotsBySpellLevel", "availableChannelDivinityEffects",
    // Named milestone arrays are rendered dynamically, not as Warlock-specific columns.
]);
const CORE_FIELDS = [
    ["Hit Die", "hitDie"], ["Spellcasting ability", "spellcastingAbility"],
    ["Saving throws", "savingThrowProficiencies"], ["Armor training", "armorProficiencies"],
    ["Weapon training", "weaponProficiencies"], ["Skill choices", "skillChoices"]
];
const COLUMN_LABELS = {
    proficiencyBonus: "Prof.", invocationsElectiveTotal: "Invocations",
    pactSlots: "Pact slots", pactSlotLevel: "Slot level",
    ordinaryCantripsKnown: "Cantrips", ordinarySpellsKnown: "Spells known",
    cantripsKnown: "Cantrips", leveledSpellsKnown: "Spells known",
    sorceryPointMaximum: "Sorcery points", metamagicOptionsKnown: "Metamagic options",
    rageUses: "Rages", battleRageDamage: "Rage damage", channelDivinityUses: "Channel Divinity",
    wildShapeCharges: "Wild Shape", weaponMasteryChoices: "Weapon masteries"
};
const PREFERRED_COLUMNS = ["proficiencyBonus", "pactSlots", "pactSlotLevel",
    "invocationsElectiveTotal", "sorceryPointMaximum", "rageUses", "battleRageDamage",
    "channelDivinityUses", "wildShapeCharges", "cantripsKnown", "ordinaryCantripsKnown",
    "ordinarySpellsKnown", "leveledSpellsKnown", "weaponMasteryChoices"];
const expandedName = key => COLUMN_LABELS[key] ?? label(key);
const CUSTOMIZATION_FIELDS = [
    ["Class options", "classOptions"],
    ["Wizard specialization", "wizardSpecialization"],
    ["Companion path", "companionPathChoice"],
    ["Special ability choices", "specialAbilityOptionIds"],
    ["Feature choices", "selectableOptionFeatures"],
    ["Divine order choices", "selectedDivineOrderChoices"],
    ["Blessed strikes choices", "selectedBlessedStrikesChoices"],
    ["Choice-only features", "choiceOnlyFeatureIds"]
];
const SPECIAL_FIELDS = new Set([
    ...CORE_FIELDS.map(([, key]) => key), ...CUSTOMIZATION_FIELDS.map(([, key]) => key),
    "description", "progression", "inlineFeatures", "classType", "levelRange", "band",
    "subclasses", "prestigeClasses", "startingEquipment", "pillarSystem",
    "alphaVersion", "rulesStatus", "playtestMode", "sourcePackage", "separateGrants",
    "customizationSystems", "customizationSystemIds", "subclassPresets", "subclassPresetIds", "selectionRules"
]);

function node(tag, { text, className, attributes, onClick, onChange } = {}, ...children) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = String(text);
    if (className) el.className = className;
    for (const [key, value] of Object.entries(attributes ?? {})) {
        if (value !== null && value !== undefined) el.setAttribute(key, String(value));
    }
    if (onClick) el.addEventListener("click", onClick);
    if (onChange) el.addEventListener("change", onChange);
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
}

function label(value) {
    return String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}

function valueLabel(value) {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value)) return value.length ? value.map(valueLabel).join(", ") : "None";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") {
        if (Number.isInteger(value.faces)) return `${value.number > 1 ? value.number : ""}d${value.faces}`;
        return Object.entries(value).map(([key, item]) => `${label(key)}: ${valueLabel(item)}`).join("; ") || "None";
    }
    return String(value).replace(/-/g, " ");
}

function featureAnchor(id, level, firstLevel) {
    const first = firstLevel.get(id);
    return `native-class-feature-${encodeURIComponent(id)}`
        + (first === undefined || first === level ? "" : `-level-${level}`);
}

function featureName(id) {
    return label(String(id).split(".").at(-1)
        .replace(/-level-\d+$/, "")
        .replace(/-\d+-dice?$/, ""));
}

function installStyles() {
    if (document.getElementById(CLASS_STYLE_ID)) return;
    const link = document.createElement("link");
    link.setAttribute("id", CLASS_STYLE_ID);
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", new URL("./native-class-detail.css", import.meta.url).href);
    document.head.append(link);
}

function section(id, heading, ...contents) {
    return node("section", { className: "native-class-section", attributes: { id } },
        node("h3", { text: heading }), ...contents);
}

function renderSummary(definition) {
    const traits = CORE_FIELDS.filter(([, key]) => definition[key] !== undefined && definition[key] !== null);
    const summary = section("native-class-traits", "Class traits");
    const grid = node("dl", { className: "native-class-traits" });
    for (const [heading, key] of traits) {
        const choices = definition[key];
        const count = choices?.count ?? choices?.choose;
        const value = key === "skillChoices" && Number.isInteger(count) && Array.isArray(choices?.from)
            ? `Choose ${count} from ${choices.from.map(skill => {
                const identity = String(skill);
                return label(identity.startsWith("skill.") ? identity.slice(6) : identity);
            }).join(", ")}` : valueLabel(choices);
        grid.append(node("div", { className: "native-class-trait" },
            node("dt", { text: heading }), node("dd", { text: value })));
    }
    summary.append(grid);
    return summary;
}

function scalarColumns(rows) {
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
    return keys.filter(key => !EXCLUDED_PROGRESS_COLUMNS.has(key) && rows.some(row => {
        const value = row[key];
        return (typeof value === "number" && Number.isFinite(value))
            || (typeof value === "string" && value.length > 0);
    }));
}

function progressionCell(row, key) {
    if (key === "baseAttackBonus") return row.baseAttackBonus ?? "—";
    if (["fortitude", "reflex", "will"].includes(key)) return row.baseSaves?.[key] ?? "—";
    const value = row[key];
    return value === null || value === undefined ? "—" : valueLabel(value);
}

function renderProgression(rows, renderValue, firstLevel, registerLabel) {
    if (!rows.length) return { sectionNode: section("native-class-progression", "Class advancement",
        node("p", { text: "This class has no structured advancement table." })), select: null };
    const keys = ["level", "featureGrants", ...PREFERRED_COLUMNS,
        "baseAttackBonus", "fortitude", "reflex", "will",
        ...[...new Set(rows.flatMap(row => Object.keys(row).filter(key =>
            /Milestones$/.test(key) && Array.isArray(row[key]) && row[key].every(item => typeof item === "string"))))],
        ...scalarColumns(rows)];
    const seen = new Set();
    const candidates = keys.filter(key => !seen.has(key) && seen.add(key));
    const displayed = candidates.filter(key => key === "level" || key === "featureGrants"
        || rows.some(row => progressionCell(row, key) !== "—"));
    const focused = new Set(["level", "featureGrants"]);
    // No more than three additional numerical columns are initially visible.
    for (const key of displayed.filter(key => key !== "level" && key !== "featureGrants").slice(0, 3)) focused.add(key);
    const table = node("table", { className: "native-class-table" });
    const head = node("thead");
    head.append(node("tr", {}, ...displayed.map(key => node("th", {
        text: key === "level" ? "Level" : key === "featureGrants" ? "Features" :
            key === "baseAttackBonus" ? "BAB" : ["fortitude", "reflex", "will"].includes(key)
                ? label(key) : expandedName(key),
        className: focused.has(key) ? "" : "native-class-extra-column",
        attributes: { scope: "col" }
    }))));
    const body = node("tbody");
    const levelRows = new Map();
    for (const row of rows) {
        const tr = node("tr", { attributes: { "data-class-level": row.level } });
        for (const key of displayed) {
            const extra = focused.has(key) ? "" : "native-class-extra-column";
            if (key === "level") {
                tr.append(node("th", { text: row.level, attributes: { scope: "row" } }));
            } else if (key === "featureGrants") {
                const cell = node("td", { className: "native-class-table-features" });
                for (const id of row.featureGrants ?? []) {
                    const link = node("a", { text: featureName(id), className: "native-class-feature-short",
                        attributes: { href: `#${featureAnchor(id, row.level, firstLevel)}` } });
                    registerLabel(id, link);
                    cell.append(link);
                }
                if (!(row.featureGrants?.length)) cell.textContent = "—";
                tr.append(cell);
            } else {
                tr.append(node("td", { className: extra, text: progressionCell(row, key) }));
            }
        }
        body.append(tr);
        levelRows.set(String(row.level), tr);
    }
    table.append(head, body);
    const wrap = node("div", { className: "native-class-table-scroll", attributes: {
        role: "region", tabindex: "0", "aria-label": "Class advancement table"
    } }, table);
    const sectionNode = section("native-class-progression", "Class advancement",
        node("p", { className: "native-class-help", text: "Choose a level to inspect its features. Additional progression statistics remain available below." }));
    const select = node("select", { className: "native-class-level-select", attributes: {
        "aria-label": "Focus class level"
    } });
    select.append(node("option", { text: "All levels", attributes: { value: "" } }));
    for (const row of rows) select.append(node("option", { text: `Level ${row.level}`, attributes: { value: row.level } }));
    select.addEventListener("change", () => {
        for (const [level, tr] of levelRows) tr.classList.toggle("is-selected", level === select.value);
        levelRows.get(select.value)?.scrollIntoView?.({ block: "nearest" });
    });
    const controls = node("div", { className: "native-class-controls" },
        node("label", { className: "native-class-control-label" },
            node("span", { text: "Focus level" }), select));
    if (displayed.some(key => !focused.has(key))) {
        const extended = node("input", { attributes: { type: "checkbox", "aria-label": "Show all progression columns" } });
        extended.addEventListener("change", () => wrap.classList.toggle("is-expanded", extended.checked));
        controls.append(node("label", { className: "native-class-columns-toggle" }, extended,
            node("span", { text: "Show all columns" })));
    }
    sectionNode.append(controls, wrap);
    if (rows.some(row => Array.isArray(row.spellSlotsBySpellLevel))) {
        const slots = node("details", { className: "native-class-disclosure" },
            node("summary", { text: "Spell slot progression by spell level" }));
        const spellTable = node("table", { className: "native-class-table native-class-spell-table" });
        spellTable.append(node("thead", {}, node("tr", {},
            node("th", { text: "Level", attributes: { scope: "col" } }),
            ...Array.from({ length: 9 }, (_, index) => node("th", {
                text: String(index + 1), attributes: { scope: "col", "aria-label": `Spell level ${index + 1}` }
            })))));
        const spellBody = node("tbody");
        for (const row of rows) {
            const counts = row.spellSlotsBySpellLevel;
            spellBody.append(node("tr", {},
                node("th", { text: row.level, attributes: { scope: "row" } }),
                ...Array.from({ length: 9 }, (_, index) => node("td", {
                    text: Array.isArray(counts) && Number.isInteger(counts[index]) && counts[index] > 0
                        ? counts[index] : "—"
                }))));
        }
        spellTable.append(spellBody);
        slots.append(node("p", { className: "native-class-help", text:
            "Columns 1–9 represent spell levels. A dash means no slots at that level." }));
        slots.append(node("div", { className: "native-class-table-scroll", attributes: {
            role: "region", tabindex: "0", "aria-label": "Spell slots by spell level and class level"
        } }, spellTable));
        sectionNode.append(slots);
    }
    const detail = node("details", { className: "native-class-disclosure" },
        node("summary", { text: "Complete advancement data" }));
    for (const row of rows) {
        const fields = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "level"));
        detail.append(node("details", { className: "native-class-level-data" },
            node("summary", { text: `Level ${row.level}` }), renderValue(fields)));
    }
    sectionNode.append(detail);
    return { sectionNode, select, levelRows, controls };
}

function renderFeature(id, level, firstLevel, inline, getRule, hrefForRule, renderValue, registerLabel) {
    const inlineFeature = inline.get(id);
    const summary = node("summary", { text: inlineFeature?.name || featureName(id) });
    registerLabel(id, summary);
    const card = node("details", { className: "native-class-feature",
        attributes: { id: featureAnchor(id, level, firstLevel) } }, summary);
    const content = node("div", { className: "native-class-feature-content" });
    if (inlineFeature) {
        if (inlineFeature.description) content.append(node("p", { text: inlineFeature.description }));
        if (inlineFeature.mechanics !== undefined) content.append(renderValue(inlineFeature.mechanics));
    } else if (getRule) {
        content.append(node("p", { className: "native-class-help", text: "Expand to load the authoritative feature definition." }));
        let requested = false;
        card.addEventListener("toggle", () => {
            if (!card.open || requested) return;
            requested = true;
            Promise.resolve().then(() => getRule(id)).then(result => {
                const rule = result?.rule;
                if (!rule || rule.id !== id) throw new Error("The requested feature was not returned.");
                const featureDefinition = rule.definition?.definition ?? rule.definition;
                content.replaceChildren(node("h5", { text: rule.name ?? featureName(id) }));
                if (featureDefinition?.description) content.append(node("p", { text: featureDefinition.description }));
                if (featureDefinition && typeof featureDefinition === "object") {
                    const other = Object.fromEntries(Object.entries(featureDefinition)
                        .filter(([key]) => key !== "description"));
                    if (Object.keys(other).length) content.append(renderValue(other));
                }
                content.append(node("a", { text: "Open full rule", attributes: { href: hrefForRule(id) } }));
            }).catch(() => {
                requested = false;
                content.replaceChildren(node("p", { text:
                    "Feature definition unavailable. Close and reopen to retry, or open the full rule." }),
                    node("a", { text: "Open full rule", attributes: { href: hrefForRule(id) } }));
            });
        });
    }
    if (!inlineFeature) {
        content.append(node("a", { text: "Open full rule", attributes: { href: hrefForRule(id) } }));
    }
    card.append(content);
    return card;
}

function renderFeatures(rows, inline, renderValue, hrefForRule, getRule, firstLevel, registerLabel) {
    const sectionNode = section("native-class-features", "Features by level");
    const groups = node("div", { className: "native-class-feature-levels" });
    const used = new Set();
    const grouped = new Map();
    const featureCards = new Map();
    const featureLevels = new Map();
    for (const row of rows) {
        for (const id of row.featureGrants ?? []) {
            // A feature can be granted at more than one level; each occurrence
            // must be independently visible even though the native ID is shared.
            if (!grouped.has(row.level)) grouped.set(row.level, []);
            if (!grouped.get(row.level).includes(id)) grouped.get(row.level).push(id);
            featureLevels.set(featureAnchor(id, row.level, firstLevel), row.level);
            used.add(id);
        }
    }
    for (const feature of inline.values()) {
        if (used.has(feature.id)) continue;
        if (!grouped.has(feature.classLevel ?? "Other")) grouped.set(feature.classLevel ?? "Other", []);
        grouped.get(feature.classLevel ?? "Other").push(feature.id);
        featureLevels.set(featureAnchor(feature.id, feature.classLevel ?? "Other", firstLevel),
            feature.classLevel ?? "Other");
        used.add(feature.id);
    }
    for (const row of rows) {
        if (Array.isArray(row.improvements) && row.improvements.length && !grouped.has(row.level)) {
            grouped.set(row.level, []);
        }
    }
    for (const [level, ids] of [...grouped].sort(([left], [right]) =>
        (typeof left === "number" ? left : Infinity) - (typeof right === "number" ? right : Infinity))) {
        const list = node("div", { className: "native-class-feature-list" });
        for (const id of ids) {
            const card = renderFeature(id, level, firstLevel, inline, getRule, hrefForRule, renderValue, registerLabel);
            featureCards.set(featureAnchor(id, level, firstLevel), card);
            list.append(card);
        }
        const row = rows.find(item => item.level === level);
        if (row?.improvements?.length) {
            list.append(node("div", { className: "native-class-level-improvements" },
                node("strong", { text: "Feature improvements" }), renderValue(row.improvements)));
        }
        const preview = node("span", { className: "native-class-level-feature-preview" });
        if (!ids.length) preview.textContent = "Feature improvements";
        ids.forEach((id, index) => {
            if (index) preview.append(document.createTextNode(" · "));
            const name = node("span", { text: featureName(id) });
            registerLabel(id, name);
            preview.append(name);
        });
        const levelGroup = node("details", { className: "native-class-feature-level", attributes: {
            "data-class-level": level,
            ...(Number.isInteger(level) ? { id: `native-class-features-level-${level}` } : {})
        } },
            node("summary", {}, node("strong", { text: typeof level === "number" ? `Level ${level}` : String(level) }),
                preview),
            list);
        if (!groups.children.length) levelGroup.open = true;
        groups.append(levelGroup);
    }
    if (!grouped.size) sectionNode.append(node("p", { text: "No level-linked features are present in this class definition." }));
    else sectionNode.append(groups);
    return { sectionNode, groups, featureCards, featureLevels };
}


function renderOther(definition, renderValue) {
    const extra = Object.entries(definition).filter(([key]) => !SPECIAL_FIELDS.has(key) && !key.startsWith("_"));
    if (!extra.length && !definition.startingEquipment && !definition.playtestMode
        && !definition.sourcePackage && !definition.separateGrants) return null;
    const disclosure = node("details", { className: "native-class-disclosure" },
        node("summary", { text: "Additional class rules and data" }));
    if (definition.playtestMode) disclosure.append(node("p", { text: `Playtest mode: ${valueLabel(definition.playtestMode)}` }));
    if (definition.sourcePackage) disclosure.append(node("p", { text: `Content source: ${definition.sourcePackage}` }));
    if (definition.startingEquipment !== undefined) disclosure.append(node("section", {},
        node("h4", { text: "Starting equipment" }), renderValue(definition.startingEquipment)));
    if (definition.separateGrants !== undefined) disclosure.append(node("section", {},
        node("h4", { text: "Complete separate grant rules" }), renderValue(definition.separateGrants)));
    for (const [key, value] of extra) {
        disclosure.append(node("section", {}, node("h4", { text: label(key) }), renderValue(value)));
    }
    return disclosure;
}

/**
 * Render a native class without supplying inferred rules or assuming a fixed
 * number of class customization pillars. `getRule` is called on demand only.
 */
export function renderNativeClass(rule, {
    renderValue, hrefForRule = id => `/rules/${encodeURIComponent(id)}`,
    getRule = null, searchRules = null, catalogFingerprint = null
} = {}) {
    if (!rule || rule.kind !== "class" || !rule.definition) throw new Error("A native class rule is required.");
    if (typeof renderValue !== "function") throw new Error("A safe native-value renderer is required.");
    installStyles();
    // Rules Core's private reference API includes the complete native entity
    // object in `rule.definition`; direct fixtures may already be normalized.
    const definition = rule.definition?.definition && typeof rule.definition.definition === "object"
        ? rule.definition.definition : rule.definition;
    const rows = Array.isArray(definition.progression) ? definition.progression
        .filter(row => row && Number.isInteger(row.level))
        .sort((a, b) => a.level - b.level) : [];
    const inline = new Map((Array.isArray(definition.inlineFeatures) ? definition.inlineFeatures : [])
        .filter(feature => feature && typeof feature.id === "string")
        .map(feature => [feature.id, feature]));
    const root = node("div", { className: "native-class-reference" });
    const header = node("header", { className: "native-class-header" },
        node("span", { className: "native-class-eyebrow", text: "Base class" }),
        node("h2", { text: rule.name }));
    if (definition.description) header.append(node("p", { text: definition.description }));
    if (definition.rulesStatus) header.append(node("p", { className: "native-class-status", text:
        `Rules status: ${valueLabel(definition.rulesStatus)}${definition.alphaVersion ? ` · Alpha ${definition.alphaVersion}` : ""}` }));
    root.append(header, renderSummary(definition));
    const firstLevel = new Map();
    for (const row of rows) for (const id of row.featureGrants ?? []) {
        if (!firstLevel.has(id)) firstLevel.set(id, row.level);
    }
    const featureLabelNodes = new Map();
    const registerLabel = (id, element) => {
        if (!featureLabelNodes.has(id)) featureLabelNodes.set(id, []);
        featureLabelNodes.get(id).push(element);
    };
    const ruleRequests = new Map();
    const loadRule = getRule && (id => {
        if (!ruleRequests.has(id)) {
            const request = Promise.resolve().then(() => getRule(id)).then(response => {
                if (catalogFingerprint && response?.fingerprint !== catalogFingerprint) {
                    throw new Error("The native ruleset changed while this class was open.");
                }
                // Resolve ID-derived fallback labels from authoritative metadata
                // without fetching all features in advance.
                if (response?.rule?.id === id && typeof response.rule.name === "string") {
                    for (const element of featureLabelNodes.get(id) ?? []) {
                        element.textContent = response.rule.name;
                    }
                }
                return response;
            });
            ruleRequests.set(id, request);
            request.catch(() => ruleRequests.delete(id));
        }
        return ruleRequests.get(id);
    });
    const features = renderFeatures(rows, inline, renderValue, hrefForRule, loadRule, firstLevel, registerLabel);
    const progression = renderProgression(rows, renderValue, firstLevel, registerLabel);
    if (progression.select) {
        const select = progression.select;
        const jump = node("a", { text: "Read level features", className: "native-class-feature-jump",
            attributes: { href: "#native-class-features" } });
        jump.hidden = true;
        progression.controls.append(jump);
        select.addEventListener("change", () => {
            const group = [...features.groups.children].find(item =>
                item.getAttribute("data-class-level") === select.value);
            for (const card of features.groups.children) {
                const active = card === group;
                card.classList.toggle("is-selected", active);
                if (select.value) card.open = active;
            }
            // Do not unexpectedly scroll away from the table. A separate
            // link permits deliberate movement to an expanded feature group.
            jump.hidden = !group || !select.value;
            if (group && select.value) {
                jump.textContent = `Read level ${select.value} features`;
                jump.setAttribute("href", `#native-class-features-level-${select.value}`);
            }
        });
    }
    // A progression link must reveal its destination before the browser follows
    // the fragment. Otherwise the anchor sits inside two closed <details> and
    // the click appears to do nothing. Keep the native anchor behavior intact.
    progression.sectionNode.addEventListener("click", event => {
        const link = event.target?.closest?.("a.native-class-feature-short");
        if (!link) return;
        const target = link.getAttribute("href")?.slice(1);
        if (!features.featureCards.has(target)) return;
        const level = features.featureLevels.get(target);
        const group = [...features.groups.children].find(item =>
            item.getAttribute("data-class-level") === String(level));
        if (group) group.open = true;
        const card = features.featureCards.get(target);
        if (card) card.open = true;
        if (progression.select) progression.select.value = String(level);
        for (const [itemLevel, row] of progression.levelRows ?? []) {
            row.classList.toggle("is-selected", itemLevel === String(level));
        }
        for (const entry of features.groups.children) {
            entry.classList.toggle("is-selected", entry === group);
        }
    });
    const customization = renderClassCustomizations(definition, {
        node, renderValue, hrefForRule, getRule: loadRule, fallbackFields: CUSTOMIZATION_FIELDS,
        maximumClassLevel: rows.length ? rows.at(-1).level :
            (Array.isArray(definition.levelRange) ? definition.levelRange[1] : null),
        discoverOptions: searchRules && loadRule ? category => discoverOwnedOptions(category, rule.id, {
            searchRules, getRule: loadRule, fingerprint: catalogFingerprint
        }) : null
    });
    const grants = definition.separateGrants && typeof definition.separateGrants === "object"
        ? node("aside", { className: "native-class-rules-note", attributes: { id: "native-class-resource-notes" } },
            node("h3", { text: "Spellcasting and resource notes" }),
            ...(definition.separateGrants.automaticEldritchBlast === true ? [node("p", { text:
                "Eldritch Blast is granted separately from ordinary cantrips." })] : []),
            ...(definition.separateGrants.mysticArcanumSeparate === true ? [node("p", { text:
                "Mystic Arcanum is separate from Pact Magic slots." })] : []),
            ...(definition.separateGrants.pactMagicSlotsRecover === "short-or-long-rest" ? [node("p", { text:
                "Pact Magic slots recover on a Short or Long Rest." })] : [])) : null;
    const navigation = node("nav", { className: "native-class-navigation", attributes: { "aria-label": "Class sections" } });
    const contents = [customization, progression.sectionNode, grants, features.sectionNode].filter(Boolean);
    for (const item of contents) {
        const heading = item.querySelector?.("h3")?.textContent || item.children[0]?.textContent;
        navigation.append(node("a", { text: heading, attributes: { href: `#${item.getAttribute("id") || "native-class-customization"}` } }));
    }
    root.append(navigation, ...contents);
    // Hosted shell navigation may intercept ordinary # links and rebuild the
    // entire detail pane. Handle in-class fragments locally, before bubbling,
    // preserving expanded disclosures and filtered options. Full-rule links
    // retain their normal router behavior.
    const localTargets = new Map();
    for (const item of contents) {
        const id = item.getAttribute("id");
        if (id) localTargets.set(id, item);
    }
    for (const [id, card] of features.featureCards) localTargets.set(id, card);
    for (const group of features.groups.children) {
        const id = group.getAttribute("id");
        if (id) localTargets.set(id, group);
    }
    const revealFragment = id => {
        const target = localTargets.get(id);
        if (!target) return false;
        const level = features.featureLevels.get(id);
        if (level !== undefined) {
            const group = [...features.groups.children].find(item =>
                item.getAttribute("data-class-level") === String(level));
            if (group) group.open = true;
            target.open = true;
        } else if (target.className?.includes("native-class-feature-level")) {
            target.open = true;
        }
        target.scrollIntoView?.({ block: "start" });
        return true;
    };
    root.revealNativeClassFragment = revealFragment;
    root.addEventListener("click", event => {
        const link = event.target?.closest?.('a[href^="#native-class-"]');
        const fragment = link?.getAttribute("href")?.slice(1);
        if (!fragment || !localTargets.has(fragment)) return;
        event.preventDefault();
        event.stopPropagation();
        // pushState does not dispatch hashchange, preventing the host's fragment
        // router from remounting this class. Preserve the URL for deep linking.
        if (typeof window !== "undefined" && window.history?.pushState) {
            const url = `${window.location.pathname}${window.location.search}#${fragment}`;
            const state = { ...(window.history.state ?? {}), rulesWikiClassView: rule.id };
            // Mark the preceding entry too, so Back to the unfragmented class
            // can be handled without remounting the still-open reference.
            if (window.history.state?.rulesWikiClassView !== rule.id)
                window.history.replaceState(state, "", window.location.href);
            if (window.location.hash !== `#${fragment}`)
                window.history.pushState(state, "", url);
        }
        revealFragment(fragment);
    }, true);
    if (typeof window !== "undefined" && window.location?.hash?.startsWith("#native-class-")) {
        const requested = decodeURIComponent(window.location.hash.slice(1));
        queueMicrotask(() => revealFragment(requested));
    }
    const other = renderOther(definition, renderValue);
    if (other) root.append(other);
    return root;
}
