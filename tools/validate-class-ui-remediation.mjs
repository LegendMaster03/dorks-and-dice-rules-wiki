import assert from "node:assert/strict";
import { renderNativeClass } from "../src/RulesWiki.Web/wwwroot/native-class-detail.js";

class FakeNode {
    constructor(tagName = "#text") {
        this.tagName = tagName.toUpperCase();
        this.childNodes = [];
        this.attrs = {};
        this.listeners = new Map();
        this.value = "";
        this.open = false;
        this._text = "";
        this._classes = new Set();
        this.classList = {
            add: (...xs) => xs.forEach(x => this._classes.add(x)),
            contains: x => this._classes.has(x),
            toggle: (x, state) => state ? this._classes.add(x) : this._classes.delete(x)
        };
    }
    set className(value) { this._classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this._classes].join(" "); }
    set textContent(value) { this._text = String(value); this.childNodes = []; }
    get textContent() { return this._text + this.childNodes.map(child => child.textContent).join(""); }
    get children() { return this.childNodes.filter(child => child.tagName !== "#TEXT"); }
    append(...children) {
        for (const child of children.flat(Infinity)) {
            if (child === null || child === undefined || child === false) continue;
            this.childNodes.push(child instanceof FakeNode ? child : new FakeText(String(child)));
        }
    }
    replaceChildren(...children) { this._text = ""; this.childNodes = []; this.append(...children); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    removeAttribute(key) { delete this.attrs[key]; }
    addEventListener(name, handler) {
        if (!this.listeners.has(name)) this.listeners.set(name, []);
        this.listeners.get(name).push(handler);
    }
    dispatch(name) { for (const handler of this.listeners.get(name) ?? []) handler({ target: this }); }
    scrollIntoView() { this.scrolled = true; }
}
class FakeText extends FakeNode { constructor(value) { super("#text"); this._text = value; } }
globalThis.Node = FakeNode;
const head = new FakeNode("head");
globalThis.document = {
    head,
    createElement: tag => new FakeNode(tag),
    createTextNode: value => new FakeText(value),
    getElementById: id => nodes(head, node => node.attrs.id === id)[0] ?? null
};
const nodes = (root, predicate) => [root, ...root.children.flatMap(child => nodes(child, predicate))].filter(predicate);
const renderValue = value => {
    const safe = new FakeNode("pre");
    safe.textContent = JSON.stringify(value);
    return safe;
};

const rule = (name, definition) => ({ id: `class.${name.toLowerCase()}`, name, kind: "class", definition });
const ruleHref = id => `/tools/rules-wiki/rules/${id}`;
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };

// UI-04: Native skill choices have both `count` and `choose`, and may use IDs.
const barbarian = renderNativeClass(rule("Barbarian", {
    skillChoices: { choose: 2, from: ["skill.animal-handling", "skill.athletics"] }
}), { renderValue });
assert.match(barbarian.textContent, /Choose 2 from Animal Handling, Athletics/);
assert.doesNotMatch(nodes(barbarian, x => x.className === "native-class-trait")[0]?.textContent ?? "", /skill\./);

// UI-03: Published Wizard choices are explained; metadata is preserved below.
const wizard = renderNativeClass(rule("Wizard", {
    wizardSpecialization: {
        selectionListId: "wizard-specialization", eligibleOptionFamilies: ["metamagic", "item-creation"],
        classLevelGrants: [5, 10, 15, 20], selectionsPerClassLevelGrant: 1,
        additionalToOtherClassGrants: true, optionPrerequisitesApply: true,
        ordinaryGeneralFeatMayBeReplacedByOneEligibleSpecializationOption: true,
        underlyingMetamagicAndCraftingDetails: "deferred-to-shared-mechanics",
        doesNotGrantSorceryPoints: true, doesNotGrantSorcererMetamagicClassFeature: true
    },
    companionPathChoice: { exclusive: true, selectionFromWizardLevel: 1,
        paths: ["bonded-persistent", "self-focused-ephemeral"],
        implementation: "deferred-to-shared-companion-system" }
}), { renderValue });
const wizardPrimary = nodes(wizard, el => el.className === "native-class-published-selections");
assert.equal(wizardPrimary.length, 2);
assert.match(wizardPrimary[0].textContent, /At Wizard levels 5, 10, 15, 20/);
assert.match(wizardPrimary[0].textContent, /Metamagic or Item Creation/);
assert.match(wizardPrimary[1].textContent, /choose one exclusive path/);
assert.match(wizardPrimary[1].textContent, /deferred/);
assert.ok(nodes(wizard, el => el.className === "native-class-technical-details").length >= 2,
    "Technical rules must remain recoverable, not silently discarded");

