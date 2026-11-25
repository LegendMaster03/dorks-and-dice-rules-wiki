/** Composition root for native presentation. Each workstream owns its slot. */
import { DEFAULT_RULESET_ID } from "./rules-context.js";
import { createNativeRendererRegistry } from "./native-presentation.js";
import { registerNativeRenderers as registerClasses } from "./native-renderers-class.js";
import { registerNativeRenderers as registerCreatures } from "./native-renderers-creature.js";
import { registerNativeRenderers as registerReferences } from "./native-renderers-reference.js";

export const LEGACY_NATIVE_RENDERER = "legacy-first-party";
export function createRegisteredNativeRenderers(renderLegacy) {
    const registry = createNativeRendererRegistry();
    // Preserve existing first-party presentation for records not claimed by
    // a structural adapter. Normal-priority adapters supersede this path.
    registry.register({ id: LEGACY_NATIVE_RENDERER, priority: -1000,
        supports: input => input.context.rulesetId === DEFAULT_RULESET_ID,
        render: renderLegacy });
    registerClasses(registry);
    registerCreatures(registry);
    registerReferences(registry);
    return registry;
}
