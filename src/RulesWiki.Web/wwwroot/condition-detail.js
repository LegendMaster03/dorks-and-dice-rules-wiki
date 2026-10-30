import { element } from "./ui.js";

// This module formats native condition data for display. It does not resolve,
// combine, or change rule effects; Rules Core remains their authority.
const CONDITION_FIELDS = new Set([
    "id", "name", "kind", "description", "appliesConditions", "requiresConditions",
    "derivedConditions", "effects", "levels", "levelRules", "recovery", "onApply",
    "appliedWhen", "endsWhen", "persistsAfterEnding", "escapeOptions", "relationships"
]);

const TERMS = {
    "armor-class": "Armor Class", "positive-dexterity": "positive Dexterity",
    "dodge": "dodge", "ability-check": "ability checks", "attack-roll": "attack rolls",
    "saving-throw": "saving throws", "skill-check": "skill checks",
    "weapon-damage-roll": "weapon damage rolls", "melee": "melee", "ranged": "ranged",
    "concentration": "Concentration", "bonus-action": "Bonus Action",
    "reaction": "Reaction", "action": "Action", "opportunity-attack": "opportunity attacks",
    "normal": "normal AC", "touch": "touch AC", "flat-footed": "flat-footed AC",
    "touch-flat-footed": "touch flat-footed AC", "fear-source": "the source of fear",
    "all": "all", "magic": "magic", "special-sense": "special senses"
};

const EVENT_LABELS = {
    "drop-held-objects": "Drops held objects",
    "recently-swam": "Recently swam",
    "soaked-in-water": "Soaked in water",
    "effect-applies-wet": "An effect applies Wet",
    "grappler-becomes-incapacitated": "The grappler becomes Incapacitated",
    "grappled-creature-moves-outside-grapple-reach": "The creature moves outside the grappler's reach",
    "obvious-threat-appears": "An obvious threat appears",
    "ally-shakes-creature-free": "An ally shakes the creature free",
    "fascinating-effect-ends": "The fascinating effect ends",
    "complete-rest": "Completes a rest",
    "stands-up": "Stands up",
    "takes-damage": "Takes damage",
    "removes-wet-clothing-or-armor": "Removes wet clothing or armor",
    "remains-around-heat-source": "Remains near a heat source",
    "pin-duration-expires": "The pin's duration expires",
    "escapes-pin": "Escapes the pin",
    "pin-broken-by-another-creature": "Another creature breaks the pin",
    "pinner-releases-hold": "The pinner releases the hold",
    "pinner-becomes-incapacitated": "The pinner becomes Incapacitated",
    "pinner-grapple-ends": "The pinner's grapple ends"
};

