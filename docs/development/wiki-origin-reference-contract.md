# Character Origins Wiki — reference contract candidate

Status: **partial, not accepted for consumer implementation or merge**. Core baseline `f4ca93e69ef52d0b7f0d59f2d0710c033c842e7f`; initial Core candidate `84bdd0901bf83f0dc0a5699cf406675aaa271959` (PR #215). Wiki baseline `3a66ce2a6b70ce7bb0bbb5cdf0b2206e409625f8`. Candidate protocol version 1. Use the existing authorized `api.openRulesetReader` and render lifecycle. No new UI renderer or gameplay behavior.

## Transport and capability

The first-party descriptor advertises `capabilities.originReferenceContractVersion: 1`. The exact snapshot-pinned reader preserves this capability. Older Core and foreign readers expose null and reject Origin-specific calls without a network request. A browser sends only named operations; the Wiki dispatcher accepts [rulesetId, fingerprint, familyOrExactId] and maps one operation to one private GET. The Core ticket and exact fingerprint are checked before projection. Stale 409, invalid 400, missing/unsupported 404, denied 401/403 and unavailable 503 propagate without fallback. All successful envelopes carry contractVersion, rulesetId and fingerprint; readers additionally check target identity. Do not combine results across readers or snapshot revisions. Existing native search/detail operations are unchanged.

| Reader method | Named operation | Candidate Core route suffix |
| --- | --- | --- |
| originHierarchy(family) | getNativeOriginHierarchy | /origins/hierarchy/{family} |
| originSource(id) | getNativeOriginSource | /origins/source/{sourceId} |
| originTraitSources(id) | getNativeOriginTraitSources | /origins/trait-sources/{traitId} |
| originComponent(id) | getNativeOriginComponent | /origins/component/{componentId} |

Core prefix: /api/private/rulesets/{rulesetId}; query: fingerprint. Hierarchies (biological, upbringing, construct-components) and reverse trait relationships are complete bounded families, not paginated streams; Core fails rather than silently truncating when the scanned family exceeds 256 records. Use native search for ordinary paginated categories. No client-side global filtering of partial pages.

## Capability matrix for B–F

| Consumer need | Candidate evidence/operation | Limitation |
| --- | --- | --- |
| Origination navigation and methods | Existing rule detail for rule.creature-origination; hierarchy acquisitionMethodIds | Authored method defaults are not executable availability; normalized private method discovery is pending. |
| Biological browsing | originHierarchy("biological") and originSource(id) | Authored parent, selectable, defaultUpbringingId, status, exact source lineage, original definition and separate trait occurrences. Effective direct lineage is explicitly unavailable. |
| Gene reference | originTraitSources(id), existing canonical trait detail | Exact sourceId and /traits/index pointer; canonicalTraitId from loader mapping; no local-ID matching. Reverse links cover authored biological occurrences and direct operational component references only. |
| Construct browsing | originHierarchy("construct-components"), originComponent(id), existing detail | Path-derived component category, configuration discovery (designs, enhancements, power sources, material slots, modes, variants, capabilities, requirements and recipe output links), original definition. Exact material compatibility and broader reverse relationships pending. |
| Upbringing/Background | originHierarchy("upbringing"), originSource(id), existing Background detail | Authored root-to-selected benefit sources, nested choices, equipment intentions; not earned grants or inventory. |
| Shared filtering and transport | Existing reader, bounded family reads | Additional server-side filters and capability-specific reverse projections pending; no fabricated filters. |

Example shape (illustrative, not a captured runtime response): `{contractVersion:1,rulesetId:"first-party-001",fingerprint:"<snapshot>",family:"biological",complete:true,rows:[{id:"species.dragonborn",name:"Dragonborn",kind:"species",parentId:null,selectable:false,defaultUpbringingId:null,acquisitionMethodIds:[]}]}`. The actual Core fixture test loads the repository's native package, verifies the Red Dragonborn lineage by exact ID `ancestry.dragonborn.red`, the canonical Breath Weapon occurrence, Wood Elf authored override, Upbringing parent and Construct recipe/trait links. Wiki's current reader test uses explicitly synthetic transport envelopes. Capture the actual loader-expanded Core response and pin fixture provenance before accepting the shared contract.

## Compatibility and acceptance

Keep both PRs distinct. Core first; Wiki transport second after the Core contract is accepted. Integration branch coordination and exact-head CI are still required. No production deployment or merge authorization. Final consumers must not treat this draft as stable. Do not derive character grants, availability, effective direct values, or material compatibility from authored evidence. No publication-policy or mechanics POST changes.
