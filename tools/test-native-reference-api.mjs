// Native reference operation and browser adapter contract checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
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
    // Synthetic transport envelopes for boundary and malformed-response checks.
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
    // Complete actual response envelopes captured from Core's authenticated HTTP test.
    const fixturePath = new URL('./fixtures/origin-reference/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixturePath), 'utf8'));
    const compressed = readFileSync(new URL('responses.json.gz', fixturePath));
    assert.equal(createHash('sha256').update(compressed).digest('hex'), manifest.responsePackSha256);
    const actual = JSON.parse(gunzipSync(compressed).toString('utf8'));
    assert.equal(Object.keys(actual).length, manifest.fixtureCount);
    const pinned = createRulesContext({ rulesetId: manifest.rulesetId, fingerprint: manifest.fingerprint });
    const pinnedDescriptor = { id: pinned.rulesetId, fingerprint: pinned.fingerprint,
        capabilities: { read: true, originReferenceContractVersion: 1 } };
    let actualCalls = 0;
    const fromFixture = prefix => async (rulesetId, fingerprint, target) => {
        actualCalls++;
        assert.equal(rulesetId, pinned.rulesetId);
        assert.equal(fingerprint, pinned.fingerprint);
        const envelope = actual[prefix + target + '.json'];
        assert.ok(envelope, 'Missing captured envelope for ' + target);
        return structuredClone(envelope);
    };
    const pinnedReader = createRulesetReader({
        getNativeOriginSource: fromFixture('source-'),
        getNativeOriginComponent: fromFixture('component-'),
        getNativeOriginComponentSources: fromFixture('component-sources-'),
        getNativeOriginTraitSources: fromFixture('trait-sources-'),
        getNativeOriginMethods: fromFixture('methods-')
    }, pinned, pinnedDescriptor);
    const red = await pinnedReader.originSource('ancestry.dragonborn.red');
    assert.deepEqual(red, actual['source-ancestry.dragonborn.red.json']);
    assert.deepEqual(red.lineage.map(row => row.id), [
        'species.dragonborn', 'ancestry.dragonborn.chromatic', 'ancestry.dragonborn.red'
    ]);
    assert.equal(red.lineage[0].traitOccurrences[2].canonicalTraitId, 'trait.breath-weapon');
    assert.equal(red.lineage[0].traitOccurrences[2].localId, 'breath-weapon');
    assert.equal(red.lineage[0].traitOccurrences[2].path, '/traits/2');
    const breath = red.directReference.candidates.find(c => c.sourceId === 'species.dragonborn' && c.path === '/traits/2');
    assert.equal(breath.authoredParameters.damageType, 'fire');
    assert.deepEqual(breath.authoredParameters.area, { shape: 'line', lengthFeet: 30, widthFeet: 5 });
    assert.equal(red.effectiveProjectionAvailable, false);
    const root = await pinnedReader.originSource('species.dragonborn');
    assert.equal(root.directReference, null);
    assert.equal(root.lineage[0].definition.selectable, false);
    const wood = await pinnedReader.originSource('ancestry.elf.wood');
    const walk = wood.directReference.fixedValues.find(c => c.slot === 'walkingSpeedFeet');
    assert.deepEqual(walk, { slot: 'walkingSpeedFeet', value: 35,
        sourceId: 'ancestry.elf.wood', path: '/walkingSpeedFeet' });
    assert.match(wood.directReference.candidates.find(c => c.sourceId === 'species.elf' &&
        c.slot === 'walkingSpeedFeet').sourceRestriction, /override/);
    const culture = await pinnedReader.originSource('upbringing.elf.wood');
    assert.equal(culture.lineage[0].id, 'upbringing.elf.general');
    assert.equal(culture.lineage[0].definition.selectable, false);
    assert.equal(culture.lineage[1].definition.equipmentProficiencyGrants.fixed[0].targetId, 'equipment.weapon.shortbow');
    const gene = await pinnedReader.originTraitSources('trait.low-light-vision');
    assert.equal(gene.sources.length, 5);
    assert.ok(gene.sources.every(x => x.relation === 'biological-occurrence'));
    const operational = await pinnedReader.originTraitSources('trait.construct.ordinary-ground-movement');
    assert.equal(operational.sources[0].relation, 'construct-operational-reference');
    assert.equal(operational.sources[0].sourceId, 'construct-component.locomotion-unit');
    const component = await pinnedReader.originComponent('construct-component.locomotion-unit');
    assert.equal(component.componentCategory, 'locomotion');
    assert.ok(component.configuration.designs.some(x => x.id === 'construct-design.wheeled-drive'));
    assert.ok(component.materialAssignmentOptions.some(x => x.id === 'construct-material.steel'));
    assert.equal(component.materialCompatibilityAvailable, false);
    const reverse = await pinnedReader.originComponentSources('crafting-recipe.construct-component.locomotion-unit');
    assert.equal(reverse.output.id, component.componentId);
    assert.equal(reverse.sources[0].path, '/craftingRecipeId');
    const allMethods = await pinnedReader.originMethods();
    assert.equal(allMethods.methods.find(m => m.reference.methodId === 'biological').defaultAvailability, null);
    const typeMethods = await pinnedReader.originMethods('creature-type.dragon');
    assert.equal(typeMethods.methods.find(m => m.reference.methodId === 'biological').defaultAvailability, 'available');
    assert.equal(typeMethods.methods.find(m => m.reference.methodId === 'rite-of-rebirth').createsNewIndividual, false);
    assert.equal(actualCalls, 10); // exactly one operation per requested projection
    // Corrupt only identity metadata, not mechanical content. The real fixture
    // must be rejected if its occurrence or chain identity is misattributed.
    for (const corrupt of [
        x => { x.lineage[0].traitOccurrences[2].sourceId = 'species.elf'; },
        x => { x.lineage[0].traitOccurrences[2].path = '/traits/1'; },
        x => { x.lineage[1].definition.parent = 'species.elf'; },
        x => { x.directReference.fixedValues[0].sourceId = 'species.elf'; }
    ]) {
        const bad = structuredClone(red);
        corrupt(bad);
        const badReader = createRulesetReader({ getNativeOriginSource: async () => bad }, pinned, pinnedDescriptor);
        await assert.rejects(badReader.originSource(red.sourceId), /projection/);
    }
    console.log('Native reference API request-contract and actual Core fixture tests passed.');
} finally {
    globalThis.fetch = original;
}