const HUMAN = value => String(value).replace(/^(?:condition|skill)\./, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());
const term = value => TERMS[value] ?? HUMAN(value);
const list = values => (Array.isArray(values) ? values : [values]).filter(v => v !== undefined && v !== null).map(term).join(", ");
const signed = value => Number(value) > 0 ? `+${value}` : String(value).replace(/^-/u, "−");
const percentage = factor => Number.isFinite(factor) ? `${Number(factor) * 100}%` : String(factor);
const sentence = value => String(value).replace(/\.$/, "") + ".";
const propertyValue = value => {
    if (Array.isArray(value)) return list(value);
    if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${HUMAN(key)}: ${propertyValue(item)}`).join("; ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return term(value);
};

function qualifier(data, prefix = "When") {
    if (!data || typeof data !== "object") return "";
    const pieces = [];
    for (const [key, value] of Object.entries(data)) {
        switch (key) {
            case "anchored": pieces.push(value ? "anchored" : "not anchored"); break;
            case "fearSourceWithinLineOfSight": pieces.push(value ? "the source of fear is in line of sight" : "the source of fear is out of sight"); break;
            case "incomingAttackType": pieces.push(`against ${term(value)} attacks`); break;
            case "targetRelationToGrappler": pieces.push(value === "other-than-grappler" ? "targeting someone other than the grappler" : propertyValue(value)); break;
            case "attackerRelationToGrappler": pieces.push(value === "other-than-grappler" ? "the attacker is not the grappler" : propertyValue(value)); break;
            case "attackerRelationToPinner": pieces.push(value === "other-than-pinner" ? "the attacker is not the pinner" : propertyValue(value)); break;
            case "attackerCanSeeAffectedCreature": pieces.push(value ? "the attacker can see the affected creature" : "the attacker can not see the affected creature"); break;
            case "targetCanSeeAffectedCreature": pieces.push(value ? "the target can see the affected creature" : "the target can not see the affected creature"); break;
            case "effectCreatorCanSeeAffectedCreature": pieces.push(value ? "the effect's creator can see the affected creature" : "the effect's creator can not see the affected creature"); break;
            case "attackerWithinFeet": pieces.push(`the attacker is within ${value} feet`); break;
            case "attackHits": pieces.push(value ? "the attack hits" : "the attack misses"); break;
            case "potentialThreatAppears": pieces.push(value ? "a potential threat appears" : "no potential threat appears"); break;
            case "sourceKind": pieces.push(`the source is a ${list(value).replace(/, /g, " or ").toLowerCase()}`); break;
            case "sourceDealsAnyDamageType": pieces.push(`it deals ${list(value).toLowerCase().replace(/, /g, " or ")} damage`); break;
            case "sourceDealsDamageType": pieces.push(`it deals ${term(value).toLowerCase()} damage`); break;
            case "purpose": pieces.push(`the purpose is ${term(value).toLowerCase()}`); break;
            case "escapeRouteAvailable": pieces.push(value ? "an escape route is available" : "no escape route is available"); break;
            case "pinningCreatureElectsToSilence": pieces.push(value ? "the pinner chooses to silence the creature" : "the pinner does not silence the creature"); break;
            case "hasWetFur": pieces.push(value ? "the creature has wet fur" : "the creature does not have wet fur"); break;
            case "effectSpecifiesOtherwise": pieces.push(value ? "the effect specifies otherwise" : "the effect does not specify otherwise"); break;
            case "imposingEffectOverridesRecovery": pieces.push(value ? "the imposing effect overrides recovery" : "the imposing effect does not override recovery"); break;
            default: pieces.push(`${HUMAN(key)}: ${propertyValue(value)}`);
        }
    }
    return pieces.length ? `${prefix} ${pieces.join(" and ")}` : "";
}

function effectText(effect) {
    const type = effect?.type;
    let title = type ? HUMAN(type) : "Effect";
    let value = "";
    switch (type) {
        case "speed":
            title = "Movement";
            value = effect.operation === "multiply" ? `Speed becomes ${percentage(effect.factor)} of normal.`
                : effect.operation === "set" ? `Speed becomes ${effect.value}.${effect.canIncrease === false ? " It can not be increased." : ""}`
                    : `Speed: ${propertyValue(effect)}`;
            break;
        case "speech": case "awareness": case "sense":
            title = { speech: "Speech", awareness: "Awareness", sense: "Senses" }[type];
            value = type === "sense" ? `${term(effect.sense)}: ${effect.availability === "none" ? "unavailable" : term(effect.availability)}.`
                : effect.availability === "none" ? (type === "speech" ? "Can not speak." : "Unaware of surroundings.")
                    : effect.availability === "faltering-only" ? "Can speak only falteringly." : `${term(effect.availability)}.`;
            break;
        case "saving-throw":
            title = "Saving throws";
            value = effect.result === "automatic-failure" ? `Automatically fails ${term(effect.ability)} saving throws.` : `${term(effect.ability)}: ${term(effect.result)}.`;
            break;
        case "check":
            title = "Ability checks";
            value = effect.result === "automatic-failure" ? `Automatically fails ${term(effect.appliesTo)} requiring ${term(effect.requiresSense)}.` : `${term(effect.result)} on ${term(effect.appliesTo)} requiring ${term(effect.requiresSense)}.`;
            break;
        case "roll-mode":
            title = "Rolls";
            value = `${term(effect.mode)} on ${effect.ability ? `${term(effect.ability)} ` : ""}${term(effect.appliesTo).toLowerCase()}${effect.subject ? ` (${term(effect.subject).toLowerCase()})` : ""}.`;
            break;
        case "roll-modifier":
            title = "Roll modifiers";
            value = `${signed(effect.value)} to ${term(effect.appliesTo).toLowerCase()}${effect.skills ? ` (${list(effect.skills)})` : ""}.`;
            break;
        case "defense-adjustment": case "target-defense-adjustment":
            title = "Defenses";
            if (effect.operation === "suppress-contributions") value = `Suppresses ${list(effect.contributions)} contributions to defense${effect.oncePerComponent ? ", each once" : ""}.`;
            else if (effect.operation === "add-modifier") { title = "Armor Class"; value = `${signed(effect.value)} to ${term(effect.defense)}.`; }
            else if (effect.operation === "set-effective-ability-score") value = `For ${term(effect.defense)}, effective ${term(effect.ability)} is ${effect.value} (modifier ${signed(effect.modifier)}); supersedes ${list(effect.supersedes)}${effect.appliesTo ? ` across ${list(effect.appliesTo)}` : ""}.`;
            else value = propertyValue(effect);
            if (type === "target-defense-adjustment") value = `Target of the creature's attacks: ${value}`;
            break;
        case "action-restriction":
            title = "Actions";
            value = `${effect.cannotTake ? `Can not take ${list(effect.cannotTake)}.` : `Prohibited: ${list(effect.prohibited)}.`}${effect.exceptions ? ` Exceptions: ${list(effect.exceptions)}.` : ""}${effect.doesNotAutomaticallyEndConcentration ? " Does not automatically end Concentration." : ""}`;
            break;
        case "reaction-restriction":
            title = "Reactions";
            value = `Can not make ${list(effect.prohibited)}.${effect.doesNotProhibitOtherReactions ? " Other Reactions remain available." : ""}`;
            break;
        case "movement-restriction":
            title = "Movement";
            value = effect.restriction ? `${term(effect.restriction)}.` : `${effect.prohibited ? `Can not ${list(effect.prohibited).toLowerCase()}.` : ""}${effect.allowed ? ` Allowed: ${list(effect.allowed)}.` : ""}`;
            if (effect.exceptions) value += ` Exceptions: ${list(effect.exceptions)}.`;
            if (effect.relativeTo) value += ` Relative to ${term(effect.relativeTo)}.`;
            break;
        case "concentration":
            title = "Concentration";
            value = effect.operation === "end" ? "Concentration ends." : `${term(effect.operation)}.`;
            break;
        case "critical-hit":
            title = "Critical hits";
            value = `Attacks against the creature that hit${effect.when?.attackerWithinFeet ? ` from within ${effect.when.attackerWithinFeet} feet` : ""} are automatic critical hits.${effect.countsAsNatural20 === false ? " They do not count as natural 20s." : ""}`;
            break;
        case "immunity":
            title = "Immunities";
            value = `${effect.damageType ? `${term(effect.damageType)} damage` : effect.condition ? `${term(effect.condition)} condition` : term(effect.category)} immunity.`;
            break;
        case "damage-resistance":
            title = "Resistances"; value = `Resistance to ${list(effect.damageTypes)} damage.`; break;
        case "effective-ability-score":
            title = "Ability scores";
            value = `${signed(effect.value)} to effective ${term(effect.ability)}${effect.minimum !== undefined ? ` (minimum ${effect.minimum})` : ""}.${effect.affectsDerivedStatistics ? " Affects derived statistics." : ""}`;
            break;
        case "transformation":
            title = "Transformation";
            value = `Becomes ${term(effect.into).toLowerCase()}${effect.typicalMaterial ? ` (typically ${term(effect.typicalMaterial).toLowerCase()})` : ""}.${effect.includes ? ` Includes ${term(effect.includes).toLowerCase()}.` : ""}`;
            break;
        case "weight": case "maximum-hit-points":
            title = type === "weight" ? "Weight" : "Maximum Hit Points";
            value = effect.operation === "multiply" ? `Multiplied by ${effect.factor}.` : propertyValue(effect);
            break;
        case "aging": title = "Aging"; value = effect.operation === "suspend" ? "Aging is suspended." : `${term(effect.operation)}.`; break;
        case "death": title = "Death"; value = "The creature dies."; break;
        case "existing-affliction":
            title = "Existing afflictions";
            value = `${list(effect.afflictions)}: ${term(effect.operation).toLowerCase()}.${effect.resumeWhenConditionEnds ? " Resume when this condition ends." : ""}`;
            break;
        case "targeting-restriction":
            title = "Targeting";
            value = `Can not target ${term(effect.protectedTarget).toLowerCase()} with ${list(effect.prohibited).toLowerCase()}.`;
            break;
        case "targeting-protection":
            title = "Targeting";
            value = `Protected against ${term(effect.appliesTo).toLowerCase()}.`;
            break;
        case "visibility":
            title = "Visibility";
            value = `${term(effect.availability)}.${effect.canBeSeenWith ? ` Can be seen with ${list(effect.canBeSeenWith)}.` : ""}${effect.includesWornOrCarriedEquipment ? " Includes worn or carried equipment." : ""}`;
            break;
        case "obscuration":
            title = "Obscuration"; value = `${term(effect.degree)} for ${term(effect.purpose).toLowerCase()}.`; break;
        case "location-clue":
            title = "Location clues"; value = `Can be detected by ${list(effect.detectableBy).toLowerCase()}.`; break;
        case "turn-activity-limit":
            title = "Turn activity";
            value = `Allowed: ${list(effect.allowed)}. Prohibited: ${list(effect.prohibited)}.${effect.maxMoveEquivalentActivitiesPerTurn !== undefined ? ` Maximum move-equivalent activities per turn: ${effect.maxMoveEquivalentActivitiesPerTurn}.` : ""}`;
            break;
        case "compelled-movement":
            title = "Forced movement";
            value = `Must ${term(effect.priority).toLowerCase()} ${term(effect.direction).toLowerCase()} at ${term(effect.speed).toLowerCase()} speed via ${term(effect.route).toLowerCase()}.${effect.cannotWillinglyApproachFearSource ? " Can not willingly approach the source of fear." : ""}`;
            break;
        case "saving-throw-opportunity":
            title = "Saving throws";
            value = `Save against ${term(effect.against).toLowerCase()}; on success, ${term(effect.resultOnSuccess).toLowerCase()}.`;
            break;
        case "spellcasting-disruption":
            title = "Spellcasting";
            value = `Requires a ${term(effect.requiresCheck)} check (DC ${effect.dc?.base}${effect.dc?.perSpellLevel ? ` + ${effect.dc.perSpellLevel} per spell level` : ""}); on failure, ${term(effect.onFailure).toLowerCase()}.`;
            break;
        case "spellcasting-restriction":
            title = "Spellcasting";
            value = `Prohibited components: ${list(effect.prohibitedComponents)}. Material components: ${term(effect.materialComponents).toLowerCase()}. Focus: ${term(effect.focus).toLowerCase()}.${effect.concentrationCheck ? ` Concentration check DC ${effect.concentrationCheck.baseDC} + ${effect.concentrationCheck.perSpellLevel} per spell level.` : ""}`;
            break;
        default:
            return { title, value: "", unknown: true };
    }
    const parts = [];
    // Surface conditions and reconciliation metadata rather than silently
    // treating a conditional effect as an unconditional rule.
    if (type !== "critical-hit" && effect.when) parts.push(qualifier(effect.when));
    if (effect.unless) parts.push(qualifier(effect.unless, "Unless"));
    if (effect.nonStackingGroup) parts.push(`Stacking group: ${term(effect.nonStackingGroup)}`);
    if (effect.appliesOnceToComposedCheck) parts.push("Applies once to a composed check");
    if (effect.integrationStatus) parts.push(`Integration status: ${term(effect.integrationStatus)}`);
    if (effect.runtimeMapping) parts.push(`Runtime mapping: ${term(effect.runtimeMapping)}`);
    if (effect.nativeActionMapping) parts.push(`Native action mapping: ${term(effect.nativeActionMapping)}`);
    if (effect.actionCosts) parts.push(`Action costs: ${term(effect.actionCosts)}`);
    return { title, value, notes: parts };
}

