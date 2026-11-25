# Actual native Origins reference fixtures

The manifest pins the Core commit, snapshot fingerprint, CI run, archive digest and fixture pack digest. The gzip pack contains ten **complete** HTTP JSON responses, extracted without changing JSON values from the isolated authenticated Core capture artifact. The other six captured envelopes are complete hierarchy families; their verified counts are recorded in the manifest and tested in Core. The gzip pack avoids duplicating the loader-expanded payload and traits across several source lineages as large uncompressed files. It is not a runtime asset.

Inspect any response with standard Python or Node tools:

```sh
python3 -c 'import gzip,json; d=json.load(gzip.open("tools/fixtures/origin-reference/responses.json.gz")); print(json.dumps(d["source-ancestry.dragonborn.red.json"], indent=2))'
```

Regenerate from the pinned Core test using ORIGIN_REFERENCE_FIXTURE_DIRECTORY, and update the manifest only after validating the source snapshot and exact response envelopes. Keep synthetic malformed/stale/denied test cases separate.
