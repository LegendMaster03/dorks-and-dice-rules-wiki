# Rules Wiki Server Timing

Rules Wiki uses the standard HTTP `Server-Timing` response header for low-cardinality request diagnostics, following the shared Site timing contract.

## Metrics

- `rules-wiki` — whole Rules Wiki request time until response headers are committed.
- `rules-wiki-auth` — Tool Host authentication/introspection time when a hosted request presents Tool Host authentication headers.
- `rules-wiki-rules-core` — elapsed time for one private Rules Core dependency operation, including private-ticket exchange, direct private-tunnel transport, and the wait for Rules Core response headers.

`rules-wiki-rules-core` uses its `desc` field to identify a stable operation category and outcome. Examples include:

```text
rules-wiki-rules-core;desc="reference:ok";dur=18.2
rules-wiki-rules-core;desc="reference:http-403";dur=4.1
rules-wiki-rules-core;desc="source-library:capability-unavailable";dur=0.1
rules-wiki-rules-core;desc="source-admin:ticket-http-503";dur=3.0
```

Operation categories are intentionally low-cardinality and owned by Rules Wiki. Current categories include `reference`, `source-library`, `source-admin`, `normalization`, `source-versioning`, `adjudication`, `workspace`, `relationships`, `rules-authoring`, and the generic `rules-core` fallback. Outcomes use stable values such as `ok`, `http-<status>`, `ticket-http-<status>`, `ticket-invalid`, `capability-unavailable`, `transport-failed`, or `timeout`.

Request paths, reference identities, Campaign IDs, source keys, query text, credentials, private hostnames, and other request-specific data are not exposed in metric names or descriptions.

Rules Wiki propagates downstream `rules-core` and `rules-core-*` metrics returned by Rules Core. It does not propagate nested `platform-*` metrics from the private dependency call. Site appends the outer platform timing independently when it proxies Rules Wiki to the browser.

The private Rules Core tunnel does not pass through Site's HTTP data plane. Therefore `platform-tool` can describe Site's wait on Rules Wiki, but it can not describe Rules Wiki's direct private-tunnel call to Rules Core. `rules-wiki-rules-core` is the caller-owned observation of that dependency, while propagated `rules-core*` metrics describe Rules Core's internal work.

Repeated Rules Core calls may produce repeated `rules-wiki-rules-core` and downstream `rules-core-*` entries. These timings can overlap and must not be summed blindly.
