// Native reference operation and browser adapter contract checks.
import assert from 'node:assert/strict';
import { createRulesetReader } from '../src/RulesWiki.Web/wwwroot/native-presentation.js';
import { createRulesContext } from '../src/RulesWiki.Web/wwwroot/rules-context.js';

import { RulesCoreApi } from '../src/RulesWiki.Web/wwwroot/api.js';
import { installNativeReferenceApi } from '../src/RulesWiki.Web/wwwroot/rules-reference-api.js';
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
    await api.getNativeOriginHierarchy('first-party-001', 'snapshot', 'biological');
    assert.equal(calls.at(-1).url, '/tool-host/rules-wiki/api/upstream/_rules-wiki/operations/getNativeOriginHierarchy');
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), { arguments: ['first-party-001', 'snapshot', 'biological'] });
    // Synthetic transport envelopes: real expanded-catalog coverage belongs to Core HTTP tests.
    const context = createRulesContext({ rulesetId: 'first-party-001', fingerprint: 'snapshot' });
    const descriptor = { id: context.rulesetId, fingerprint: context.fingerprint,
        capabilities: { read: true, originReferenceContractVersion: 1 } };
    let originCalls = 0;
    const stub = { getNativeOriginHierarchy: async (rulesetId, fingerprint, family) => {
        originCalls++;
        return { rulesetId, fingerprint, family, contractVersion: 1, complete: true,
            rows: [{ id: 'species.elf', kind: 'species', name: 'Elf' }] };
    } };
    const reader = createRulesetReader(stub, context, descriptor);
    assert.equal(reader.originReferenceContractVersion, 1);
    assert.equal((await reader.originHierarchy('biological')).rows[0].id, 'species.elf');
    assert.equal(originCalls, 1);
    const old = createRulesetReader(stub, context, { ...descriptor, capabilities: { read: true } });
    await assert.rejects(old.originHierarchy('biological'), /unavailable/);
    const foreignContext = createRulesContext({ rulesetId: 'dnd-5e', fingerprint: 'snapshot' });
    const foreign = createRulesetReader(stub, foreignContext, { ...descriptor, id: 'dnd-5e' });
    await assert.rejects(foreign.originHierarchy('biological'), /unavailable/);
    assert.equal(originCalls, 1);
    const stale = createRulesetReader({ getNativeOriginHierarchy: async () => ({
        rulesetId: 'first-party-001', fingerprint: 'stale' }) }, context, descriptor);
    await assert.rejects(stale.originHierarchy('biological'), /snapshot/);
    const denied = createRulesetReader({ getNativeOriginHierarchy: async () => {
        throw new Error('denied');
    } }, context, descriptor);
    await assert.rejects(denied.originHierarchy('biological'), /denied/);
    let methodCalls = 0;
    const methodReader = createRulesetReader({ getNativeOriginMethods: async (rulesetId, fingerprint, scope) => {
        methodCalls++;
        return { rulesetId, fingerprint, scope, contractVersion: 1, previewOnly: true,
            methods: [{ reference: { ruleId: 'rule.creature-origination', methodId: 'biological' } }] };
    } }, context, descriptor);
    assert.equal((await methodReader.originMethods()).scope, 'all');
    assert.equal((await methodReader.originMethods('creature-type.dragon')).scope, 'creature-type.dragon');
    await assert.rejects(methodReader.originMethods('species.elf'), /scope/);
    assert.equal(methodCalls, 2);
    const wrongScope = createRulesetReader({ getNativeOriginMethods: async () => ({
        rulesetId: context.rulesetId, fingerprint: context.fingerprint, contractVersion: 1, scope: 'all'
    }) }, context, descriptor);
    await assert.rejects(wrongScope.originMethods('creature-type.dragon'), /projection/);
    console.log('Native reference API request-contract tests passed.');
} finally {
    globalThis.fetch = original;
}