function effectRow(effect, renderRaw) {
    const { title, value, notes = [], unknown } = effectText(effect);
    if (unknown) {
        return element("div", { className: "rules-wiki-condition-effect-row" },
            element("div", { className: "rules-wiki-condition-effect-label", text: title }),
            element("div", { className: "rules-wiki-condition-effect-copy" }, renderRaw(effect)));
    }
    return element("div", { className: "rules-wiki-condition-effect-row" },
        element("div", { className: "rules-wiki-condition-effect-label", text: title }),
        element("div", { className: "rules-wiki-condition-effect-copy" },
            element("span", { text: value }),
            ...notes.filter(Boolean).map(note => element("div", { className: "rules-wiki-condition-qualifier", text: sentence(note) }))));
}

function effectsSection(title, effects, renderRaw) {
    if (!Array.isArray(effects) || !effects.length) return null;
    const rows = [];
    for (let i = 0; i < effects.length; i++) {
        const item = effects[i];
        // Adjacent unconditional automatic failures can share a single line.
        if (item.type === "saving-throw" && item.result === "automatic-failure"
            && Object.keys(item).every(key => ["type", "ability", "result"].includes(key))) {
            const saves = [item.ability];
            while (i + 1 < effects.length && effects[i + 1].type === "saving-throw"
                && effects[i + 1].result === "automatic-failure"
                && Object.keys(effects[i + 1]).every(key => ["type", "ability", "result"].includes(key))) {
                saves.push(effects[++i].ability);
            }
            if (saves.length > 1) {
                rows.push(element("div", { className: "rules-wiki-condition-effect-row" },
                    element("div", { className: "rules-wiki-condition-effect-label", text: "Saving throws" }),
                    element("div", { className: "rules-wiki-condition-effect-copy", text: `Automatically fails ${list(saves).replace(/, ([^,]+)$/, " and $1")} saving throws.` })));
                continue;
            }
        }
        rows.push(effectRow(item, renderRaw));
    }
    return section(title, element("div", { className: "rules-wiki-condition-effect-list" }, rows));
}

