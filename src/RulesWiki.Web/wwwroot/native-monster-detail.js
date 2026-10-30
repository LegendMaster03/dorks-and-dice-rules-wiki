import { element } from "./ui.js";

// Presentation only. The native Core definition is the sole authority; never
// substitute data from an SRD, legacy browser, or inferred monster variant.
const ABILITIES = [["STR", "str"], ["DEX", "dex"], ["CON", "con"],
    ["INT", "int"], ["WIS", "wis"], ["CHA", "cha"]];
const SIZE = { F: "Fine", D: "Diminutive", T: "Tiny", S: "Small", M: "Medium",
    L: "Large", H: "Huge", G: "Gargantuan", C: "Colossal" };
const ALIGNMENT = { L: "Lawful", N: "Neutral", C: "Chaotic", G: "Good",
    E: "Evil", U: "Unaligned", A: "Any alignment" };
const SECTIONS = [
    ["Traits", ["trait", "traits", "specialQualities"]],
    ["Actions", ["action", "actions", "attack", "fullAttack", "specialAttacks"]],
    ["Bonus Actions", ["bonus", "bonusActions"]],
    ["Reactions", ["reaction", "reactions"]],
    ["Legendary Actions", ["legendary", "legendaryActions"]],
    ["Mythic Actions", ["mythic", "mythicActions"]],
    ["Lair Actions", ["lairActions", "lair"]],
    ["Regional Effects", ["regionalEffects", "regional"]]
];
const STAT_DETAILS = [
    ["Skills", ["skill", "skills"]],
    ["Senses", ["senses"]],
    ["Passive Perception", ["passive"]],
    ["Languages", ["languages"]],
    ["Damage Vulnerabilities", ["vulnerable", "vulnerabilities"]],
    ["Damage Resistances", ["resist", "resistances"]],
    ["Damage Immunities", ["immune", "immunities"]],
    ["Condition Immunities", ["conditionImmune", "conditionImmunities"]],
    ["Damage Reduction", ["dr", "damageReduction"]],
    ["Spell Resistance", ["sr", "spellResistance"]],
    ["Space / Reach", ["spaceReach"]],
    ["Space", ["space"]],
    ["Reach", ["reach"]],
    ["Base Attack Bonus", ["bab", "baseAttackBonus"]],
    ["Grapple", ["grapple", "grappleModifier"]],
    ["Feats", ["feats"]],
    ["Proficiency Bonus", ["pb", "proficiencyBonus"]],
    ["Gear", ["gear"]]
];
const SOURCE_FIELDS = new Set(["id", "name", "kind", "description", "lore", "environment",
    "treasure", "soundClip", "hasToken", "tokenUrl", "group", "statBlockFoundationId",
    "traitTags", "senseTags", "damageTags", "damageTagsSpell", "actionTags", "languageTags",
    "spellcastingTags", "miscTags", "conditionInflict", "conditionInflictSpell",
    "savingThrowForced", "savingThrowForcedSpell", "source", "page"]);
const empty = value => value === undefined || value === null || value === ""
    || (Array.isArray(value) && value.length === 0);
