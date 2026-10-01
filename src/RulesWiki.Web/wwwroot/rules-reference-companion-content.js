import { element } from "./ui.js";
import { renderNamedRuleEntry } from "./rule-renderer-support.js";

const SUPPORTED_COMPANION_KINDS = new Set(["monsterfluff", "racefluff", "spellfluff"]);

export function installWikiReferenceCompanionContent(app) {
    const detailCache = new Map();
    const companionCache = new Map();
    let presentationSerial = 0;

    const getWikiReferenceDetail = app.api.getWikiReferenceDetail.bind(app.api);
    app.api.getWikiReferenceDetail = async (referenceIdentity, campaignId = null) => {
        const detail = await getWikiReferenceDetail(referenceIdentity, campaignId);
        detailCache.set(cacheKey(referenceIdentity, campaignId), detail);
        return detail;
    };

    const presentRenderedFragment = app.presentRenderedFragment?.bind(app);
    app.presentRenderedFragment = container => {
        presentRenderedFragment?.(container);
        const serial = ++presentationSerial;
        void presentCompanionContent(app, container, serial, () => presentationSerial, detailCache, companionCache);
    };
}

async function presentCompanionContent(
    app,
    container,
    serial,
    getCurrentSerial,
    detailCache,
    companionCache)
{
    const referenceIdentity = app.browserSelectedConceptKey;
    if (!referenceIdentity || !container?.isConnected) return;

    const campaignId = campaignIdFromScope(app.browserScope);
    const key = cacheKey(referenceIdentity, campaignId);
    const detail = detailCache.get(key);
    if (!detail) return;

    const selection = activeReferenceVariation(container, detail);
    if (!selection || selection.kind === "comparison") return;

    const host = companionHost(container);
    if (!host) return;
    host.querySelector(".rules-wiki-companion-content")?.remove();

    let companionCollection;
    try {
        companionCollection = await getCompanionCollection(
            app,
            companionCache,
            referenceIdentity,
            campaignId);
    } catch (error) {
        // Companion content is supplementary. A deployment rolling from an older Rules Core can
        // temporarily lack this operation without making the reference itself unreadable.
        console.debug("Rules Wiki companion content is unavailable.", error);
        return;
    }

    if (serial !== getCurrentSerial() || !host.isConnected) return;
    if (referenceIdentity !== app.browserSelectedConceptKey
        || campaignId !== campaignIdFromScope(app.browserScope)) return;

    const latestSelection = activeReferenceVariation(container, detail);
    if (!sameSelection(selection, latestSelection)) return;

    const contents = companionContentsForVariation(
        companionCollection?.contents,
        selection.variation);
    const section = renderCompanionSection(contents);
    if (!section) return;

    const rule = host.querySelector(":scope > .rules-core-effective-rule")
        ?? host.querySelector(".rules-core-effective-rule");
    if (rule?.parentElement === host) rule.insertAdjacentElement("afterend", section);
    else host.append(section);
}

function getCompanionCollection(app, cache, referenceIdentity, campaignId) {
    const key = cacheKey(referenceIdentity, campaignId);
    const existing = cache.get(key);
    if (existing) return existing;

    const promise = app.api.operation("getWikiReferenceCompanionContent", [
        referenceIdentity,
        campaignId
    ]).catch(error => {
        cache.delete(key);
        throw error;
    });
    cache.set(key, promise);
    return promise;
}

function companionContentsForVariation(contents, variation) {
    const candidates = uniqueCompanionContents((contents ?? []).filter(content =>
        SUPPORTED_COMPANION_KINDS.has(String(content?.companionKind ?? "").toLowerCase())));
    if (!variation || candidates.length === 0) return [];

    const revisionMatches = candidates.filter(content =>
        sameIdentity(content.sourceEntityRevisionId, variation.sourceEntityRevisionId));
    if (revisionMatches.length) return revisionMatches;

    return candidates.filter(content =>
        sameIdentity(content.sourceEntityId, variation.sourceEntityId));
}

function uniqueCompanionContents(contents) {
    const seen = new Set();
    return contents.filter(content => {
        const key = [
            content?.sourceEntityRevisionId ?? "",
            content?.contentSha256 ?? content?.companionContentId ?? ""
        ].join("|").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function renderCompanionSection(contents) {
    const visible = (contents ?? [])
        .map(content => ({ content, entries: content?.content?.entries }))
        .filter(value => hasEntries(value.entries));
    if (!visible.length) return null;

    const section = element("section", {
        className: "rules-core-monster-section rules-wiki-companion-content"
    });
    section.append(element("h4", {
        className: "rules-core-monster-section-title",
        text: "Description"
    }));

    const showSourceLabels = new Set(visible.map(value => sourceLabel(value.content))).size > 1;
    for (const { content, entries } of visible) {
        const group = element("div", { className: "rules-wiki-companion-source" });
        if (showSourceLabels) {
            group.append(element("div", {
                className: "small text-body-secondary mb-2",
                text: sourceLabel(content)
            }));
        }
        const body = element("div", { className: "rules-core-rules-text" });
        const values = Array.isArray(entries) ? entries : [entries];
        for (const entry of values) body.append(renderNamedRuleEntry(entry));
        group.append(body);
        section.append(group);
    }
    return section;
}

function activeReferenceVariation(container, detail) {
    const pane = container.closest?.(".rules-core-library-detail")
        ?? container.querySelector?.(".rules-core-library-detail")
        ?? container.parentElement?.closest?.(".rules-core-library-detail");
    const tabs = pane
        ? Array.from(pane.querySelectorAll(".rules-core-version-tab"))
        : [];
    const selectedIndex = tabs.findIndex(button => button.getAttribute("aria-selected") === "true");
    const variations = detail?.variations ?? [];

    if (selectedIndex < 0 || selectedIndex === 0) {
        return { kind: "effective", variation: detail?.reference?.effectiveVariation ?? null };
    }
    if (selectedIndex <= variations.length) {
        return { kind: "variation", variation: variations[selectedIndex - 1] };
    }
    return { kind: "comparison", variation: null };
}

function companionHost(container) {
    if (container.matches?.(".rules-core-library-detail-body")) return container;
    return container.querySelector?.(".rules-core-library-detail-body")
        ?? container.closest?.(".rules-core-library-detail-body")
        ?? null;
}

function sameSelection(left, right) {
    if (!left || !right || left.kind !== right.kind) return false;
    return sameIdentity(left.variation?.sourceEntityRevisionId, right.variation?.sourceEntityRevisionId);
}

function sameIdentity(left, right) {
    if (!left || !right) return false;
    return String(left).toLowerCase() === String(right).toLowerCase();
}

function sourceLabel(content) {
    return String(content?.sourceCode ?? content?.name ?? "Source description");
}

function hasEntries(entries) {
    if (entries === null || entries === undefined) return false;
    if (Array.isArray(entries)) return entries.length > 0;
    return String(entries).trim().length > 0;
}

function campaignIdFromScope(scope) {
    const value = String(scope ?? "");
    return value.startsWith("campaign:")
        ? value.slice("campaign:".length).trim() || null
        : null;
}

function cacheKey(referenceIdentity, campaignId) {
    return `${campaignId ?? "global"}|${referenceIdentity}`;
}
