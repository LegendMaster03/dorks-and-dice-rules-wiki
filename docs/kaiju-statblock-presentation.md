# Kaiju statblock presentation — source review

**Implementation:** `src/RulesWiki.Web/wwwroot/native-monster-detail.js` and `native-monster-detail.css`.

**Design reference:** Loot Tavern, *Kaiju Fighting Lite v1.05* (official public release). This documentation references layout and rules concepts; it does not reproduce the publisher's example creature, prose, illustrations, or proprietary identifiers. Consult the creator-hosted publication for the original page design.

## Reference findings

- **Printed page 9:** The Kaiju shares the six abilities, saves, damage traits, creature actions, bonus actions, and legendary actions of an ordinary statblock. It differs in the primary damage model: **Chaos Threshold** replaces regular HP; **Finishing Blow** and **Vulnerability Identification DC** are prominent summary values. Traits and attacks may include explicit *Lost While* or *Only While* conditions.
- **Printed page 7:** The separate **Vulnerable Areas** reference table has columns *Vulnerable Area*, *Special Traits*, *CR*, *AC*, and *HP*. Each area can have different AC and HP at different Challenge Ratings. The **Behaviours** table has *Behaviour*, *Trigger*, and *Effect*, including gained and lost features. Behaviours are not an ordered phase ladder.
- **Printed page 8:** **Death Rattle** appears as a separate rule, and **XP Milestones** as a table. These sections are optional and appear only when supplied by content.

## UI ownership

The native monster renderer implements a **variant of the shared statblock**, not a forked renderer. `blockType: "kaiju"` or `statblockType: "kaiju"` explicitly selects the Kaiju layout. `definition.kaiju` carries supplemental **reference** fields; a standard boss can use a subset without changing layout. These are UI-side input expectations, **not yet an authoritative native Core schema**. Align them with the approved content shape when those mechanics are promoted.

The renderer displays the source values and their relationships; it does not compute Vulnerability Identification DC, determine active behaviours, infer targetability, switch abilities on or off, or award milestone XP. Active Chaos and area HP, exploited flags, per-turn Finishing Blow damage, and DM overrides belong to **Block Initiative**, not the Wiki reference.

The optional `kaiju.vulnerableAreas[].variants` array supports per-CR values `{cr, ac, hp}`. An area with one set of values uses `ac`, `hp`, and optionally `cr`. The optional `kaiju.behaviours[]` records use `name`, `trigger`, `effect`, `gainedFeatures`, and `lostFeatures`; additional unfamiliar fields are preserved. `kaiju.xpMilestones` uses source-provided criteria and XP, not calculated totals. Action and trait objects can carry `lostWhile`, `onlyWhile`, or `gainedWhile` labels, shown as **reference text only**.

## Acceptance requirements

- Ordinary 5e/5.5e/3.5e monster statblocks retain their original layout and behaviour.
- Kaiju and mixed-boss presentation preserve unknown mechanical fields without dropping them.
- Desktop shows the inherited statblock in two columns; mobile stacks those components and permits horizontal scrolling in tables.
- Tests use *fictional generic fixtures*, not the publisher's proprietary example creature.
- No Kaiju content import, external API extension, or encounter-tracking state is added as part of this UI change.