# Workstream F — Life Experiences reader integration

## Composition boundary

The integration owner owns the shared composition root, routing and permanent test entry points. Register the exported function from native-renderers-life-experiences.js in native-renderer-registration.js:

    import { registerLifeExperienceRenderers } from "./native-renderers-life-experiences.js";
    // Inside createRegisteredNativeRenderers:
    registerLifeExperienceRenderers(registry);

The adapter is first-party-only, checks the native entity kind and identity, and uses priority 50 over the existing reference.native-origin adapter (priority 10). Do not register another renderer at the same priority for upbringing or background. No changes to imported-origin dispatch. Use ordinary qualified native detail routes for both kinds. Workstream B owns the Life Experiences navigation and should use originHierarchy("upbringing") and originHierarchy("backgrounds") for complete lists; no separate F list route or workspace is necessary.

The adapter returns a detached article asynchronously. The existing mountNativePresentation lifecycle rejects stale renders and the native-rule-detail decorator appends the single package notice. Do not append another package notice inside F. Existing entity attribution remains separate.

## Reads and identity

Upbringing detail: one originSource(id), one originHierarchy("biological"), and no global search. Lineage is rendered in the supplied order, with authored source IDs and JSON pointers on each occurrence. Suggestions use only the projected defaultUpbringingId. Background detail uses the existing native record; no originSource call. Neither reader executes inheritance, grants, choice validation, duplicate resolution, inventory or character mutation.

Exact native references are resolved through the same context, with a maximum of 64 distinct detail reads per view. A missing/unpublished target remains text; bare language codes, descriptive equipment names and local choice IDs are not converted into inferred catalog IDs. Conditional equipment branches display the exact matched local choice and option names when unique; unresolved local references remain authored IDs. If the bound exceeds 64, optional links remain text. Required projection failures propagate without fallback. Optional authorization/snapshot errors with status or stale/snapshot diagnostics propagate; other unresolved targets remain text. Source records and review notes remain available in disclosures; repository paths, commit IDs and branch names are not presented as gameplay provenance.

## Tests and preview

Run after npm ci:

    node tools/test-life-experiences-reader.mjs
    node tools/test-life-experiences-reader.mjs --preview-dir /tmp/life-experience-previews --geometry

Four fixture packs contain all 29 authored Upbringing/Background records plus the applicable selection rule at Core merge 0baa466b7fc8f55e5d675b886f76e95f9a4b551f. Each entry carries its source path and Git blob SHA for test verification. The A captures remain unmodified; the test uses captured complete hierarchy envelopes and the captured Wood Elf source response at A's candidate revision. Other source envelopes are explicitly synthetic transport wrappers around exact pinned native records; they are not new Core projections or claims about the deployed server. Existing native entity fixtures exercise qualified references, and the imported Acolyte fixture exercises foreign dispatch. Tests cover missing targets, unknown data and lifecycle failures. The exported HTML pages use available Wiki styles in an isolated pane harness, not the complete Site shell. With --geometry the suite exercises three representative articles in Chromium at desktop and compact viewport/pane widths. Full composed browser and responsive navigation acceptance remain integration-owner responsibilities; add the test command to the shared test entry point.

The isolated branch-only workflow, if present, is for workstream evidence and can be removed after the owner wires the test into the shared suite. It does not deploy.
