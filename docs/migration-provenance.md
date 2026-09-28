# UI migration provenance

The initial Rules Wiki presentation layer was migrated from
`LegendMaster03/dorks-and-dice-rules-core` at commit
`147fb998427b14cce2bdd2157c18a842ed6e421a`.

The migration preserves the existing UI modules, styling, rendering lifecycle,
routing behavior, and browser-side API client. Only Tool ownership and the
fallback Tool mount changed from `rules-core` to `rules-wiki`. The `/api/*`
browser contract is intentionally unchanged and is forwarded server-side to
Rules Core through Site Tool-to-Tool delegation.
