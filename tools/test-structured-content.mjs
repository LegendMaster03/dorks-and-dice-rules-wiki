import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { renderStructuredContent, renderMarkdown, renderInlineContent, renderStructuredReference, resolveSourceReferenceIds, stripSourceTags } from "../src/RulesWiki.Web/wwwroot/structured-content.js";
import { createPresentationInput, createRulesetReader, renderGenericNative } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { renderRuleContent, renderNamedRuleEntry } from "../src/RulesWiki.Web/wwwroot/rule-renderer-support.js";

const dom = new JSDOM("<main></main>");
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
const load = name => JSON.parse(fs.readFileSync(new URL("./fixtures/multi-system/"+name+".json",import.meta.url),"utf8"));
const fixtures=[
    ["first-party-001","monster.goblin-warrior"],
    ["dnd-5e","class.warlock"],
    ["dnd-5-5e","spell.acid-splash"],
    ["fate-condensed","section.taking-action-rolling-the-dice"]
];
const fixture=(system,id)=>load(system+"--"+id);
for(const [system,id] of fixtures){
    const record=fixture(system,id),context={rulesetId:system,fingerprint:"fixture-"+system};
    const reader=createRulesetReader({},context);
    const input=createPresentationInput(context,{...context,rule:{id,name:record.name,kind:record.kind,definition:record}},reader);
    const view=renderGenericNative(input);
    assert.equal(view.querySelector("h2").textContent,record.name);
    assert.equal(view.querySelector("script"),null);
    assert.equal(view.querySelectorAll(".ruleset-package-attribution").length,1);
    if(system==="first-party-001"){assert.match(view.textContent,/Melee Attack/);assert.match(view.textContent,/1d6 \+ 2/);}
    if(system==="dnd-5e"){assert.match(view.textContent,/daggers/);assert.ok(view.querySelector('a[href="/rulesets/dnd-5e/rules/baseitem.dagger"]'));}
    if(system==="dnd-5-5e"){assert.match(view.textContent,/Sphere/);assert.match(view.textContent,/4d6/);assert.equal(view.querySelector('a[href*="first-party"]'),null);}
    if(system==="fate-condensed"){assert.ok(view.querySelector("ol"));assert.ok(view.querySelector("ul"));assert.ok(view.querySelector("em"));assert.ok(view.querySelector(".rules-core-dice-symbol"));}
}
const table=renderStructuredContent(fixture("dnd-5e","table.character-advancement"));
assert.equal(table.querySelector("th").textContent,"Experience Points");
assert.equal(table.querySelector("tbody tr td").textContent,"0");
const ladder=renderMarkdown(fixture("fate-condensed","section.getting-started.create-your-characters.skills.the-adjective-ladder").markdown);
assert.ok(ladder.querySelector("table"));
assert.match(ladder.querySelector("table").textContent,/Legendary/);
assert.equal(ladder.querySelector("h6").textContent,"The Adjective Ladder");

const nested={type:"entries",name:"Section",headerEntries:["Header"],entries:[
    "A {@b bold {@i inner}} statement.",
    {type:"list",style:"list-ordered",items:[{type:"item",name:"Choice",entry:"First",prerequisite:{level:2}}]},
    {type:"table",caption:"{@i Results}",colLabels:["Roll"],rows:[{type:"row",row:["{@dice 1d20|10}"]}]},
    {type:"unrecognized",name:"Future",entries:["Recognized body"],unknown:{count:0,flag:false}}
],footerEntries:["Footer"]};
for(const render of [renderStructuredContent,renderRuleContent,renderNamedRuleEntry]){
    const n=render(nested);
    assert.equal(n.querySelector("strong em").textContent,"inner");
    assert.ok(n.querySelector("ol"));assert.match(n.textContent,/Choice/);assert.match(n.textContent,/Prerequisite/);
    assert.equal(n.querySelector("caption").textContent,"Results");assert.equal(n.querySelector("td").textContent,"10");
    for(const s of ["Header","Footer","Recognized body","Unknown","0","false","unrecognized"])assert.ok(n.textContent.includes(s),s);
}
assert.match(stripSourceTags("{@atk mw,rw} {@hit 4} {@h}{@damage 1d6}"),/Melee Weapon Attack or Ranged Weapon Attack:\s+\+4 Hit: 1d6/);
assert.equal(stripSourceTags("{@quickref Cover||3||half cover}"),"half cover");
assert.equal(stripSourceTags("{@dice 1d20|10}"),"10");
assert.match(stripSourceTags("{@unknown literal}"),/literal/);
assert.equal(stripSourceTags("Malformed {@b text"),"Malformed {@b text");
assert.equal(renderInlineContent("{@spell shield|SRD51}").querySelector("a"),null);
const context={rulesetId:"dnd-5e",fingerprint:"snapshot"};
const reader=createRulesetReader({},context);
const input=createPresentationInput(context,{...context,rule:{id:"spell.test",name:"Test",kind:"spell",definition:{}}},reader);
const token="{@spell shield|SRD51}";
assert.equal(renderInlineContent(token,{input,referenceIds:new Map([[token,"spell.shield"]])}).querySelector("a").getAttribute("href"),"/rulesets/dnd-5e/rules/spell.shield");
assert.equal(renderStructuredReference("spell.shield",{...input,references:{context:{...context,fingerprint:"stale"}}}).querySelector("a"),null);
assert.equal(renderStructuredReference("spell.shield",{...input,hrefForRule:()=> "javascript:alert(1)"}).tagName,"SPAN");
assert.equal(renderStructuredContent({ruleId:"spell.shield",rulesetId:"dnd-5-5e"},{input}).querySelector("a"),null);
const foreign={rulesetId:"dnd-5-5e",entries:[{ruleId:"spell.shield"},{rulesetId:"dnd-5e",catalogReferences:["spell.shield"]},token],catalogReferences:["spell.shield"]};
const mixed=renderStructuredContent([foreign,{type:"table",colLabels:["Foreign row"],rows:[{rulesetId:"dnd-5-5e",row:[{ruleId:"spell.shield"},token]}]},{ruleId:"spell.shield"}],{input,referenceIds:new Map([[token,"spell.shield"]])});
assert.equal(mixed.querySelectorAll("a").length,1,"Foreign subtrees and wrapped rows must not borrow local link authority");
assert.match(mixed.textContent,/dnd-5-5e/);
assert.equal(renderStructuredReference("https://evil.example",input).tagName,"SPAN");
assert.equal(renderInlineContent("{@damage 2d6}").querySelector("button"),null);
assert.equal(renderInlineContent("{@damage 2d6}",{renderDice:({display})=>{const b=document.createElement("button");b.textContent=display;return b;}}).querySelector("button").textContent,"2d6");

