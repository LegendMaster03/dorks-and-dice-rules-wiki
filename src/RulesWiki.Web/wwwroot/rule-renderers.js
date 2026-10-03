import {
    renderCompactStatistic,
    renderEntityHeader,
    renderNamedRuleEntry
} from "./rule-renderer-support.js";
import {
    renderClass,
    renderCondition,
    renderGeneralRule,
    renderMonster,
    renderPrestigeClass,
    renderSpecies,
    renderSubclass
} from "./rule-renderers-specialized.js";
import {
    renderBackground,
    renderCrossEditionFeat,
    renderCrossEditionItem as renderItem,
    renderCrossEditionSkill,
    renderCrossEditionSpell,
    renderGenericReference,
    renderOptionalFeature
} from "./phase4-reference-renderers.js";
import { getEntityBrowserConfig } from "./rules-browser-config.js";

const renderers = new Map([
    ["monster", renderMonster],
    ["spell", renderCrossEditionSpell],
    ["class", renderClass],
    ["subclass", renderSubclass],
    ["prestigeclass", renderPrestigeClass],
    ["race", renderSpecies],
    ["species", renderSpecies],
    ["feat", renderCrossEditionFeat],
    ["background", renderBackground],
    ["optionalfeature", renderOptionalFeature],
    ["item", renderItem],
    ["condition", renderCondition],
    ["skill", renderCrossEditionSkill],
    ["houserule", renderGeneralRule],
    ["rule", renderGeneralRule]
]);

export function renderResolvedRule(entityType, document, options = {}) {
    const configuration = getEntityBrowserConfig(entityType);
    const rendererKey = String(configuration.renderer ?? entityType ?? "").toLowerCase();
    const renderer = renderers.get(rendererKey) ?? renderGenericReference;
    return renderer(document, options);
}

export {
    renderCompactStatistic,
    renderEntityHeader,
    renderNamedRuleEntry
};