function section(title, ...contents) {
    return element("section", { className: "rules-wiki-condition-section" },
        element("h3", { className: "rules-wiki-condition-section-title", text: title }), ...contents);
}

function conditionAnchor(id, hrefForCondition) {
    const anchor = element("a", { text: term(id), attributes: { href: hrefForCondition(id) } });
    return anchor;
}

function linkedConditions(title, ids, hrefForCondition) {
    if (!Array.isArray(ids) || !ids.length) return null;
    return section(title,
        element("div", { className: "rules-wiki-condition-links" }, ids.map(id => conditionAnchor(id, hrefForCondition))));
}

function detailEntries(title, entries, renderRaw, hrefForCondition) {
    if (!Array.isArray(entries) || !entries.length) return null;
    return section(title, element("ul", { className: "rules-wiki-condition-fact-list" }, entries.map(entry => {
        if (typeof entry === "string" && entry.startsWith("condition.")) return element("li", {}, conditionAnchor(entry, hrefForCondition));
        if (!entry || typeof entry !== "object") return element("li", { text: String(entry) });
        const prefix = entry.event ? EVENT_LABELS[entry.event] ?? term(entry.event)
            : entry.method ? term(entry.method) : null;
        const parts = [];
        for (const [key, value] of Object.entries(entry)) {
            if (key === "event" || key === "method" || key === "condition") continue;
            if (key === "when") parts.push(qualifier(value));
            else if (key === "unless") parts.push(qualifier(value, "Unless"));
            else if (key === "endsWhen") parts.push(qualifier(value, "Ends when"));
            else if (key === "durationHours") parts.push(`after ${value} hours`);
            else if (key === "durationMinutes") parts.push(`after ${value} minutes`);
            else if (key === "durationRounds") parts.push(`after ${value} round${value === 1 ? "" : "s"}`);
            else if (key === "damageType") parts.push(`${term(value).toLowerCase()} damage`);
            else if (key === "minimumDamageTaken") parts.push(`at least ${value} damage`);
            else if (key === "sameDamageInstance") parts.push(value ? "in one instance" : "across instances");
            else parts.push(`${HUMAN(key)}: ${propertyValue(value)}`);
        }
        return element("li", {},
            entry.condition ? conditionAnchor(entry.condition, hrefForCondition) : element("span", { text: prefix ?? "Details" }),
            parts.length ? element("span", { text: ` — ${parts.join("; ")}` }) : null);
    })));
}

