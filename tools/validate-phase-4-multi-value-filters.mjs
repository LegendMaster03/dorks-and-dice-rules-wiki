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
            { key: "spellList", value: "Bard, Sorcerer, Wizard" },
            { key: "components", value: "V, S, M" },
            { key: "descriptors", value: "Fire, Light" }
        ]
    },
    {
        displayName: "Fixture Ward",
        browserFields: [
            { key: "spellList", value: "Cleric, Wizard" },
            { key: "components", value: "V, S" },
            { key: "descriptors", value: "Protection" }
        ]
    }
];

const spellList = definition("spell", "spellList");
assert(
    JSON.stringify(browserFilterOptions(spells, spellList))
        === JSON.stringify(["Bard", "Cleric", "Sorcerer", "Wizard"]),
    `Spell-list options were not split into individual classes: ${JSON.stringify(browserFilterOptions(spells, spellList))}`);
assert(
    filterRulesForBrowser(spells, "spell", { spellList: "Sorcerer" }).length === 1,
    "Filtering by one class should match a spell with multiple class associations.");
assert(
    filterRulesForBrowser(spells, "spell", { spellList: "Wizard" }).length === 2,
    "A shared class association should match every applicable spell.");

const components = definition("spell", "components");
assert(
    filterRulesForBrowser(spells, "spell", { components: "M" }).length === 1,
    "Component filtering should match one component inside a component set.");

const descriptors = definition("spell", "descriptors");
assert(
    filterRulesForBrowser(spells, "spell", { descriptors: "Fire" }).length === 1,
    "Descriptor filtering should match one descriptor inside a descriptor set.");

const items = [{
    displayName: "Fixture Blade",
    browserFields: [{ key: "properties", value: "Finesse, Light" }]
}];
assert(
    filterRulesForBrowser(items, "item", { properties: "Light" }).length === 1,
    "Item property filtering should match one property inside a property set.");

console.log("Phase 4 multi-value filter validation passed.");
