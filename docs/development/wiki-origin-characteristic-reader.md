# Workstream D — isolated characteristic reader handoff

Base Wiki: f0a20a1edde83d48428f36fc8d506c4e04d1f87b.
Core source revision: 0baa466b7fc8f55e5d675b886f76e95f9a4b551f.
HTTP captures: Workstream A manifest (candidate fd0a9b5605429e69a4755cfa45724946818c1243; matching native package).

## Composition boundary

Import registerOriginCharacteristicRenderer from native-origin-characteristic.js and call it once in the owner-managed registry composition. It registers origins.characteristic (priority 40) for identity-matched first-party origin-trait definitions containing a trait object. It does not claim imported, conceptual Manifestation, lineage, or Construct component records. Registry rendering invokes the canonical reader; the normal presentation mount owns package attribution exactly once, stale mount suppression and error presentation.

For an occurrence view, B/C may invoke renderOriginCharacteristic(input, { occurrence }) on a detached surface under the same lifecycle and decorator. The occurrence object is:

- context: exact current reader context (rulesetId, fingerprint, campaignId, campaignRevisionId)
- canonicalTraitId: exact canonical rule ID matching input.rule.id
- selectedSourceId: exact selected lineage ID (not necessarily the defining source)
- sourceId: exact defining source ID
- path: exact /traits/index pointer from Workstream A

C must pass the defining occurrence, not infer it from the local ID or from the display label. Do not serialize a context into a cross-snapshot cache or trust a URL's claimed fingerprint; construct the context from the authorized reader when opening the route. B owns route encoding and restoration, including invalid occurrence handling. D returns a detached article, or null when the lease is stale (the shared mount discards it). No new route or composition changes are made here. E uses normal canonical qualified links for operational traits; D distinguishes operational relationships and never treats them as biological inheritance.

The view performs one bounded originTraitSources read for a capable reader and at most one originSource read for an explicitly requested occurrence. No hierarchy crawl, per-source detail fan-out or public fallback. Old first-party readers retain canonical rules with unavailable relationship context; malformed, stale and denied requests reject rather than render a partial authorized context. Unknown authored fields, choices, units and restrictions remain readable. Historical review notes are separate; no point prices or mechanical grants are computed.

## Tests

Run `npm ci --ignore-scripts --no-audit --no-fund` and `node tools/test-origin-characteristic.mjs`.
The integration owner should add the isolated test entry point to the integrated test suite and run all existing suites after composition. The standalone branch validation workflow, if retained, is scoped only to Workstream D; remove it or consolidate it after integration.

The fixtures in tools/fixtures/origin-characteristic/records.json are exact repository JSON values fetched from the pinned Core merge commit (with source paths and blob SHAs). Workstream A's compressed envelopes are verified using its manifest digests. The Red Dragonborn configured source case and Low-Light Vision/Construct reverse relationships use actual captured HTTP responses. Other reverse stubs and Rock Gnome/Dwarf occurrence projection examples are synthetic isolated cases explicitly based on source-authored fields; they are not captured runtime envelopes.

## Remaining acceptance

- Review integrated routes and shared registration with B/C/E, including navigation back to the defining occurrence; exact source relationship links currently target the ordinary qualified source record with its occurrence path displayed separately.
- Review desktop and mobile geometry after shared workspace composition (responsive tables reuse the existing shared renderer; JSDOM does not verify physical layout).
- Obtain actual Rock Gnome/Dwarf configured projection captures if needed for end-to-end validation. Unresolved bindings stay unresolved when no exact direct-reference candidate exists.
- Native spell fields without exact qualified IDs remain authored labels, not guessed links. No standalone Manifestation record, pricing projection, eligibility, live character state or active grant is manufactured. Construct reverse links describe operational references only.