function renderLevels(definition, renderRaw) {
    const levels = definition.levels;
    if (!Array.isArray(levels) || !levels.length) return null;
    const rows = levels.map(level => element("tr", {},
        element("th", { attributes: { scope: "row" }, text: String(level.level) }),
        element("td", {}, (level.effects ?? []).length ? level.effects.map(effect => effectRow(effect, renderRaw)) : renderRaw(level))));
    return section("Exhaustion levels",
        definition.levelRules?.stacking ? element("p", { className: "rules-wiki-condition-rule-note", text: definition.levelRules.stacking }) : null,
        element("div", { className: "rules-wiki-condition-table-scroll" },
            element("table", { className: "rules-wiki-condition-level-table" },
                element("thead", {}, element("tr", {}, element("th", { attributes: { scope: "col" }, text: "Level" }), element("th", { attributes: { scope: "col" }, text: "Effects" }))),
                element("tbody", {}, rows))));
}

function renderRecovery(recovery, renderRaw) {
    if (!recovery || typeof recovery !== "object") return null;
    const facts = [];
    if (typeof recovery.general === "string") facts.push(element("li", { text: recovery.general }));
    if (recovery.longRest) facts.push(element("li", { text: `Long rest: remove ${recovery.longRest.levelsRemoved} exhaustion level${recovery.longRest.levelsRemoved === 1 ? "" : "s"}; requires ${list(recovery.longRest.requirements).toLowerCase()}.` }));
    if (recovery.raisedFromDead) facts.push(element("li", { text: `Raised from the dead: remove ${recovery.raisedFromDead.levelsRemoved} exhaustion level${recovery.raisedFromDead.levelsRemoved === 1 ? "" : "s"}.` }));
    for (const [key, value] of Object.entries(recovery)) if (!["general", "longRest", "raisedFromDead"].includes(key)) facts.push(element("li", {}, element("strong", { text: `${HUMAN(key)}: ` }), renderRaw(value)));
    return facts.length ? section("Recovery", element("ul", { className: "rules-wiki-condition-fact-list" }, facts)) : null;
}

