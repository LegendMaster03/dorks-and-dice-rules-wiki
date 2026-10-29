import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(repo, 'src/RulesWiki.Web/wwwroot');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const active = ['app.js', 'api.js', 'rules-reference-api.js', 'rules-browser.js', 'rules-browser-detail.js'];
for (const file of active) {
    const code = read(file);
    for (const old of [
        'getWikiReferenceCatalog', 'getWikiReferenceDetail', '/api/workspace/scopes',
        '/api/wiki/references', 'effectiveVariation', 'browseVariation',
        'referenceIdentity', 'sourceEntityRevisionId', 'ruleConceptId', 'canAdjudicate',
        'saveGlobalDecision', 'getCampaignRulesCatalog', 'campaign-baseline-authoring'
    ]) {
        assert.equal(code.includes(old), false, `${file} contains removed contract: ${old}`);
    }
}
assert.match(read('api.js'), /\/upstream\/_rules-wiki\/operations/);
assert.match(read('rules-browser-detail.js'), /definition/);
assert.match(read('rules-browser.js'), /rulesets\/\$\{encodeURIComponent\(rulesetId\)\}/);
assert.match(read('rules-browser.js'), /categoryFacets/);
assert.match(read('app.js'), /mountNativeRulesBrowser/);
console.log('Native reference browser contract checks passed.');
