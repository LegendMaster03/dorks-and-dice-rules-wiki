import { readFileSync } from "node:fs";

class FakeNode {
    constructor(tagName = "", text = "") {
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.attributes = new Map();
        this.dataset = {};
        this.className = "";
        this._text = String(text ?? "");
        this.classList = {
            contains: value => this.className.split(/\s+/).filter(Boolean).includes(value),
            add: value => {
                const values = new Set(this.className.split(/\s+/).filter(Boolean));
                values.add(value);
                this.className = [...values].join(" ");
            }
        };
    }

    append(...nodes) {
        for (const node of nodes) {
            if (node !== null && node !== undefined) this.children.push(node);
        }
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._text = "";
        this.append(...nodes);
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    addEventListener() {}

    querySelector(selector) {
        if (!selector.startsWith(".")) return null;
        const className = selector.slice(1);
        for (const child of this.children) {
            if (!(child instanceof FakeNode)) continue;
            if (child.classList.contains(className)) return child;
            const nested = child.querySelector(selector);
            if (nested) return nested;
        }
        return null;
    }

    set textContent(value) {
        this._text = String(value ?? "");
        this.children = [];
    }

    get textContent() {
        return this._text + this.children.map(child => child?.textContent ?? String(child ?? "")).join("");
    }
}

globalThis.Node = FakeNode;
globalThis.document = {
    createElement: tagName => new FakeNode(tagName),
    createTextNode: text => new FakeNode("#text", text)
};

const { renderResolvedRule } = await import("../src/RulesWiki.Web/wwwroot/rule-renderers.js");

function assertIncludes(rendered, expected, context) {
    const text = rendered.textContent;
    if (!text.includes(expected)) {
        throw new Error(`${context} omitted '${expected}'. Rendered text: ${text}`);
    }
}

const rod = renderResolvedRule("item", {
    name: "Canonical Rod",
    type: "Rod",
    rarity: "Uncommon",
    entries: ["A normalized item fixture."]
}, { showDocument: false });
assertIncludes(rod, "Rod", "Canonical item type");
assertIncludes(rod, "Uncommon", "Canonical item rarity");

const generalFeat = renderResolvedRule("feat", {
    name: "Ability Score Improvement",
    category: "General",
    entries: ["A normalized feat fixture."]
}, { showDocument: false });
assertIncludes(generalFeat, "General", "Canonical feat category");

const epicFeat = renderResolvedRule("feat", {
    name: "Boon Fixture",
    category: "Epic Feat",
    entries: ["An epic feat fixture."],
    _rulesCore: {
        epic: {
            canonicalTerm: "Epic Feat",
            sourceCategory: "Epic Boon",
            tier: "epic"
        }
    }
}, { showDocument: false });
assertIncludes(epicFeat, "Epic Feat", "Core-owned epic feat category");

const phase4Source = readFileSync(
    new URL("../src/RulesWiki.Web/wwwroot/phase4-reference-renderers.js", import.meta.url),
    "utf8");
for (const sourceEncoding of ["RD|XDMG", "SCF", "FEAT_CATEGORY_LABELS", "ITEM_TYPE_LABELS"]) {
    if (phase4Source.includes(sourceEncoding)) {
        throw new Error(`Phase 4 renderer contains source-code translation '${sourceEncoding}'.`);
    }
}

console.log("Phase 4 source-independent canonical presentation validation passed.");