const md=renderMarkdown("# Heading\n\n**Strong** _emphasis_ [Safe](https://example.org) [Unsafe](javascript:alert%281%29)\n\n- First\n  - Nested\n\n| A | B |\n| --- | --- |\n| X | Y |\n\n<img src=x onerror=alert(1)>\n<script>alert(1)</script>");
assert.ok(md.querySelector("h3"));assert.ok(md.querySelector("strong"));assert.ok(md.querySelector("ul ul"));assert.ok(md.querySelector("table"));
assert.equal(md.querySelectorAll("a").length,1);assert.equal(md.querySelector("img,script,[onerror]"),null);
assert.match(md.textContent,/<script>/);
const malicious=renderStructuredContent({entries:["{@b <img src=x onerror=alert(1)>}"],markdown:"<table>\n<tbody>\n<tr>\n<td>\n<script>alert(1)</script>\n</td>\n</tr>\n</tbody>\n</table>",unknown:"<svg onload=alert(1)>"});
assert.equal(malicious.querySelector("img,script,svg,[onerror],[onload]"),null);
assert.match(malicious.textContent,/<script>/);

const resolvedContext={rulesetId:"dnd-5e",fingerprint:"exact"};
const resolvedRecord={source:{release:"srd-5.1"},catalogReferences:["spell.shield"],entries:["{@spell shield|SRD51} {@spell shield|SRD52} {@spell unknown}"]};
const calls=[];
const resolvedReader=createRulesetReader({getNativeRule:async (set,id)=>{
    calls.push([set,id]);
    return {...resolvedContext,rule:{id,name:"Shield",kind:"spell",definition:{source:{release:"srd-5.1"}}}};
}},resolvedContext);
const resolvedInput=createPresentationInput(resolvedContext,{...resolvedContext,rule:{id:"spell.example",name:"Example",kind:"spell",definition:resolvedRecord}},resolvedReader);
const ids=await resolveSourceReferenceIds(resolvedInput);
const beforeForeign=calls.length;
assert.equal((await resolveSourceReferenceIds(resolvedInput,{rulesetId:"dnd-5-5e",entries:[token]})).size,0);
assert.equal(calls.length,beforeForeign,"Foreign-only tags must not trigger local reference reads");
assert.deepEqual([...ids],[[token,"spell.shield"]]);
assert.deepEqual(calls,[["dnd-5e","spell.shield"]]);
assert.equal(renderStructuredContent(resolvedRecord.entries,{input:resolvedInput,referenceIds:ids}).querySelectorAll("a").length,1);
assert.equal((await resolveSourceReferenceIds({...resolvedInput,lifecycle:{isCurrent:()=>false}})).size,0);
const missingReader=createRulesetReader({getNativeRule:async()=>{throw Error("Unavailable");}},resolvedContext);
assert.equal((await resolveSourceReferenceIds({...resolvedInput,references:missingReader})).size,0);

console.log("Shared structured content contracts passed.");
