import { getBrowserFilterDefinitions } from "../src/RulesWiki.Web/wwwroot/rules-browser-config.js";
import {
    browserFilterOptions,
    filterRulesForBrowser
} from "../src/RulesWiki.Web/wwwroot/rules-browser-filters.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function definition(entityType, key) {
    const value = getBrowserFilterDefinitions(entityType)
        .find(candidate => candidate.key === key);
    if (!value) throw new Error(`Missing ${entityType} filter '${key}'.`);
    return value;
}

const spells = [
    {
        displayName: "Fixture Bolt",
        browserFields: [
            { key: "spellList", value: "Bard" },
            { key: "spellList", value: "Sorcerer" },
            { key: "spellList", value: "Wizard" },
            { key: "components", value: "V" },
            { key: "components", value: "S" },
            { key: "components", value: "M" },
            { key: "descriptors", value: "Fire" },
            { key: "descriptors", value: "Light" }
        ]
    },
    {
        displayName: "Fixture Ward",
        browserFields: [
            { key: "spellList", value: "Cleric" },
            { key: "spellList", value: "Wizard" },
            { key: "components", value: "V" },
            { key: "components", value: "S" },
            { key: "descriptors", value: "Protection" }
        ]
    }
];

const spellList = definition("spell", "spellList");
assert(
    JSON.stringify(browserFilterOptions(spells, spellList))
        === JSON.stringify(["Bard", "Cleric", "Sorcerer", "Wizard"]),
    `Spell-list options must use authoritative individual Core field values: ${JSON.stringify(browserFilterOptions(spells, spellList))}`);
assert(
    filterRulesForBrowser(spells, "spell", { spellList: "Sorcerer" }).length === 1,
    "Filtering by one authoritative class value should match one spell.");
assert(
    filterRulesForBrowser(spells, "spell", { spellList: "Wizard" }).length === 2,
    "A repeated authoritative class value should match every applicable spell.");

const components = definition("spell", "components");
assert(
    filterRulesForBrowser(spells, "spell", { components: "M" }).length === 1,
    "Component filtering should use individual Core-owned values.");

const descriptors = definition("spell", "descriptors");
assert(
    filterRulesForBrowser(spells, "spell", { descriptors: "Fire" }).length === 1,
    "Descriptor filtering should use individual Core-owned values.");

const encodedDisplayValue = [{
    displayName: "Do Not Parse Me",
    browserFields: [{ key: "spellList", value: "Bard, Wizard" }]
}];
assert(
    JSON.stringify(browserFilterOptions(encodedDisplayValue, spellList)) === JSON.stringify(["Bard, Wizard"]),
    "Rules Wiki must not split display strings to infer semantic filter values.");
assert(
    filterRulesForBrowser(encodedDisplayValue, "spell", { spellList: "Wizard" }).length === 0,
    "Rules Wiki must not infer membership by parsing a display string.");

console.log("Phase 4 authoritative multi-value filter validation passed.");
