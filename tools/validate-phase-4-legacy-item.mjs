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

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const rendered = renderResolvedRule("item", {
    name: "Canonical Blade",
    type: "Weapon",
    value: 1200,
    weight: 4,
    charges: 3,
    enhancementBonus: 2,
    specialProperties: ["Keen"],
    entries: ["An older-edition canonical item fixture."]
}, { showDocument: false });

const text = rendered.textContent;
for (const required of [
    "Weapon",
    "12 gp",
    "4 lb.",
    "Charges",
    "3",
    "Enhancement Bonus",
    "2",
    "Special Properties",
    "Keen"
]) {
    assert(text.includes(required), `Canonical item rendering omitted '${required}'. Rendered text: ${text}`);
}

assert(!text.includes("threeX"), `Canonical item rendering leaked a compatibility container: ${text}`);
console.log("Phase 4 canonical item renderer validation passed.");
