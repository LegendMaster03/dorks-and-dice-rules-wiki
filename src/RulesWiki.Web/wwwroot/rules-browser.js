import { renderNativeDetail } from "./rules-browser-detail.js";

const PAGE_SIZE = 25;
const el = (name, className, text) => {
    const result = document.createElement(name);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = String(text);
    return result;
};
const displayKind = value => String(value).replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());

function routeFromLocation(basePath) {
    const path = window.location.pathname;
    const base = basePath.replace(/\/$/, "");
    const local = path.startsWith(`${base}/`) ? path.slice(base.length + 1) : "";
    const parts = local.split("/").filter(Boolean);
    if (parts.length !== 2 && parts.length !== 4) return null;
    if (parts[0] !== "rulesets" || (parts.length === 4 && parts[2] !== "rules")) return null;
    try {
        return { rulesetId: decodeURIComponent(parts[1]),
            ruleId: parts.length === 4 ? decodeURIComponent(parts[3]) : null };
    } catch { return null; }
}

function navigationUrl(base, rulesetId, ruleId, query, category, offset) {
    const route = `${base}/rulesets/${encodeURIComponent(rulesetId)}` +
        (ruleId ? `/rules/${encodeURIComponent(ruleId)}` : "");
    const parameters = new URLSearchParams();
    if (query) parameters.set("q", query);
    if (category) parameters.set("category", category);
    if (offset) parameters.set("offset", String(offset));
    return parameters.size ? `${route}?${parameters}` : route;
}