const pretty = key => String(key).replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ").replace(/^./, char => char.toUpperCase());
const signed = value => {
    if (empty(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) ? (number >= 0 ? `+${number}` : String(number)) : String(value);
};
const valueText = value => {
    if (empty(value)) return "";
    if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(", ");
    if (typeof value !== "object") return String(value).replace(/\{@([\w]+)\s*([^{}]*)\}/g,
        (_, tag, payload) => tagText(tag, payload));
    if ("average" in value && "formula" in value) return `${value.average} (${value.formula})`;
    if ("ac" in value) return [value.ac, value.from ? `(${valueText(value.from)})` : ""].filter(Boolean).join(" ");
    return Object.entries(value).filter(([, v]) => !empty(v))
        .map(([key, v]) => `${pretty(key)} ${valueText(v)}`).join(", ");
};
const field = (definition, keys) => keys.map(key => definition[key]).find(v => !empty(v));
const rollExpression = expression => {
    const match = /^(\d{1,2})d(\d{1,4})(?:\s*([+-])\s*(\d{1,4}))?$/i.exec(expression.trim());
    if (!match) return null;
    const count = Number(match[1]);
    const sides = Number(match[2]);
    if (count < 1 || count > 40 || sides < 2 || sides > 1000) return null;
    const modifier = match[3] ? Number(match[4]) * (match[3] === "-" ? -1 : 1) : 0;
    return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
        .reduce((sum, number) => sum + number, modifier);
};
const tagText = (tag, payload) => {
    const display = payload.split("|");
    const name = display[2]?.trim() || display[0]?.trim() || "";
    const normalized = tag.toLowerCase();
    const markers = { h: "Hit: ", acttrigger: "Trigger: ", actresponse: "Response: ",
        actsavefail: "Failure: ", actsavesuccess: "Success: ",
        actsavefailorsuccess: "Failure or Success: ", actsavesuccessorfail: "Success or Failure: " };
    if (normalized in markers) return markers[normalized];
    if (normalized === "atkr") return name.includes("r") && name.includes("m") ? "Melee or Ranged Attack: "
        : name.includes("r") ? "Ranged Attack: " : "Melee Attack: ";
    if (normalized === "atk") return "Attack: ";
    if (normalized === "actsave") return `${pretty(name)} Saving Throw: `;
    if (normalized === "hit") return signed(name) || name;
    if (normalized === "dc") return `DC ${name}`;
    if (normalized === "recharge") return name ? `Recharge ${name}–6` : "Recharge 6";
    return name;
};

function inlineContent(value, output) {
    const text = String(value);
    const regex = /\{@([a-z][\w]*)\s*([^{}]*)\}/gi;
    let previous = 0;
    for (const match of text.matchAll(regex)) {
        if (match.index > previous) output.append(element("span", { text: text.slice(previous, match.index) }));
        const tag = match[1].toLowerCase();
        const raw = match[2].split("|")[0].trim();
        if ((tag === "damage" || tag === "dice") && rollExpressionSyntax(raw)) {
            output.append(element("button", {
                type: "button", className: "rw-stat-roll", text: raw,
                title: `Roll ${raw}`,
                ariaLabel: `Roll ${raw}`,
                onClick: () => announceRoll(output, raw)
            }));
        } else if (tag === "hit" && /^[+-]?\d+$/.test(raw)) {
            const bonus = Number(raw);
            output.append(element("button", {
                type: "button", className: "rw-stat-roll", text: signed(bonus),
                title: `Roll attack d20${signed(bonus)}`,
                ariaLabel: `Roll attack d20${signed(bonus)}`,
                onClick: () => announceRoll(output, `1d20${bonus >= 0 ? "+" : ""}${bonus}`)
            }));
        } else {
            output.append(element("span", { text: tagText(tag, match[2]) }));
        }
        previous = match.index + match[0].length;
    }
    if (previous < text.length) output.append(element("span", { text: text.slice(previous) }));
}
function rollExpressionSyntax(raw) {
    const match = /^(\d{1,2})d(\d{1,4})(?:\s*[+-]\s*\d{1,4})?$/i.exec(raw);
    return !!match && Number(match[1]) >= 1 && Number(match[1]) <= 40
        && Number(match[2]) >= 2 && Number(match[2]) <= 1000;
}
function announceRoll(origin, expression) {
    const result = rollExpression(expression);
    if (result === null) return;
    const region = origin.closest?.(".rw-statblock")?.querySelector?.(".rw-stat-roll-result");
    if (region) region.textContent = `${expression}: ${result}`;
}
function renderContent(value, renderRaw) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const output = element("span", { className: "rw-stat-inline" });
        inlineContent(value, output);
        return output;
    }
    if (Array.isArray(value)) {
        const output = element("div", { className: "rw-stat-paragraphs" });
        for (const item of value) output.append(renderContent(item, renderRaw));
        return output;
    }
    if (typeof value !== "object") return renderRaw(value);
    if (value.type === "list" && Array.isArray(value.items)) {
        return element("ul", { className: "rw-stat-list" }, value.items.map(item =>
            element("li", {}, renderContent(item.entry ?? item.entries ?? item, renderRaw))));
    }
    if (value.type === "table" && Array.isArray(value.rows)) {
        return element("div", { className: "rw-stat-table-scroll" },
            element("table", { className: "rw-stat-table" },
                value.caption ? element("caption", { text: value.caption }) : null,
                value.colLabels ? element("thead", {}, element("tr", {}, value.colLabels.map(label => element("th", { text: valueText(label) })))) : null,
                element("tbody", {}, value.rows.map(row => element("tr", {},
                    (Array.isArray(row) ? row : [row]).map(cell => element("td", {}, renderContent(cell, renderRaw))))))));
    }
    const nested = field(value, ["entries", "entry", "items", "attackEntries", "hitEntries"]);
    if (!empty(nested)) {
        return element("div", { className: "rw-stat-nested" },
            value.name ? element("strong", { text: valueText(value.name) }) : null,
            renderContent(nested, renderRaw));
    }
    return renderRaw(value);
}
function renderEntry(item, renderRaw) {
    if (typeof item !== "object" || !item || Array.isArray(item)) return element("div", { className: "rw-stat-entry" }, renderContent(item, renderRaw));
    const body = element("div", { className: "rw-stat-entry" });
    if (item.name) body.append(element("strong", { className: "rw-stat-entry-name", text: valueText(item.name) }));
    const entries = ["headerEntries", "entries", "entry", "items", "attackEntries", "hitEntries", "footerEntries"];
    let found = false;
    for (const key of entries) if (!empty(item[key])) { body.append(renderContent(item[key], renderRaw)); found = true; }
    if (!found) body.append(renderRaw(item));
    else {
        const extras = Object.entries(item).filter(([key, v]) => !["name", "type", ...entries].includes(key) && !empty(v));
        if (extras.length) body.append(element("div", { className: "rw-stat-entry-extra" },
            extras.map(([key, v]) => element("div", {}, element("b", { text: `${pretty(key)}: ` }), renderContent(v, renderRaw)))));
    }
    return body;
}
function renderSpellcasting(item, renderRaw) {
    const body = element("div", { className: "rw-stat-entry" });
    if (item.name) body.append(element("strong", { className: "rw-stat-entry-name", text: item.name }));
    if (item.headerEntries) body.append(renderContent(item.headerEntries, renderRaw));
    if (!empty(item.ability)) {
        const abilityNames = { str: "Strength", dex: "Dexterity", con: "Constitution",
            int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
        body.append(element("div", { className: "rw-stat-spell-row" },
            element("b", { text: "Spellcasting Ability: " }),
            element("span", { text: abilityNames[String(item.ability).toLowerCase()] ?? valueText(item.ability) })));
    }
    const labels = { will: "At Will", daily: "Per Day", rest: "Per Rest", weekly: "Per Week",
        spells: "Spells", constant: "Constant", legendary: "Legendary", ritual: "Rituals" };
    for (const [key, value] of Object.entries(item)) {
        if (["name", "type", "headerEntries", "ability", "displayAs", "hidden"].includes(key)
            || (Array.isArray(item.hidden) && item.hidden.includes(key)) || empty(value)) continue;
        if (key in labels && value && typeof value === "object" && !Array.isArray(value)) {
            for (const [frequency, spellList] of Object.entries(value)) {
                const frequencyLabel = key === "daily" && /^(\d+)e?$/.test(frequency)
                    ? `${frequency.match(/^\d+/)[0]}/day${frequency.endsWith("e") ? " each" : ""}`
                    : pretty(frequency);
                body.append(element("div", { className: "rw-stat-spell-row" },
                    element("b", { text: `${frequencyLabel}: ` }),
                    renderContent(spellList, renderRaw)));
            }
        } else {
            body.append(element("div", { className: "rw-stat-spell-row" },
                element("b", { text: `${labels[key] || pretty(key)}: ` }), renderContent(value, renderRaw)));
        }
    }
    if (item.footerEntries) body.append(renderContent(item.footerEntries, renderRaw));
    return body;
}
function section(title, children) {
    return element("section", { className: "rw-stat-section" },
        element("h3", { className: "rw-stat-section-title", text: title }), children);
}
const displayValue = (value, formatter = valueText) => empty(value) ? null : formatter(value);
const armorValue = value => Array.isArray(value) ? value.map(armorValue).join(", ")
    : value && typeof value === "object" ? `${value.ac ?? value.value ?? ""}${value.from ? ` (${valueText(value.from)})` : ""}${value.condition ? `; ${valueText(value.condition)}` : ""}`
        : String(value);
const speedValue = value => value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).map(([key, amount]) => `${key === "walk" ? "" : `${pretty(key)} `}${typeof amount === "number" ? `${amount} ft.` : valueText(amount)}`).join(", ")
    : typeof value === "number" ? `${value} ft.` : valueText(value);
