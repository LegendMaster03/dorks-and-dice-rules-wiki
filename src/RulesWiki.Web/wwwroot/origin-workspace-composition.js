/** Composition only: use authorized native references and existing render leases. */
import { DEFAULT_RULESET_ID, nativeRuleIdentity, parseQualifiedRoute } from "./rules-context.js";
import { createPresentationInput } from "./native-presentation.js";
import { createBiologicalReader, supportsBiologicalReader, renderBiologicalIndex, renderBiologicalDetail, renderBiologicalExplanation } from "./origin-biological-reader.js";
import { loadConstructIndex, renderConstructIndex, renderConstructReference, CONSTRUCT_TABS } from "./native-construct-reference.js";
import { element as el } from "./ui.js";

const biologicalKinds = new Set(["species", "ancestry", "subspecies"]);
const sameContext = (a,b) => ["rulesetId","fingerprint","campaignId","campaignRevisionId"].every(k => (a?.[k] ?? null) === (b?.[k] ?? null));
const asPresentation = input => ({...input, references: input.reader, hrefForRule: id => input.hrefForRule(id)});
export function registerBiologicalRenderer(registry) {
    registry.register({ id: "origins.biological", priority: 40,
        supports: input => biologicalKinds.has(input.rule.kind) && supportsBiologicalReader(input.references) &&
            sameContext(input.context, input.references.context),
        async render(input) {
            const controller = createBiologicalReader({reader: input.references, isCurrent: () => input.lifecycle?.isCurrent() === true});
            try {
                const model = await controller.select(input.rule.id);
                return model ? renderBiologicalDetail(model,input) : null;
            } finally { controller.dispose(); }
        }
    });
}

/** URL fields name an occurrence, never its authorization or snapshot. */
export function readOriginOccurrenceRoute(path, search, context, rule) {
    const route = parseQualifiedRoute(path);
    if (context.rulesetId !== DEFAULT_RULESET_ID || route?.status !== "valid" ||
        route.kind !== "rule" || route.rulesetId !== context.rulesetId || route.ruleId !== rule.id) return null;
    const params = new URLSearchParams(search);
    const keys = ["originSelected", "originSource", "originPath"];
    if (!keys.some(key => params.has(key))) return null;
    if (rule.kind !== "origin-trait" || keys.some(key => params.getAll(key).length !== 1))
        throw new Error("Invalid characteristic occurrence route.");
    const [selectedSourceId, sourceId, occurrencePath] = keys.map(key => params.get(key));
    nativeRuleIdentity(selectedSourceId); nativeRuleIdentity(sourceId);
    if (!/^\/traits\/(0|[1-9][0-9]*)$/.test(occurrencePath)) throw new Error("Invalid characteristic occurrence route.");
    return {context, canonicalTraitId:rule.id, selectedSourceId, sourceId, path:occurrencePath};
}

function split(input,index,detail) {
    const root = el("div",{className:"rules-core-library-workspace wiki-origin-split"});
    root.append(el("div",{className:"rules-core-library-index wiki-origin-index"},index),
        el("div",{className:"rules-core-library-detail wiki-origin-detail"},detail));
    return root;
}
function selectionLink(input,id) {
    return input.hrefForWorkspace(input.view,input.section ?? null) + "?" + new URLSearchParams({originRecord:id});
}
function navigateSelection(input,id) {
    if (!input.lifecycle.isCurrent()) return;
    window.history.pushState({}, "", selectionLink(input,id));
    window.dispatchEvent(new window.PopStateEvent("popstate"));
}
function selectionPrompt() { return el("p",{text:"Select a reference to read its authored details."}); }
function canonicalLink(input,id) { return el("a",{text:"Open canonical reference",attributes:{href:input.hrefForRule(id)}}); }

async function biological(input) {
    const presentation = asPresentation(input);
    const controller = createBiologicalReader({reader: input.reader,isCurrent: input.lifecycle.isCurrent});
    try {
        const tree = await controller.hierarchy();
        if (!tree || !input.lifecycle.isCurrent()) return null;
        const id = input.selectedId;
        if (id !== null && !tree.rows.has(id)) throw new Error("Unknown biological reference.");
        const index = renderBiologicalIndex(tree,presentation,{selectedId:id,onNavigate:id=>navigateSelection(input,id)});
        let detail = selectionPrompt();
        if (id !== null) {
            const model = await controller.select(id);
            if (!model || !input.lifecycle.isCurrent()) return null;
            detail = el("div",{},canonicalLink(input,id),renderBiologicalDetail(model,presentation));
            input.remember?.(model.selected);
        }
        return split(input,index,detail);
    } finally { controller.dispose(); }
}
async function construct(input) {
    const sectionKinds = ["components","designs","enhancements","materials","power-sources","recipes"];
    const kind = CONSTRUCT_TABS[sectionKinds.indexOf(input.section ?? "components")]?.kind;
    if (!kind) throw new Error("Unknown Construct Assembly section.");
    const index = await loadConstructIndex(input.reader,kind,input.lifecycle);
    if (!index || !input.lifecycle.isCurrent()) return null;
    const id = input.selectedId;
    if (id !== null && !index.rows.some(row=>row.id===id)) throw new Error("Unknown Construct Assembly reference.");
    const list = renderConstructIndex(asPresentation(input),index,id,{toolBasePath:input.toolBasePath});
    const links = new Map(index.rows.map(row=>[input.hrefForRule(row.id),row.id]));
    for (const anchor of list.querySelectorAll("a")) {
        const target = links.get(anchor.getAttribute("href"));
        if (!target) continue;
        anchor.addEventListener("click",event=>{
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); navigateSelection(input,target);
        });
    }
    let detail = selectionPrompt();
    if (id !== null) {
        const envelope = await input.reader.resolve(id);
        if (!input.lifecycle.isCurrent()) return null;
        if (envelope.rule.id !== id || envelope.rule.kind !== kind) throw new Error("Construct reference mismatch.");
        const presentation = createPresentationInput(input.context,envelope,input.reader,{
            toolBasePath:input.toolBasePath,lifecycle:input.lifecycle,renderSource:input.renderSource});
        const article = await renderConstructReference(presentation);
        if (!input.lifecycle.isCurrent()) return null;
        detail = el("div",{},canonicalLink(input,id),article);
        input.remember?.(envelope.rule);
    }
    return split(input,list,detail);
}
export function createOriginWorkspaceRenderers() {
    return Object.freeze({
        "species-and-ancestries": biological,
        "biological-origination": input => renderBiologicalExplanation(asPresentation(input)),
        "construct-assembly": construct
    });
}