export async function mountNativeRulesBrowser(root, api, hostContext) {
    const base = String(hostContext.toolBasePath ?? "/tools/rules-wiki").replace(/\/$/, "");
    const header = el("header", "native-browser-header");
    header.append(el("h1", "", "Rules Wiki"),
        el("p", "", "Approved native rules · Read-only reference"));
    const controls = el("form", "native-browser-controls");
    const rulesetSelect = el("select");
    rulesetSelect.setAttribute("aria-label", "Ruleset");
    const search = el("input");
    search.type = "search";
    search.placeholder = "Search names or IDs";
    search.setAttribute("aria-label", "Search native rules");
    const categorySelect = el("select");
    categorySelect.setAttribute("aria-label", "Category");
    const searchButton = el("button", "", "Search");
    searchButton.type = "submit";
    controls.append(rulesetSelect, search, categorySelect, searchButton);
    const status = el("p", "native-browser-status");
    status.setAttribute("role", "status");
    const main = el("div", "native-browser-layout");
    const index = el("section", "native-browser-index");
    index.setAttribute("aria-label", "Native rules");
    const results = el("ul", "native-browser-results");
    const pager = el("div", "native-browser-pager");
    const previous = el("button", "", "Previous");
    const next = el("button", "", "Next");
    previous.type = next.type = "button";
    const pageLabel = el("span");
    pager.append(previous, pageLabel, next);
    index.append(results, pager);
    const detail = el("section", "native-browser-detail");
    detail.setAttribute("aria-label", "Selected rule");
    main.append(index, detail);
    root.replaceChildren(header, controls, status, main);

    let catalogSerial = 0;
    let detailSerial = 0;
    let rulesetId = "";
    let selectedId = null;
    let offset = 0;
    let total = 0;
    let knownRulesets = [];

    const setStatus = message => { status.textContent = message; };
    const syncUrl = (replace = false) => {
        const url = navigationUrl(base, rulesetId, selectedId, search.value.trim(), categorySelect.value, offset);
        window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    };
    const showDetail = async (id, navigate = true) => {
        const serial = ++detailSerial;
        selectedId = id;
        if (navigate) syncUrl();
        if (!id) {
            detail.replaceChildren(el("p", "native-empty", "Select a rule to inspect its native definition."));
            return;
        }
        detail.replaceChildren(el("p", "native-browser-status", "Loading definition…"));
        try {
            const response = await api.getNativeRule(rulesetId, id);
            if (serial !== detailSerial) return;
            renderNativeDetail(detail, response, () => void showDetail(null));
        } catch (error) {
            if (serial !== detailSerial) return;
            detail.replaceChildren(el("p", "native-error", `Rule unavailable: ${error.message}`));
        }
    };

    const browse = async (navigate = true) => {
        const serial = ++catalogSerial;
        if (navigate) syncUrl();
        setStatus("Loading approved rules…");
        results.replaceChildren();
        try {
            const page = await api.searchNativeRules(rulesetId, {
                q: search.value.trim(), category: categorySelect.value,
                limit: PAGE_SIZE, offset
            });
            if (serial !== catalogSerial) return;
            total = page.total;
            const previousCategory = categorySelect.value;
            categorySelect.replaceChildren(new Option("All categories", ""));
            for (const facet of page.categoryFacets ?? []) {
                categorySelect.append(new Option(`${displayKind(facet.kind)} (${facet.count})`, facet.kind));
            }
            // Unsupported native categories stay selectable as a truthful empty state.
            if (previousCategory && ![...categorySelect.options].some(option => option.value === previousCategory)) {
                categorySelect.append(new Option(`${displayKind(previousCategory)} (0)`, previousCategory));
            }
            categorySelect.value = previousCategory;
            if (!page.rules.length) {
                results.append(el("li", "native-empty", "No approved rules match this selection."));
            }
            for (const rule of page.rules) {
                const row = el("li");
                const button = el("button", "native-rule-link");
                button.type = "button";
                button.append(el("strong", "", rule.name), el("span", "native-kind", displayKind(rule.kind)));
                button.addEventListener("click", () => void showDetail(rule.id));
                row.append(button);
                results.append(row);
            }
            previous.disabled = offset === 0;
            next.disabled = offset + PAGE_SIZE >= total;
            pageLabel.textContent = `${total ? offset + 1 : 0}–${Math.min(total, offset + PAGE_SIZE)} of ${total}`;
            setStatus(`${total} approved rules · Snapshot ${page.fingerprint.slice(0, 12)}`);
        } catch (error) {
            if (serial !== catalogSerial) return;
            total = 0;
            results.replaceChildren(el("li", "native-error", `Reference catalog unavailable: ${error.message}`));
            previous.disabled = next.disabled = true;
            pageLabel.textContent = "";
            setStatus("Rules Core reference service unavailable.");
        }
    };

    const restoreLocation = async () => {
        const route = routeFromLocation(base);
        const params = new URLSearchParams(window.location.search);
        rulesetId = knownRulesets.some(r => r.id === route?.rulesetId) ? route.rulesetId : knownRulesets[0]?.id ?? "";
        if (!rulesetId) return;
        rulesetSelect.value = rulesetId;
        search.value = (params.get("q") ?? "").slice(0, 200);
        const requestedCategory = params.get("category") ?? "";
        categorySelect.replaceChildren(new Option("All categories", ""));
        if (requestedCategory) categorySelect.append(new Option(displayKind(requestedCategory), requestedCategory));
        categorySelect.value = requestedCategory;
        const requestedOffset = Number(params.get("offset") ?? 0);
        offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 && requestedOffset <= 1_000_000
            ? requestedOffset : 0;
        selectedId = null;
        await browse(false);
        await showDetail(route?.rulesetId === rulesetId ? route.ruleId : null, false);
    };

    controls.addEventListener("submit", event => {
        event.preventDefault();
        offset = 0;
        selectedId = null;
        void showDetail(null, false);
        void browse();
    });
    rulesetSelect.addEventListener("change", () => {
        rulesetId = rulesetSelect.value;
        offset = 0;
        void showDetail(null, false);
        void browse();
    });
    categorySelect.addEventListener("change", () => {
        offset = 0;
        void showDetail(null, false);
        void browse();
    });
    previous.addEventListener("click", () => {
        offset = Math.max(0, offset - PAGE_SIZE);
        void browse();
    });
    next.addEventListener("click", () => {
        if (offset + PAGE_SIZE < total) offset += PAGE_SIZE;
        void browse();
    });
    window.addEventListener("popstate", () => void restoreLocation());

    try {
        const response = await api.getNativeRulesets();
        knownRulesets = response.rulesets ?? [];
        if (!knownRulesets.length) {
            setStatus("No approved rulesets are available.");
            controls.hidden = true;
            return;
        }
        for (const ruleset of knownRulesets) {
            rulesetSelect.append(new Option(`${ruleset.id} (${ruleset.entityCount})`, ruleset.id));
        }
        await restoreLocation();
    } catch (error) {
        controls.hidden = true;
        setStatus(`Rules Core unavailable: ${error.message}`);
    }
}
