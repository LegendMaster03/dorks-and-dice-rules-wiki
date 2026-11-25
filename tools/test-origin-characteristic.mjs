/** Workstream D isolated adapter acceptance. Native records and captured HTTP
 * envelopes are separate from synthetic boundary/occurrence test projections. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { createRulesContext, createRenderLifecycle } from "../src/RulesWiki.Web/wwwroot/rules-context.js";
import { createRulesetReader, createPresentationInput, createNativeRendererRegistry, mountNativePresentation } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { registerNativeRenderers } from "../src/RulesWiki.Web/wwwroot/native-renderers-reference.js";
import { registerOriginCharacteristicRenderer, renderOriginCharacteristic, readCharacteristicOccurrence } from "../src/RulesWiki.Web/wwwroot/native-origin-characteristic.js";

const dom = new JSDOM("<main></main>",{url:"https://wiki.example.test/"});
for(const k of ["window","document","Node","NodeFilter","Element","HTMLElement","Event"]) globalThis[k]=dom.window[k];
const fixture = JSON.parse(readFileSync(new URL("./fixtures/origin-characteristic/records.json",import.meta.url)));
assert.equal(fixture.sourceRevision,"0baa466b7fc8f55e5d675b886f76e95f9a4b551f");
const records = new Map(fixture.fixtures.flatMap(f => (Array.isArray(f.record)?f.record:[f.record]).map(r=>[r.id,r])));
for(const f of fixture.fixtures) {
    assert.match(f.blobSha,/^[0-9a-f]{40}$/);
    assert.ok(f.path.startsWith("data/rulesets/first-party-001/native/"));
}
const packDir = new URL("./fixtures/origin-reference/",import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json",packDir)));
const actual = {};
for(const [name,digest] of [["responses.json.gz","responsePackSha256"],["hierarchies.json.gz","hierarchyPackSha256"],["construct-characteristic-hierarchies.json.gz","constructCharacteristicHierarchyPackSha256"]]){
    const bytes=readFileSync(new URL(name,packDir));
    assert.equal(createHash("sha256").update(bytes).digest("hex"),manifest[digest]);
    Object.assign(actual,JSON.parse(gunzipSync(bytes)));
}
const context = createRulesContext({rulesetId:manifest.rulesetId,fingerprint:manifest.fingerprint});
const descriptor = {id:context.rulesetId,fingerprint:context.fingerprint,capabilities:{read:true,originReferenceContractVersion:1}};
const calls=[];
const captured = (prefix,target) => {
    const result = actual[prefix+target+".json"];
    assert.ok(result,"Missing captured response "+prefix+target);
    return structuredClone(result);
};
const envelope = (extra={}) => ({contractVersion:1,rulesetId:context.rulesetId,fingerprint:context.fingerprint,...extra});
const reverseStub = id => {
    if (actual["trait-sources-"+id+".json"]) return captured("trait-sources-",id);
    // Synthetic empty relationship result; no claim of actual Core reverse data for this ID.
    return envelope({traitId:id,complete:true,sources:[]});
};
function makeReader({reverse=reverseStub,source=id=>captured("source-",id),ctx=context,desc=descriptor}={}) {
    return createRulesetReader({
        getNativeOriginTraitSources:async (r,f,id)=>{calls.push(["reverse",r,f,id]);return reverse(id);},
        getNativeOriginSource:async(r,f,id)=>{calls.push(["source",r,f,id]);return source(id);},
        searchNativeRules:async()=>{throw Error("Unexpected catalog crawl");},
        getNativeRule:async()=>{throw Error("Unexpected entity fan-out");}
    },ctx,desc);
}
function inputFor(id,{record=records.get(id),reader=makeReader(),ctx=context,lifecycle=null}={}) {
    assert.ok(record,id);
    return createPresentationInput(ctx,{rulesetId:ctx.rulesetId,fingerprint:ctx.fingerprint,
        rule:{id,name:record.name,kind:record.kind,definition:record}},reader,{lifecycle});
}
const registry=createNativeRendererRegistry();
registerNativeRenderers(registry);
registerOriginCharacteristicRenderer(registry);
async function show(id,options={}) {
    const input=inputFor(id,options);
    const before=JSON.stringify(input.record);
    assert.equal(registry.select(input).id,"origins.characteristic");
    const root=await renderOriginCharacteristic(input,{occurrence:options.occurrence});
    assert.equal(JSON.stringify(input.record),before);
    assert.equal(root.querySelector("script, img[onerror], [onclick], input, button"),null);
    assert.match(root.textContent,/Reference only/);
    assert.equal(root.querySelectorAll("h3").length>0,true);
    return root;
}
const match=(root,pattern)=>assert.match(root.textContent,pattern);
const qualified=(root,id)=>[...root.querySelectorAll("a")].some(a=>a.getAttribute("href")==="/rulesets/"+context.rulesetId+"/rules/"+id);
const section=(root,title)=>[...root.querySelectorAll("section")].find(s=>s.querySelector(":scope > h3")?.textContent===title);
const breath=await show("trait.breath-weapon");
assert.equal(breath.querySelector("code").textContent,"8 + proficiency-bonus + constitution-modifier");
assert.deepEqual([...breath.querySelectorAll("tbody tr")].map(r=>[...r.cells].map(c=>c.textContent)),[
    ["1","1d10"],["5","2d10"],["11","3d10"],["17","4d10"]]);
match(breath,/Dexterity/i); match(breath,/half damage/i); match(breath,/long rest/i);
match(breath,/one complete action, damage progression, save, and use pool/i);
match(breath,/Source-bound parameters are unresolved/);
assert.equal(section(breath,"Configured source occurrence"),undefined);
const redRequest={context,canonicalTraitId:"trait.breath-weapon",selectedSourceId:"ancestry.dragonborn.red",
    sourceId:"species.dragonborn",path:"/traits/2"};
let before=calls.length;
const red=await show("trait.breath-weapon",{occurrence:redRequest});
assert.deepEqual(calls.slice(before).map(c=>c[0]),["reverse","source"]);
const redConfig=section(red,"Configured source occurrence");
match(redConfig,/fire/i); match(redConfig,/30 ft\./); match(redConfig,/5 ft\./); match(redConfig,/Inherited source occurrence/);
assert.ok(qualified(red,"ancestry.dragonborn.red")); assert.ok(qualified(red,"species.dragonborn"));
const root=await show("trait.breath-weapon",{occurrence:{...redRequest,selectedSourceId:"species.dragonborn"}});
match(root,/Direct-reference configuration unavailable/);
await assert.rejects(readCharacteristicOccurrence(inputFor("trait.breath-weapon"),{...redRequest,path:"/traits/1"}),/not present/);
await assert.rejects(readCharacteristicOccurrence(inputFor("trait.breath-weapon"),{...redRequest,context:{...context,fingerprint:"wrong"}}),/snapshot/);
await assert.rejects(readCharacteristicOccurrence(inputFor("trait.breath-weapon"),{...redRequest,canonicalTraitId:"trait.low-light-vision"}),/identity/);
const tremor=await show("trait.stonebound-tremorsense");
match(tremor,/10 min\./); match(tremor,/bonus action/i); assert.doesNotMatch(tremor.textContent,/60 ft\./);
// Synthetic source projections from exact source-authored values, not HTTP captures.
// A's captured pack does not include these two selected lineages.
function tremorProjection(id){
    const authored=records.get(id);
    const index=authored.traits.findIndex(x=>x.traitId==="trait.stonebound-tremorsense");
    const sourcePath="/traits/"+index, trait=records.get("trait.stonebound-tremorsense").trait;
    const expanded=structuredClone(authored);
    expanded.traits=authored.traits.map((x,i)=>i===index?trait:{...x,id:x.id??x.traitId});
    // This test intentionally isolates exact occurrence validation from full lineage transport;
    // the transport validation of actual source rows is covered by the Red case above.
    const row={id,name:authored.name,kind:authored.kind,inheritedSource:false,definition:expanded,
        traitOccurrences:[{sourceId:id,path:sourcePath,canonicalTraitId:"trait.stonebound-tremorsense",trait}]};
    const candidate={sourceId:id,path:sourcePath,authoredParameters:{subTrait:authored.tremorsenseSubTrait},requiredChoices:[],sourceRestriction:null};
    return {request:{context,canonicalTraitId:"trait.stonebound-tremorsense",selectedSourceId:id,sourceId:id,path:sourcePath},
        response:envelope({sourceId:id,lineage:[row],directReference:{referenceOnly:true,candidates:[candidate]}})};
}
for(const [id,expectEarth] of [["species.dwarf",false],["ancestry.gnome.rock",true]]){
    const {request,response}=tremorProjection(id);
    const isolatedReader={context,originReferenceContractVersion:1,originTraitSources:async()=>reverseStub(request.canonicalTraitId),
        originSource:async()=>response};
    const view=await show(request.canonicalTraitId,{reader:isolatedReader,occurrence:request});
    const config=section(view,"Configured source occurrence");
    match(config,/60 ft\./);match(config,/stone/);
    assert.equal(config.textContent.includes("earth"),expectEarth);
}
const determination=await show("trait.human-determination");
match(determination,/before roll/i);match(determination,/short or long rest/i);match(determination,/Stacks with existing advantageNo/i);
match(await show("trait.level-based-vitality"),/Maximum HP per character level1/);
match(await show("trait.adaptable-learning"),/Additional ranks at character level14/);
const darkness=await show("trait.darkness");
match(darkness,/Character level5/);match(darkness,/Free uses1/);match(darkness,/Slot castingYes/);
match(darkness,/spellcasting ability/i);
const trickster=await show("trait.natural-trickster");
match(trickster,/disguise-self/);match(trickster,/Slot castingNo/);
match(await show("trait.arcane-cantrip"),/after long rest/i);
match(await show("trait.versatile"),/Choice count1/);
match(await show("trait.damage-type-resistance"),/50%/);
match(await show("trait.born-of-ice"),/Required character level4/);
const low=await show("trait.low-light-vision");
assert.equal(section(low,"Source relationships").querySelectorAll("li").length,5);
const construct=await show("trait.construct.ordinary-ground-movement");
match(construct,/Construct operational characteristic/);match(construct,/starting-playtest/);match(construct,/30 ft\./);
assert.ok(qualified(construct,"construct-component.locomotion-unit"));
assert.equal(section(construct,"Source relationships").textContent.includes("Biological source occurrences"),false);
const synthetic=structuredClone(records.get("trait.breath-weapon"));
synthetic.trait.unrecognized={newShape:[0,false,"<img onerror=alert(1)>"]};
synthetic.trait.requiresTraitDefinitionId="invalid id";
synthetic.reviewNotes=["Historical text"];
synthetic.trait.choices=[{required:true,selection:null}];
const unknown=await show(synthetic.id,{record:synthetic});
match(unknown,/New shape/i);match(unknown,/Historical review notes/);match(unknown,/invalid id/);
assert.ok(![...unknown.querySelectorAll("a")].some(a=>a.textContent==="invalid id"));
const denied=makeReader({reverse:()=>{throw Error("denied");}});
await assert.rejects(renderOriginCharacteristic(inputFor("trait.breath-weapon",{reader:denied})),/denied/);
const stale=makeReader({reverse:id=>({...reverseStub(id),fingerprint:"stale"})});
await assert.rejects(renderOriginCharacteristic(inputFor("trait.breath-weapon",{reader:stale})),/snapshot/);
const malformed=makeReader({reverse:id=>envelope({traitId:id,complete:true,sources:[{relation:"biological-occurrence",kind:"species",sourceId:"invalid id",path:"/traits/0"}]})});
await assert.rejects(renderOriginCharacteristic(inputFor("trait.breath-weapon",{reader:malformed})),/projection/);
before=calls.length;
const old=makeReader({desc:{...descriptor,capabilities:{read:true}}});
match(await show("trait.breath-weapon",{reader:old}),/Source relationship reference unavailable/);
assert.equal(calls.length,before);
for(const system of ["dnd-5e","dnd-5-5e","fate-condensed"]){
    const ctx=createRulesContext({rulesetId:system,fingerprint:"foreign"});
    assert.notEqual(registry.select(inputFor("trait.breath-weapon",{ctx,reader:null})).id,"origins.characteristic");
}
const life=createRenderLifecycle(), lease=life.begin(context,"trait.breath-weapon");
let release;
const delayed=makeReader({reverse:()=>new Promise(resolve=>{release=resolve;})});
const main=document.querySelector("main");main.textContent="Newer view";
const pending=mountNativePresentation(main,registry,inputFor("trait.breath-weapon",{reader:delayed,lifecycle:lease}));
life.cancel();release(reverseStub("trait.breath-weapon"));
assert.equal(await pending,false);assert.equal(main.textContent,"Newer view");
console.log("Workstream D characteristic presentation: pinned record, captured HTTP, isolated occurrence and negative DOM cases passed.");
