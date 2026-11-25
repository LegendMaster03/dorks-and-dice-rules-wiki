# Character Origins Wiki — Workstream C integration handoff

## Scope and pinned baseline

Wiki base: f0a20a1edde83d48428f36fc8d506c4e04d1f87b (PR #48). Accepted Core merge: 0baa466b7fc8f55e5d675b886f76e95f9a4b551f (PR #215). The captured fixture manifest identifies the exact Core candidate fd0a9b5605429e69a4755cfa45724946818c1243 and its catalog fingerprint; it is not deployed data. No Core, shared navigation, shared registry, imported renderer, or production changes.

## Interface for B and integration owner

Import from `wwwroot/origin-biological-reader.js`:

- `supportsBiologicalReader(reader)`: first-party capability gate. Old and foreign readers continue using their existing reference renderers.
- `createBiologicalReader({reader,isCurrent})`: create exactly once per authorized snapshot/workspace lease. `await controller.hierarchy()` returns the complete biological tree; `await controller.select(exactId)` returns a source presentation model. A superseded selection or expired lease returns null; real current failures propagate. Dispose on workspace teardown. Do not reuse a controller across a snapshot transition. One hierarchy read per mounted controller; one source operation per selected record; no per-row lookup.
- `renderBiologicalIndex(tree,input,{selectedId,onNavigate,state})`: detached navigation node for B's index pane. Maintain a mutable state object per workspace snapshot (query, expanded Set). B supplies the qualified selected ID and callback, restores focus when replacing panes and preserves route/selection. Native details/summary controls remain keyboard operable; links use the shared qualified route helper and preserve ordinary modified-click behavior. Search includes matching ancestors and does not fetch.
- `renderBiologicalDetail(model,input)`: detached article for B's detail pane. Input needs context, references (the authorized reader), hrefForRule (existing presentation input), and optional renderSource. Every render verifies the model, reader and input snapshot match. Keep input.renderSource generic or absent; C passes the source-specific definition for attribution. Mount only under a current lease. B owns resizable panes, mobile overlay, routing and package notice exactly once. C renders per-source entity attribution, not package notice.
- `renderBiologicalExplanation(input)`: optional detached reference explanation for B's biological overview. Reads the two exact existing rule IDs once each, independently of tree/detail. Use input.lifecycle (shared lease); discard null/stale results. No additional calls when reading a Species/Ancestry. All canonical characteristic and Upbringing links use existing qualified routes; D/F receive the native IDs, not local occurrence names. No D/F UI required for standalone harness.

Composition sketch (B owns actual routing, loading/error state and focus):

```js
const controller = createBiologicalReader({reader, isCurrent: () => lease.isCurrent()});
const tree = await controller.hierarchy();
if (!tree || !lease.isCurrent()) return;
indexPane.replaceChildren(renderBiologicalIndex(tree, input, {
  selectedId, state: workspaceState, onNavigate: navigateExactId
}));
const model = await controller.select(selectedId);
if (model && lease.isCurrent()) detailPane.replaceChildren(renderBiologicalDetail(model, input));
// On workspace teardown: controller.dispose()
```

Integration owner should register the C reader only for first-party Species/Ancestry routes when the accepted capability exists; no generic renderer replacement and no first-party dispatch into imported rulesets. Do not add a second attribution notice. A route must not manufacture a hierarchy from name or prefix.

## Reference behavior

Exact parent metadata establishes the definition lineage, not a character's Heritage. Nonselectable parents remain readable. Source occurrence keys are source ID plus JSON pointer; canonical IDs are separately linked. Core-supplied fixed intrinsic offers, candidates, authored bindings, source restrictions, unresolved evidence and required choices are displayed without calculating effective values. Null directReference is not interpreted as an empty grant set. Authored source properties and unknown fields are accessible; historical review notes are separate from current gameplay. The source path is not displayed as a gameplay property.

## Standalone acceptance

Run from the repository root:

```sh
npm ci
node tools/test-origin-biological-reader.mjs
node tools/test-origin-biological-reader.mjs /tmp/origin-biological-preview
npm test
```

The C test uses digest-checked captured HTTP responses through the real reader, not manually constructed effective data. It asserts the 43-record family, nested Dragonborn, nonselectable root, Red bindings, Wood Elf override, exact canonical links, occurrence uniqueness across actual sources sharing a canonical characteristic, no authored Upbringing, no extra hierarchy calls, selection and search state, native details controls, and snapshot isolation. Synthetic duplicate, cyclic and delayed transport tests are explicitly labeled. HTML preview outputs are isolated layout examples, not browser screenshots or evidence of final mobile routing. The isolated CI workflow runs the new script and full existing npm suite; it does not modify the shared npm test entry point. The integration owner may consolidate the workflow and entry point after review.

## Remaining acceptance limitations

The accepted fixture pack includes the complete Human and Gnome hierarchy rows, but not their full source envelopes. Add actual authenticated HTTP captures for Human and Gnome/Rock Gnome to finish source-level acceptance. The Red Dragonborn and nonselectable Dragonborn root captures already cover records without a suggested Upbringing. Do not invent synthetic mechanics in their place. A missing field is rendered as unresolved or no authored suggestion; availability or balance is not inferred. Complete effective character grants remain outside the reference contract. Final responsive/resizer keyboard behavior, focus restoration, deep links and browser screenshots require B's integrated workspace and live browser review. No changes to Core or its capture workflow were made for C.