const initValue = value => value && typeof value === "object"
    ? [value.mod, value.bonus, value.value, value.initiative].find(v => !empty(v)) === undefined
        ? valueText(value) : signed([value.mod, value.bonus, value.value, value.initiative].find(v => !empty(v)))
    : signed(value);
function tile(label, content, note = "") {
    return element("div", { className: "rw-stat-tile" },
        element("span", { className: "rw-stat-tile-label", text: label }),
        element("strong", { className: "rw-stat-tile-value", text: content }),
        note ? element("span", { className: "rw-stat-tile-note", text: note }) : null);
}
function abilityGrid(definition) {
    const historical = { ...definition, ...(definition.saves ?? {}), ...(definition.save ?? {}) };
    const hasHistoricalSaves = ["fort", "fortitude", "ref", "reflex", "will"]
        .some(key => !empty(historical[key]));
    const explicit = (definition.save ?? definition.saves) && typeof (definition.save ?? definition.saves) === "object"
        ? definition.save ?? definition.saves : {};
    const scores = element("div", { className: "rw-stat-abilities" }, ABILITIES.map(([label, key]) => {
        const score = Number(definition[key]);
        const valid = !empty(definition[key]) && Number.isFinite(score);
        const modifier = valid ? Math.floor((score - 10) / 2) : null;
        const save = explicit[key] ?? explicit[pretty(key).toLowerCase()];
        // 5.x unproficient ability saves equal the ability modifier. Do not
        // invent these saves for a historical stat block with three defenses.
        const saveText = !empty(save) ? signed(save) : !hasHistoricalSaves ? signed(modifier) : "—";
        return element("div", { className: "rw-stat-ability" },
            element("span", { className: "rw-stat-ability-key", text: label }),
            element("span", { className: "rw-stat-ability-value" },
                element("strong", { text: valid ? String(score) : "—" }),
                element("small", { text: modifier === null ? "" : ` (${signed(modifier)})` })),
            element("span", { className: "rw-stat-ability-save" },
                element("span", { text: "Save " }), element("b", { text: saveText ?? "—" })));
    }));
    const saves = [["Fortitude", ["fortitude", "fort"]], ["Reflex", ["reflex", "ref"]],
        ["Will", ["will"]]].map(([label, keys]) =>
        [label, field(definition, keys) ?? field(definition.save ?? definition.saves ?? {}, keys)]);
    const present = saves.filter(([, value]) => !empty(value));
    return section("Ability Scores & Saves", [scores,
        present.length ? element("div", { className: "rw-stat-three-saves" }, present.map(([label, value]) =>
            element("div", {}, element("span", { text: label }), element("strong", { text: signed(value) })))) : null]);
}

