# Preserve the Wiki interface during the native Core migration

The native migration replaced the existing Wiki interface instead of limiting the change to its Core integration. This correction restores the browser from pre-migration commit `4a3abcb39dc09c38ef7fc80b44783fc43f347c20`: grouped navigation, original stylesheets, split-pane index/detail layout, type and text filters, sorting, continuous loading, keyboard navigation, responsive detail navigation, and reference context presentation.

The Wiki host and private-tunnel client remain on the native backend. The only dispatched Core operations remain `getNativeRulesets`, `searchNativeRules`, and `getNativeRule`. No legacy Core endpoint, source database, anonymous distribution, publishing operation, or executable mechanic is restored.

`rules-reference-api.js` supplies presentation rows for the existing index from native responses. All identity fields contain the exact native ID. Leveled conditions appear in the existing Conditions category; rule chapters appear with Other Rules. Their original native kinds remain visible in detail. The client follows the actual native pagination contract (`total`, maximum 100 per page), rejects snapshot drift, and does not invent source variations, editions, publications, campaign decisions, or content.

Native definitions use the original detail pane and styling with text-only nested rendering. Source/edition/package filters and workspaces not implemented by the rewritten Core are retained visibly with disabled controls and explanations. Their implementation files remain in the repository. They are not substituted with fake successful responses.

Both historical Wiki detail routes and links produced by the initial native browser remain readable. Deployment keeps the existing image pinning, network isolation, Core prerequisite, and rollback/withdrawal guards.

Validation includes actual DOM execution of the restored application against native-contract fixture responses, checking shell structure, native multi-page reads, condition grouping, search, selection URLs, empty categories, disabled unsupported workspaces, and rendering untrusted strings as text. Server integration tests retain the real named-operation/authentication boundary checks. Production acceptance must repeat the native catalog, detail, search, category navigation, and reload checks through the authenticated Site.