export function renderConditionDefinition(definition, { renderRaw, hrefForCondition }) {
    const root = element("div", { className: "rules-wiki-condition-detail" });
    const add = node => { if (node) root.append(node); };
    add(linkedConditions("Also applies", definition.appliesConditions, hrefForCondition));
    add(linkedConditions("Remains after the condition ends", definition.persistsAfterEnding, hrefForCondition));
    add(detailEntries("Required conditions", definition.requiresConditions, renderRaw, hrefForCondition));
    add(detailEntries("Conditional conditions", definition.derivedConditions, renderRaw, hrefForCondition));
    add(effectsSection("Mechanical effects", definition.effects, renderRaw));
    add(renderLevels(definition, renderRaw));
    if (definition.levelRules) {
        const levelRules = definition.levelRules;
        const rules = [
            levelRules.gain,
            levelRules.minimum !== undefined && levelRules.maximum !== undefined
                ? `Levels range from ${levelRules.minimum} to ${levelRules.maximum}.` : null,
            levelRules.endsAtLevel !== undefined ? `The condition ends at level ${levelRules.endsAtLevel}.` : null
        ].filter(Boolean);
        if (rules.length) add(section("Gaining levels", ...rules.map(rule => element("p", { text: rule }))));
    }
    add(detailEntries("Applied when", definition.appliedWhen, renderRaw, hrefForCondition));
    add(detailEntries("On application", definition.onApply, renderRaw, hrefForCondition));
    add(detailEntries("Ends when", definition.endsWhen, renderRaw, hrefForCondition));
    add(detailEntries("Escape options", definition.escapeOptions, renderRaw, hrefForCondition));
    add(renderRecovery(definition.recovery, renderRaw));
    if (definition.relationships) add(section("Relationships", renderRaw(definition.relationships)));
    for (const [key, value] of Object.entries(definition)) {
        if (CONDITION_FIELDS.has(key) || key.startsWith("_")) continue;
        add(section(HUMAN(key), renderRaw(value)));
    }
    const raw = element("details", { className: "rules-wiki-condition-technical" },
        element("summary", { text: "Technical rule data" }),
        element("div", { className: "rules-wiki-condition-technical-body" }, renderRaw(definition)));
    root.append(raw);
    return root;
}
