import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/RulesWiki.Web/wwwroot');
const moduleFromFile = async file => import('data:text/javascript;base64,' +
    Buffer.from(fs.readFileSync(path.join(dir, file))).toString('base64'));
const { RulesCoreApi } = await moduleFromFile('api.js');
const { installNativeReferenceApi } = await moduleFromFile('rules-reference-api.js');
const calls = [];
const original = globalThis.fetch;
globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ rulesets: [{ id: 'first-party-001' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
};
try {
    const api = installNativeReferenceApi(new RulesCoreApi({
        apiBaseUrl: '/tool-host/rules-wiki/api/', toolBasePath: '/tools/rules-wiki'
    }));
    await api.getNativeRulesets();
    await api.searchNativeRules('first-party-001', { q: 'Blinded', category: 'condition', limit: 25, offset: 0 });
    await api.getNativeRule('first-party-001', 'condition.blinded');
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map(x => x.url), [
        '/tool-host/rules-wiki/api/upstream/_rules-wiki/operations/getNativeRulesets',
        '/tool-host/rules-wiki/api/upstream/_rules-wiki/operations/searchNativeRules',
        '/tool-host/rules-wiki/api/upstream/_rules-wiki/operations/getNativeRule'
    ]);
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].options.body),
        { arguments: ['first-party-001', { q: 'Blinded', category: 'condition', limit: 25, offset: 0 }] });
    assert.deepEqual(JSON.parse(calls[2].options.body), { arguments: ['first-party-001', 'condition.blinded'] });
    assert.throws(() => api.operation('saveGlobalDecision'), /unavailable/);
    assert.ok(calls.every(x => !String(x.options.body).includes('ticket') &&
        !String(x.url).includes('core-private')));
    console.log('Native reference API request-contract tests passed.');
} finally {
    globalThis.fetch = original;
}