// CORE-01 Wiki-side readiness: repeated native grant IDs must appear at each
// level, without guessing any grants absent from Core.
const id = "class-feature.warlock.ability-score-improvement";
const fetched = [];
const repeated = renderNativeClass(rule("Warlock", { progression: [
    { level: 4, featureGrants: [id] },
    { level: 8, featureGrants: [id] },
    { level: 12, featureGrants: [id] }
] }), { renderValue, hrefForRule: ruleHref, getRule: async featureId => {
    fetched.push(featureId);
    return { rule: { id: featureId, name: "Ability Score Improvement",
        definition: { description: "Increase ability scores or take a feat as provided by the class rule." } } };
} });
const featureCards = nodes(repeated, el => el.className === "native-class-feature");
assert.equal(featureCards.length, 3, "One rule ID can be granted at multiple levels");
assert.deepEqual(featureCards.map(x => x.attrs.id), [
    `native-class-feature-${id}`, `native-class-feature-${id}-level-8`,
    `native-class-feature-${id}-level-12`
]);
assert.equal(nodes(repeated, el => el.className === "native-class-feature-short").length, 3);
featureCards[1].open = true;
featureCards[1].dispatch("toggle");
await flush();
assert.equal(featureCards[1].textContent.includes("Ability Score Improvement"), true);
const repeatedLabels = nodes(repeated, x => x.className === "native-class-feature-short");
assert.ok(repeatedLabels.every(x => x.textContent === "Ability Score Improvement"));
featureCards[2].open = true;
featureCards[2].dispatch("toggle");
await flush();
assert.equal(fetched.length, 1, "Repeated native features should share the cached definition");

// UI-01: Embedded-shell links must be handled without allowing native fragment
// navigation to remount the page and erase filters/disclosures.
const custom = renderNativeClass(rule("Navigate", {
    progression: [{ level: 1, featureGrants: ["class-feature.navigate.open"] }],
    customizationSystems: [{ name: "Choices", options: ["choice.navigate.alpha"] }]
}), { renderValue });
const customization = nodes(custom, el => el.attrs.id === "native-class-customization")[0];
const systems = nodes(custom, el => el.className === "native-class-customization-system");
assert.ok(customization);
systems[0].open = true;
const target = nodes(custom, el => el.attrs.id === "native-class-feature-class-feature.navigate.open")[0];
const featureAnchor = nodes(custom, el => el.className === "native-class-feature-short")[0];
const priorWindow = globalThis.window;
const pushes = [];
globalThis.window = { location: { pathname: "/tools/rules-wiki/rules/class.navigate",
    search: "?q=Navigate", hash: "", href: "https://example.test/tools/rules-wiki/rules/class.navigate?q=Navigate" },
    history: { state: {}, replaceState: (state) => { globalThis.window.history.state = state; },
        pushState: (_state, _title, url) => {
    pushes.push(url);
    globalThis.window.location.hash = url.slice(url.indexOf("#"));
} } };
try {
    let prevented = false, stopped = false;
    const event = { target: { closest: () => featureAnchor },
        preventDefault: () => { prevented = true; },
        stopPropagation: () => { stopped = true; } };
    for (const fn of custom.listeners.get("click") ?? []) fn(event);
    assert.equal(prevented, true);
    assert.equal(stopped, true);
    assert.equal(target.open, true);
    assert.equal(target.scrolled, true);
    assert.equal(systems[0].open, true, "Unrelated customization state must remain open");
    assert.deepEqual(pushes, ["/tools/rules-wiki/rules/class.navigate?q=Navigate#native-class-feature-class-feature.navigate.open"]);
} finally { globalThis.window = priorWindow; }

// UI-02: Published Patron mechanics are primary content, not narrow recursive lists.
const patron = renderNativeClass(rule("PatronExample", { customizationSystems: [{
    name: "Patron", options: [{ id: "patron.example.fiend", name: "The Fiend" }]
}] }), { renderValue, hrefForRule: ruleHref,
    getRule: async id => ({ rule: { id, name: "The Fiend", kind: "patron", definition: {
        description: "A Fiend supplies the Warlock's power.",
        features: [{ level: 1, name: "Dark One's Blessing", description: "Gain temporary hit points." },
            { level: 6, name: "Dark One's Own Luck", description: "Add a d10 to an ability check." }],
        spellAccess: { defaultMode: "automatic-known-no-ordinary-selection-cost",
            grants: [{ level: 3, spells: ["Burning Hands", "Command"] }],
            alternateTestMode: "expanded-choice-from-same-list" }, rulesStatus: "playtest"
    } } }) });
assert.equal(nodes(patron, x => x.className === "native-class-customization-option-detail").length, 0,
    "Patron overviews must not expand into a second complete class page");
assert.equal(nodes(patron, x => x.tagName === "INPUT" || (x.tagName === "SELECT" && x.className !== "wiki-mobile-section-select")).length, 0,
    "Patron overviews do not need catalog filters");
assert.equal(nodes(patron, x => x.tagName === "A" && x.attrs.href === ruleHref("patron.example.fiend")).length, 1);

console.log("Class UI remediation: fragment routing, repeated grants, canonical labels, skill choices, Wizard and Patron presentations OK");

import { restoreMountedClassFragment } from "../src/RulesWiki.Web/wwwroot/native-class-navigation.js";
const mounted = { browserSelectedConceptKey: "class.navigate", root: { querySelector: () => custom } };
assert.equal(restoreMountedClassFragment(mounted, { rulesWikiClassView: "class.navigate" },
    { conceptKey: "class.navigate" }, "#native-class-feature-class-feature.navigate.open"), true);
assert.equal(restoreMountedClassFragment(mounted, { rulesWikiClassView: "class.navigate" },
    { conceptKey: "class.other" }, "#native-class-feature-class-feature.navigate.open"), false);
assert.equal(restoreMountedClassFragment(mounted, { rulesWikiClassView: "class.navigate" },
    { conceptKey: "class.navigate" }, ""), true);
