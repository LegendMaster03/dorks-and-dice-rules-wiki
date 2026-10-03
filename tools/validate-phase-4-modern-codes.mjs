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
    name: "+1 Rod of the Pact Keeper",
    type: "RD|XDMG",
    rarity: "uncommon",
    entries: ["A modern source-shaped item fixture."]
}, { showDocument: false });
assertIncludes(rod, "Rod", "Source-qualified item type");
if (rod.textContent.includes("RD|XDMG") || rod.textContent.includes("Rd|xdmg")) {
    throw new Error(`Source-qualified item type leaked raw code: ${rod.textContent}`);
}

const focus = renderResolvedRule("item", {
    name: "Arcane Focus",
    type: "SCF",
    rarity: "none",
    entries: ["A source-shaped spellcasting focus fixture."]
}, { showDocument: false });
assertIncludes(focus, "Spellcasting Focus", "Spellcasting-focus item type");

const generalFeat = renderResolvedRule("feat", {
    name: "Ability Score Improvement",
    category: "G",
    entries: ["A modern general feat fixture."]
}, { showDocument: false });
assertIncludes(generalFeat, "General", "Modern general feat category");

const epicFeat = renderResolvedRule("feat", {
    name: "Boon Fixture",
    category: "EB",
    entries: ["An epic feat fixture."],
    _rulesCore: {
        epic: {
            canonicalTerm: "Epic Feat",
            sourceCategory: "Epic Boon",
            tier: "epic"
        }
    }
}, { showDocument: false });
assertIncludes(epicFeat, "Epic Feat", "Normalized epic feat category");

console.log("Phase 4 modern source-code presentation validation passed.");