export function renderNativeMonster(rule, renderRaw) {
    const d = rule.definition ?? {};
    const seen = new Set(SOURCE_FIELDS);
    const consume = keys => keys.forEach(key => seen.add(key));
    const titleParts = [displayValue(d.size, value => Array.isArray(value) ? value.map(v => SIZE[String(v).toUpperCase()] ?? pretty(v)).join("/") : SIZE[String(value).toUpperCase()] ?? pretty(value)),
        displayValue(d.type, value => {
            if (typeof value !== "object") return pretty(value);
            const type = pretty(value.type ?? value.name ?? "");
            const tags = Array.isArray(value.tags) ? value.tags.map(pretty).join(", ") : "";
            return tags ? `${type} (${tags})` : type;
        }),
        displayValue(d.alignment, value => Array.isArray(value)
            ? value.map(v => ALIGNMENT[String(v).toUpperCase()] ?? pretty(v)).join(" ") : ALIGNMENT[String(value).toUpperCase()] ?? pretty(value))].filter(Boolean);
    const cr = field(d, ["cr", "challenge", "challengeRating"]);
    consume(["size", "type", "alignment", "cr", "challenge", "challengeRating", "xp", "initiative", "init", "ac", "armorClass", "hp", "hitPoints", "speed", "touchAc", "touchAC", "acTouch", "flatFootedAc", "flatFootedAC", "acFlatFooted", "flatFooted", "touch", "save", "saves", "savingThrows", "legendaryActionsLair"]);
    for (const [, key] of ABILITIES) seen.add(key);
    const root = element("div", { className: "rw-statblock" });
    const header = element("header", { className: "rw-stat-header" },
        element("div", {}, element("h2", { className: "rw-stat-name", text: rule.name }),
            element("p", { className: "rw-stat-subtitle", text: titleParts.join(" · ") })),
        !empty(cr) ? element("div", { className: "rw-stat-cr" },
            element("strong", { text: `CR ${typeof cr === "object" ? cr.cr ?? cr.value ?? valueText(cr) : cr}` }),
            !empty(d.xp) ? element("small", { text: `${d.xp} XP` }) : null,
            cr && typeof cr === "object" && !empty(cr.xpLair)
                ? element("small", { text: `Lair XP ${Number(cr.xpLair).toLocaleString("en-US")}` }) : null) : null);
    root.append(header, element("div", { className: "rw-stat-accent" }));
    const defenseTiles = [
        ["Armor Class", field(d, ["ac", "armorClass"]), armorValue],
        ["Hit Points", field(d, ["hp", "hitPoints"]), valueText],
        ["Speed", d.speed, speedValue],
        ["Initiative", field(d, ["initiative", "init"]), initValue]
    ].filter(([, value]) => !empty(value));
    if (defenseTiles.length) {
        const tiles = element("div", { className: "rw-stat-tiles" }, defenseTiles.map(([name, value, format]) => tile(name, format(value))));
        const extraAc = [["Touch AC", ["touchAc", "touchAC", "acTouch", "touch"]],
            ["Flat-Footed AC", ["flatFootedAc", "flatFootedAC", "acFlatFooted", "flatFooted"]]]
            .map(([name, keys]) => [name, field(d, keys)]).filter(([, value]) => !empty(value));
        root.append(section("Defenses & Movement", [tiles,
            extraAc.length ? element("div", { className: "rw-stat-defense-variants" }, extraAc.map(([name, value]) =>
                element("div", {}, element("span", { text: name }), element("strong", { text: armorValue(value) })))) : null]));
    }
    root.append(abilityGrid(d));
    consume(["fort", "fortitude", "ref", "reflex", "will"]);
    const details = [];
    seen.add("saves");
    for (const [label, keys] of STAT_DETAILS) {
        consume(keys);
        const value = field(d, keys);
        if (!empty(value)) details.push([label, value]);
    }
    if (details.length) root.append(section("Combat & Reference", element("dl", { className: "rw-stat-detail-grid" },
        details.flatMap(([label, value]) => [element("dt", { text: label }), element("dd", {}, renderContent(value, renderRaw))]))));

    const spells = Array.isArray(d.spellcasting) ? d.spellcasting : !empty(d.spellcasting) ? [d.spellcasting] : [];
    seen.add("spellcasting");
    const spellCategories = new Map();
    for (const spell of spells) {
        const group = { action: "Actions", reaction: "Reactions", bonus: "Bonus Actions",
            legendary: "Legendary Actions", trait: "Traits" }[spell?.displayAs] ?? "Spellcasting";
        if (!spellCategories.has(group)) spellCategories.set(group, []);
        spellCategories.get(group).push(spell);
    }
    for (const [title, keys] of SECTIONS) {
        consume(keys);
        const rows = keys.flatMap(key => empty(d[key]) ? [] : Array.isArray(d[key]) ? d[key] : [d[key]]);
        const magic = spellCategories.get(title) ?? [];
        if (rows.length || magic.length) root.append(section(title, [
            title === "Legendary Actions" && !empty(d.legendaryActionsLair)
                ? element("p", { className: "rw-stat-legendary-note", text: `${d.legendaryActionsLair} legendary actions in its lair` }) : null,
            element("div", { className: "rw-stat-entries" }, [
                ...rows.map(row => renderEntry(row, renderRaw)), ...magic.map(row => renderSpellcasting(row, renderRaw))
            ])
        ]));
    }
    if (spellCategories.has("Spellcasting")) root.append(section("Spellcasting", element("div", { className: "rw-stat-entries" },
        spellCategories.get("Spellcasting").map(row => renderSpellcasting(row, renderRaw)))));
    if (!empty(d.description)) root.append(section("Description", renderContent(d.description, renderRaw)));

    // Unknown native mechanics remain inspectable. Presentation fields and
    // lore are secondary to the combat block, but never silently discarded.
    const additional = Object.entries(d).filter(([key, v]) => !seen.has(key) && !key.startsWith("_") && !empty(v));
    if (additional.length) root.append(section("Additional Mechanics", element("dl", { className: "rw-stat-detail-grid" },
        additional.flatMap(([key, value]) => [element("dt", { text: pretty(key) }),
            element("dd", {}, renderRaw(value))]))));
    const sources = Object.entries(d).filter(([key, v]) => SOURCE_FIELDS.has(key)
        && !["id", "name", "kind", "description"].includes(key) && !empty(v));
    if (sources.length) root.append(element("details", { className: "rw-stat-source" },
        element("summary", { text: "Supplementary creature information" }),
        element("dl", { className: "rw-stat-detail-grid" }, sources.flatMap(([key, value]) =>
            [element("dt", { text: pretty(key) }), element("dd", {}, renderRaw(value))]))));
    root.append(element("div", { className: "rw-stat-roll-result", attributes: { role: "status", "aria-live": "polite" } }));
    return root;
}
