import { element } from "./ui.js";

export const RULE_FAMILY_TABS = [
    ["", "All Content"],
    ["monster", "Bestiary"],
    ["spell", "Spells"],
    ["class", "Classes"],
    ["subclass", "Subclasses"],
    ["prestigeClass", "Prestige Classes"],
    ["feat", "Feats"],
    ["background", "Backgrounds"],
    ["optionalfeature", "Options & Features"],
    ["race", "Races"],
    ["species", "Species"],
    ["item", "Items"],
    ["condition", "Conditions"],
    ["skill", "Skills"],
    ["houseRule", "House Rules"],
    ["rule", "Other Rules"]
];

export const BROWSER_COLUMNS = new Map([
    ["", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("entityType", "Type", "minmax(5rem, .8fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["monster", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("type", "Type", "minmax(5rem, .9fr)"),
        column("cr", "CR", "minmax(2.5rem, .4fr)", "center"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["spell", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("level", "Level", "minmax(4.5rem, .6fr)"),
        column("school", "School", "minmax(6rem, 1fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["class", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("hitDie", "Hit Die", "minmax(4rem, .55fr)", "center"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["subclass", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("parentClass", "Class", "minmax(6rem, 1fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["prestigeClass", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["feat", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("category", "Category", "minmax(6rem, 1fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["background", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["optionalfeature", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["race", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("ability", "Ability", "minmax(7rem, 1.1fr)"),
        column("size", "Size", "minmax(4rem, .65fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["species", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("ability", "Ability", "minmax(7rem, 1.1fr)"),
        column("size", "Size", "minmax(4rem, .65fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["item", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("type", "Type", "minmax(5rem, .8fr)"),
        column("rarity", "Rarity", "minmax(5rem, .8fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["condition", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]],
    ["skill", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("ability", "Ability", "minmax(4rem, .65fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ]]
]);

const COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base"
});

function column(key, label, width, align = null) {
    return { key, label, width, align, sortable: true };
}

export function libraryTitle(entityType) {
    const normalized = entityType ?? "";
    const known = RULE_FAMILY_TABS.find(([value]) => value === normalized);
    return known?.[1] ?? humanizeEntityType(normalized);
}

export function getBrowserColumns(entityType) {
    return BROWSER_COLUMNS.get(entityType)
        ?? BROWSER_COLUMNS.get("")
        ?? [];
}

export function normalizeBrowserSort(entityType, sort) {
    const requestedKey = sort?.key ?? null;
    if (!requestedKey) return { key: null, direction: "asc" };
    const column = getBrowserColumns(entityType)
        .find(value => value.key === requestedKey && value.sortable);
    if (!column) return { key: null, direction: "asc" };
    return {
        key: requestedKey,
        direction: sort?.direction === "desc" ? "desc" : "asc"
    };
}

export function canSortBrowserDataset(loadedCount, totalCount) {
    return Number.isFinite(Number(totalCount))
        && Number(totalCount) >= 0
        && Number(loadedCount) >= Number(totalCount);
}

export function sortRulesForBrowser(rules, entityType, sort) {
    const normalized = normalizeBrowserSort(entityType, sort);
    if (!normalized.key) return [...rules];
    const direction = normalized.direction === "desc" ? -1 : 1;
    return [...rules].sort((left, right) => {
        const primary = compareBrowserValues(
            normalized.key,
            browserColumnValue(left, normalized.key),
            browserColumnValue(right, normalized.key));
        if (primary !== 0) return primary * direction;

        const byName = COLLATOR.compare(left.displayName ?? "", right.displayName ?? "");
        if (byName !== 0) return byName;
        return COLLATOR.compare(left.conceptKey ?? "", right.conceptKey ?? "");
    });
}

export function renderIndexHeader(
    container,
    entityType,
    sort = null,
    onSort = null,
    { canSort = false } = {})
{
    const columns = getBrowserColumns(entityType);
    const normalizedSort = normalizeBrowserSort(entityType, sort);
    container.replaceChildren();
    container.style.gridTemplateColumns = columns.map(value => value.width).join(" ");
    container.setAttribute("role", "row");

    for (const value of columns) {
        const selected = normalizedSort.key === value.key;
        const ariaSort = selected
            ? normalizedSort.direction === "desc" ? "descending" : "ascending"
            : "none";
        const wrapper = element("span", {
            className: `rules-core-library-column-header${value.align === "center" ? " is-center" : ""}`,
            attributes: {
                role: "columnheader",
                "aria-sort": ariaSort
            }
        });

        if (!value.sortable || !onSort) {
            wrapper.textContent = value.label;
            container.append(wrapper);
            continue;
        }

        const disabled = !canSort;
        const button = element("button", {
            type: "button",
            className: `rules-core-library-column-sort${selected ? " is-active" : ""}`,
            disabled,
            title: disabled
                ? "Load all results before sorting. Incremental catalogs remain in authoritative server order."
                : `Sort by ${value.label}`,
            ariaLabel: disabled
                ? `Sort by ${value.label}. Load all results first.`
                : `Sort by ${value.label}${selected ? `, currently ${ariaSort}` : ""}`
        },
        element("span", { text: value.label }),
        selected
            ? element("span", {
                className: "rules-core-library-sort-indicator",
                text: normalizedSort.direction === "desc" ? "▼" : "▲",
                attributes: { "aria-hidden": "true" }
            })
            : null);
        button.addEventListener("click", () => {
            if (disabled) return;
            const direction = selected && normalizedSort.direction === "asc"
                ? "desc"
                : "asc";
            onSort({ key: value.key, direction });
        });
        wrapper.append(button);
        container.append(wrapper);
    }
}

export function renderRuleRows(container, rules, entityType, onSelect, { append = false } = {}) {
    if (!append) container.replaceChildren();
    if (!rules.length) {
        if (!append) {
            container.append(element("div", {
                className: "rules-core-library-empty-list",
                text: "No rules match the current search or filters."
            }));
        }
        return;
    }

    const columns = getBrowserColumns(entityType);
    const template = columns.map(value => value.width).join(" ");
    for (const rule of rules) {
        const row = element("button", {
            type: "button",
            className: "rules-core-library-row",
            dataset: { conceptKey: rule.conceptKey },
            attributes: {
                role: "option",
                "aria-selected": "false"
            }
        });
        row.style.gridTemplateColumns = template;
        for (const value of columns) {
            row.append(renderRuleCell(rule, value));
        }
        row.addEventListener("click", () => onSelect(rule));
        container.append(row);
    }
}

function renderRuleCell(rule, columnDefinition) {
    const value = browserColumnValue(rule, columnDefinition.key);
    const classNames = [
        "rules-core-library-cell",
        columnDefinition.key === "name" ? "rules-core-library-cell--name" : "",
        columnDefinition.key === "source" ? "rules-core-library-cell--source" : "",
        columnDefinition.align === "center" ? "is-center" : ""
    ].filter(Boolean).join(" ");

    if (columnDefinition.key === "name") {
        return element("span", { className: classNames },
            element("span", {
                className: "rules-core-library-row-name",
                text: rule.displayName
            }),
            rule.hasCampaignOverride
                ? element("span", {
                    className: "rules-core-library-row-override",
                    text: "Campaign override"
                })
                : null);
    }

    return element("span", {
        className: classNames,
        text: value || "—",
        title: value || undefined
    });
}

export function browserColumnValue(rule, key) {
    if (key === "name") return rule.displayName ?? "";
    if (key === "entityType") return humanizeEntityType(rule.entityType);
    if (key === "source") {
        return rule.editionDisplayName
            || rule.sourceCode
            || rule.packageDisplayName
            || "";
    }
    if (key === "parentClass") {
        return (rule.relationships ?? [])
            .filter(relationship =>
                relationship.kind === "parent-class"
                && relationship.relatedEntityType === "class")
            .map(relationship => relationship.relatedDisplayName)
            .join(", ");
    }

    return (rule.browserFields ?? [])
        .find(field => field.key === key)?.value
        ?? "";
}

export function renderContinuousIndexFooter(
    container,
    loadedCount,
    totalCount,
    hasMore,
    isLoadingMore,
    loadError,
    onLoadMore)
{
    container.replaceChildren();
    container.hidden = !hasMore && !loadError && !isLoadingMore;
    if (container.hidden) return;

    if (loadError) {
        container.append(element("span", {
            text: `Could not load more: ${loadError}`
        }));
    }

    if (!hasMore) return;

    const button = element("button", {
        type: "button",
        className: "btn btn-sm btn-outline-secondary",
        text: isLoadingMore ? "Loading…" : loadError ? "Retry" : "Load more",
        disabled: isLoadingMore,
        ariaLabel: isLoadingMore
            ? `Loading more results. ${loadedCount} of ${totalCount} loaded.`
            : `Load more results. ${loadedCount} of ${totalCount} loaded.`
    });
    button.addEventListener("click", onLoadMore);
    container.append(button);
}

function compareBrowserValues(key, left, right) {
    const leftNumber = numericBrowserValue(key, left);
    const rightNumber = numericBrowserValue(key, right);
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
    }
    return COLLATOR.compare(String(left ?? ""), String(right ?? ""));
}

function numericBrowserValue(key, value) {
    const text = String(value ?? "").trim().toLowerCase();
    if (!text) return null;
    if (key === "level" && text === "cantrip") return 0;
    if (key === "hitDie") {
        const match = /^d(\d+)$/.exec(text);
        return match ? Number(match[1]) : null;
    }
    if (key !== "cr" && key !== "level") return null;
    const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
    if (fraction) {
        const denominator = Number(fraction[2]);
        return denominator ? Number(fraction[1]) / denominator : null;
    }
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

function humanizeEntityType(entityType) {
    const value = String(entityType ?? "");
    if (!value) return "Rule";
    return value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, match => match.toUpperCase());
}
