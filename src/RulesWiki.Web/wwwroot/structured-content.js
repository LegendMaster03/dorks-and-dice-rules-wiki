/** Shared structured-content presentation; never evaluate mechanics or source HTML. */
import { nativeRuleIdentity, ruleRoute } from "./rules-context.js";
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const add=(n,...c)=>{n.append(...c);return n;};
const own=(o,k)=>Object.hasOwn(o,k);
const label=k=>String(k).replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ").replace(/^./,x=>x.toUpperCase());
const refs=new Set("spell item condition skill creature class feat race species background action sense language status variantrule classfeature subclassfeature subclass optfeature book table quickref filter reward object vehicle itemproperty itemmastery hazard disease trap".split(" "));
const markers={h:"Hit: ",acttrigger:"Trigger: ",actresponse:"Response: ",actsavefail:"Failure: ",actsavesuccess:"Success: ",actsavefailorsuccess:"Failure or Success: ",actsavesuccessorfail:"Success or Failure: "};
const attacks={mw:"Melee Weapon Attack",rw:"Ranged Weapon Attack",ms:"Melee Spell Attack",rs:"Ranged Spell Attack",m:"Melee Attack",r:"Ranged Attack"};
const abilities={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};
const formatting={b:"strong",bold:"strong",i:"em",italic:"em",u:"u",s:"s",strike:"s",sup:"sup",sub:"sub",code:"code"};
const signed=s=>/^[+-]?\d+$/.test(s)?(Number(s)>=0?"+":"")+Number(s):s;
export function rendererTagText(tag,payload){
    const t=String(tag).toLowerCase(),p=String(payload).split("|"),v=p[0].trim();
    if(own(markers,t))return markers[t];
    if(t==="atk"||t==="atkr")return v.split(",").map(x=>own(attacks,x.trim().toLowerCase())?attacks[x.trim().toLowerCase()]:x).join(" or ")+": ";
    if(t==="actsave")return (own(abilities,v)?abilities[v]:label(v))+" Saving Throw: ";
    if(t==="hit"||t==="d20")return p[1]||signed(v);
    if(t==="dc")return "DC "+v;
    if(t==="recharge")return v?"Recharge "+v+(v==="6"?"":"–6"):"Recharge 6";
    if(t==="chance")return p[1]||v+"%";
    if(t==="dice"||t==="damage")return p[1]||v;
    if(t==="scaledice"||t==="scaledamage")return v+(p[1]?" (levels "+p[1]+(p[2]?"; increment "+p[2]:"")+")":"");
    if(t==="quickref")return p[4]||v;
    if(t==="classfeature")return p[5]||v;
    if(t==="subclassfeature")return p[7]||v;
    if(t==="filter"||t==="book")return v;
    if(refs.has(t))return p[2]||v;
    if(own(formatting,t))return payload;
    return payload||"{@"+tag+"}";
}
// Balanced tags preserve nested formatting; malformed input remains literal.
function scan(text,plain,tag){
    let pos=0;
    while(pos<text.length){
        const start=text.indexOf("{@",pos);
        if(start<0){plain(text.slice(pos));return;}
        if(start>pos)plain(text.slice(pos,start));
        let d=1,end=start+2;
        for(;end<text.length&&d;end++){if(text[end]==="{")d++;else if(text[end]==="}")d--;}
        if(d){plain(text.slice(start));return;}
        const token=text.slice(start,end),m=/^\{@([a-z][\w]*)\s*([\s\S]*?)\}$/i.exec(token);
        if(m)tag(m[1].toLowerCase(),m[2],token);else plain(token);
        pos=end;
    }
}
export function stripSourceTags(value,depth=0){
    const text=String(value??"");if(depth>24)return text;
    let out="";scan(text,s=>out+=s,(t,p,token)=>{const display=rendererTagText(t,p);out+=display===token?token:stripSourceTags(display,depth+1);});return out;
}
function safeUrl(value){
    if(typeof value!=="string"||/[\u0000-\u0020\u007f]/.test(value))return null;
    try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
/** Only explicit native identity, with an exact bound context, can form an internal link. */
export function renderStructuredReference(id,input,text=id){
    const fallback=el("span",text);
    if(!input?.references||!input?.context||!input?.hrefForRule)return fallback;
    try{
        nativeRuleIdentity(id);
        const c=input.context;
        if(["rulesetId","fingerprint","campaignId","campaignRevisionId"].some(k=>(c[k]??null)!==(input.references.context?.[k]??null)))return fallback;
        const href=input.hrefForRule(id),path=ruleRoute(c.rulesetId,id);
        if(typeof href!=="string"||!href.startsWith("/")||href.startsWith("//")||/[\\\s?#]/.test(href)||!href.endsWith(path))return fallback;
        const a=el("a",text);a.setAttribute("href",href);return a;
    }catch{return fallback;}
}
export function renderInlineContent(value,options={},depth=0){
    const root=el("span",undefined,options.inlineClass),text=String(value??"");
    if(depth>24){root.textContent=text;return root;}
    scan(text,s=>root.append(document.createTextNode(s)),(t,p,token)=>{
        if(own(formatting,t)){root.append(add(el(formatting[t]),renderInlineContent(p,options,depth+1)));return;}
        const display=rendererTagText(t,p);
        if(["dice","damage","hit","d20"].includes(t)&&typeof options.renderDice==="function"){
            const n=options.renderDice({tag:t,expression:p.split("|")[0].trim(),display});if(n){root.append(n);return;}
        }
        const id=options.referenceIds instanceof Map?options.referenceIds.get(token):null;
        if(id&&refs.has(t))root.append(renderStructuredReference(id,options.input,stripSourceTags(display)));
        else root.append(document.createTextNode(stripSourceTags(display)));
    });
    return root;
}

// Source tags are display labels, not IDs. A caller may request a conservative
// exact mapping of tags to Core's explicit references; no name-based catalog
// search, slug construction, foreign read or speculative link is permitted.
const referenceKinds = {
    spell:["spell"], item:["item","baseitem"], condition:["condition"], creature:["monster"],
    class:["class"], feat:["feat"], race:["race","species"], species:["species"], background:["background"],
    skill:["skill"], action:["action"], language:["language"], sense:["sense"], status:["status","condition"],
    variantrule:["rule","variantrule"], hazard:["hazard"], disease:["disease"], trap:["trap"],
    itemproperty:["item-property"], itemmastery:["item-mastery"], table:["table"]
};
const edition = value => {
    const key=String(value??"").toLowerCase().replace(/[^a-z0-9]/g,"");
    return key==="srd51"?"srd51":key==="srd52"||key==="srd521"?"srd52":null;
};
const normalizeName=value=>String(value??"").trim().replace(/\s+/g," ").toLowerCase();
/** Optional asynchronous preparation. Return an empty map on a stale lease;
 * adapters must still honor their own lease before mounting rendered nodes. */
export async function resolveSourceReferenceIds(input,value=input?.record){
    const result=new Map(), context=input?.context, reader=input?.references, lease=input?.lifecycle;
    if(!context||!reader||typeof reader.resolve!=="function"||
       ["rulesetId","fingerprint","campaignId","campaignRevisionId"].some(k=>(context[k]??null)!==(reader.context?.[k]??null)))return result;
    const current=()=>!lease||lease.isCurrent();
    if(!current())return result;
    const release=edition(input.source?.release);
    const ids=new Set([...(Array.isArray(input.record?.catalogReferences)?input.record.catalogReferences:[]),
        ...(Array.isArray(input.record?.definition?.catalogReferences)?input.record.definition.catalogReferences:[])]);
    const tokens=new Map();
    function walk(v,d=0){
        if(d>80||v==null)return;
        if(typeof v==="string")scan(v,()=>{},(tag,payload,token)=>{
            if(own(formatting,tag)){walk(payload,d+1);return;}
            if(!own(referenceKinds,tag))return;
            const [name,source]=payload.split("|");
            const requested=source?edition(source):release;
            // An explicit unknown release is not treated as an unspecified one.
            if((source&&!requested)||!requested||requested!==release)return;
            tokens.set(token,{name:normalizeName(name),requested,kinds:referenceKinds[tag]});
        });
        else if(Array.isArray(v))for(const x of v)walk(x,d+1);
        else if(typeof v==="object") {
            if(typeof v.rulesetId==="string"&&v.rulesetId!==context.rulesetId)return;
            for(const [key,x] of Object.entries(v))if(!technical.has(key)&&!key.startsWith("_"))walk(x,d+1);
        }
    }
    walk(value);
    if(!tokens.size||!ids.size)return result;
    const candidates=[];
    // Bound work per view. Excessive reference lists remain readable without
    // links instead of issuing hundreds of private transport requests.
    const relevant=[...ids].filter(id=>typeof id==="string"&&[...tokens.values()].some(t=>t.kinds.includes(id.split(".")[0])));
    if(relevant.length>64)return result;
    for(const id of relevant){
        if(!current())return new Map();
        try{
            nativeRuleIdentity(id);
            const response=await reader.resolve(id);
            if(!current())return new Map();
            if(response.rulesetId!==context.rulesetId||response.fingerprint!==context.fingerprint||response.rule?.id!==id)continue;
            const rule=response.rule,record=rule.definition;
            candidates.push({id,kind:rule.kind,name:normalizeName(rule.name),release:edition(record?.source?.release??record?.definition?.source?.release)});
        }catch{ /* Unresolved or denied references stay text. */ }
    }
    for(const [token,t] of tokens){
        const matches=candidates.filter(c=>t.kinds.includes(c.kind)&&t.name===c.name&&t.requested===c.release);
        if(matches.length===1)result.set(token,matches[0].id);
    }
    return current()?result:new Map();
}

const bodyKeys=["headerEntries","entries","entry","items","attackEntries","hitEntries","footerEntries"];
const technical=new Set("source sourcePackage officialTextLayout structuredSource structuredStatus colStyles style id kind type page srd basicRules hasToken hasFluff hasFluffImages tokenUrl otherSources additionalSources".split(" "));
function pairs(entries,o,d){
    const n=el("dl",undefined,"rules-core-inline-details");
    for(const [k,v] of entries)n.append(el("dt",label(k)),add(el("dd"),renderStructuredContent(v,o,d+1)));
    return n;
}
function extras(root,v,used,o,d){
    const entries=Object.entries(v).filter(([k])=>!used.has(k));
    const regular=entries.filter(([k])=>!technical.has(k)&&!k.startsWith("_"));
    const tech=entries.filter(([k])=>technical.has(k)||k.startsWith("_"));
    if(regular.length)root.append(pairs(regular,o,d));
    if(tech.length)root.append(add(el("details",undefined,"rules-core-secondary-details"),el("summary","Source and technical fields"),pairs(tech,o,d)));
    return root;
}
const heading=d=>"h"+Math.min(6,Math.max(3,d+3));
// A foreign-scoped subtree is readable, but can not borrow local reference
// authority or token mappings, including through nested entries or table rows.
function scopedOptions(value,o){
    return typeof value?.rulesetId==="string"&&value.rulesetId!==o.input?.context?.rulesetId
        ? {...o,input:null,referenceIds:null}:o;
}
function table(v,o,d){
    const root=el("div",undefined,"table-responsive rules-core-inline-table"),t=el("table",undefined,"table table-sm mb-0");
    if(v.caption!=null||v.name!=null)t.append(add(el("caption"),renderInlineContent(v.caption??v.name,o)));
    if(Array.isArray(v.colLabels)){const tr=el("tr");for(const x of v.colLabels){const th=add(el("th"),renderStructuredContent(x,o,d+1));th.scope="col";tr.append(th);}t.append(add(el("thead"),tr));}
    const body=el("tbody");
    for(const row of v.rows){
        const tr=el("tr"),cells=Array.isArray(row)?row:Array.isArray(row?.row)?row.row:[row];
        const rowOptions=scopedOptions(row,o);
        for(const x of cells)tr.append(add(el("td"),renderStructuredContent(x,rowOptions,d+1)));
        if(Array.isArray(row?.row)){const remaining=Object.entries(row).filter(([k])=>!["row","type","style"].includes(k));if(remaining.length)tr.append(add(el("td"),pairs(remaining,rowOptions,d+1)));}
        body.append(tr);
    }
    t.append(body);root.append(t);
    return extras(root,v,new Set(["name","caption","colLabels","rows","type"]),o,d);
}
/** Detached DOM, composable by every native adapter and legacy caller. */
export function renderStructuredContent(v,o={},d=0){
    if(d>80)return el("span","[Content nesting limit reached]");
    if(v==null)return el("span","None");
    if(typeof v!=="object")return renderInlineContent(v,o);
    if(Array.isArray(v)){
        const root=el(o.sequence==="list"?"ul":"div",undefined,"rules-core-rule-content");
        for(const x of v)root.append(add(el(o.sequence==="list"?"li":typeof x==="string"?"p":"div"),renderStructuredContent(x,o,d+1)));
        return root;
    }
    o=scopedOptions(v,o);
    if(Array.isArray(v.rows)&&(v.type==="table"||v.kind==="table"||Array.isArray(v.colLabels)))return table(v,o,d);
    if(v.type==="list"&&Array.isArray(v.items)){
        const root=el("div"),ordered=v.ordered===true||["ordered","list-ordered","decimal"].includes(v.style);
        if(v.name)root.append(add(el(heading(d)),renderInlineContent(v.name,o)));
        const list=el(ordered?"ol":"ul",undefined,"rules-core-rule-list");
        for(const x of v.items)list.append(add(el("li"),renderStructuredContent(x,o,d+1)));
        root.append(list);return extras(root,v,new Set(["type","items","name","ordered"]),o,d);
    }
    if(typeof v.ruleId==="string"&&(!v.rulesetId||v.rulesetId===o.input?.context?.rulesetId)){
        const root=add(el("div"),renderStructuredReference(v.ruleId,o.input,v.name??v.label??v.ruleId));
        return extras(root,v,new Set(["ruleId","rulesetId","name","label"]),o,d);
    }
    const root=el("section",undefined,"rules-core-rule-entry"),used=new Set();
    if(typeof v.name==="string"){root.append(add(el(heading(d),undefined,"rules-core-rule-entry-name"),renderInlineContent(v.name,o)));used.add("name");}
    if(["entries","section","inset","insetReadaloud","item","itemSub","itemSpell","options"].includes(v.type))used.add("type");
    if(typeof v.markdown==="string"){root.append(renderMarkdown(v.markdown,o));used.add("markdown");}
    if(Array.isArray(v.catalogReferences)){
        used.add("catalogReferences");const list=el("ul");
        for(const id of v.catalogReferences)list.append(add(el("li"),typeof id==="string"?renderStructuredReference(id,o.input):renderStructuredContent(id,o,d+1)));
        root.append(add(el("details"),el("summary","Catalog references"),list));
    }
    for(const k of bodyKeys)if(own(v,k)){used.add(k);root.append(renderStructuredContent(v[k],o,d+1));}
    return extras(root,v,used,o,d);
}
// Fate's narrow Markdown dialect. No innerHTML or source DOM parsing.
function mdInline(text,o,d=0){
    const root=el("span");if(d>24){root.textContent=text;return root;}
    const pattern=/\\([\\*_[\]().#\x60+-])|<a id="([A-Za-z0-9_-]+)"><\/a>|<dice>(\[[+0-]\])<\/dice>|\[([^\]\n]+)\]\(([^)\n]+)\)|(\*\*|__)(.+?)\6|(\*|_)(.+?)\8|\x60([^\x60]+)\x60/g;
    let pos=0;
    for(const m of text.matchAll(pattern)){
        root.append(document.createTextNode(text.slice(pos,m.index)));
        if(m[1])root.append(document.createTextNode(m[1]));
        else if(m[2]){const a=el("span");a.id="rw-md-"+m[2];root.append(a);}
        else if(m[3])root.append(el("span",m[3],"rules-core-dice-symbol"));
        else if(m[4]){
            const href=/^#[A-Za-z0-9_-]+$/.test(m[5])?"#rw-md-"+m[5].slice(1):safeUrl(m[5]);
            if(href){const a=add(el("a"),mdInline(m[4],o,d+1));a.setAttribute("href",href);a.rel="noopener noreferrer";root.append(a);}
            else root.append(document.createTextNode(m[4]+" ("+m[5]+")"));
        }else if(m[7])root.append(add(el("strong"),mdInline(m[7],o,d+1)));
        else if(m[9])root.append(add(el("em"),mdInline(m[9],o,d+1)));
        else root.append(el("code",m[10]));
        pos=m.index+m[0].length;
    }
    root.append(document.createTextNode(text.slice(pos)));return root;
}
function mdTable(rows,o,header=true){
    const t=el("table",undefined,"table table-sm"),body=el("tbody");
    rows.forEach((cells,i)=>{const tr=el("tr");for(const x of cells){const c=add(el(header&&i===0?"th":"td"),mdInline(x.trim(),o));if(header&&i===0)c.scope="col";tr.append(c);}if(header&&i===0)t.append(add(el("thead"),tr));else body.append(tr);});
    t.append(body);return add(el("div",undefined,"table-responsive"),t);
}
// Strict attribute-free table grammar used by Fate exports. Unknown HTML stays literal.
function fateTable(text,o){
    const m=/^<table>\s*<tbody>\s*([\s\S]*?)\s*<\/tbody>\s*<\/table>$/i.exec(text.trim());if(!m)return null;
    const rows=[];let rest=m[1];
    while(rest.trim()){
        const row=/^\s*<tr>\s*([\s\S]*?)\s*<\/tr>/i.exec(rest);if(!row)return null;
        let cells=row[1],values=[];
        while(cells.trim()){const cell=/^\s*<td>\s*([\s\S]*?)\s*<\/td>/i.exec(cells);if(!cell)return null;values.push(cell[1]);cells=cells.slice(cell[0].length);}
        rows.push(values);rest=rest.slice(row[0].length);
    }
    return mdTable(rows,o,false);
}
export function renderMarkdown(value,o={}){
    const root=el("div",undefined,"rules-core-markdown"),lines=String(value??"").replace(/\r\n?/g,"\n").split("\n");
    const listMatch=s=>/^(\s*)([-+*]|\d+[.)])\s+(.+)$/.exec(s);
    const pipe=s=>s.trim().replace(/^\||\|$/g,"").split("|");
    const sep=s=>/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(s??"");
    const boundary=(s,next)=>!s.trim()||/^#{1,6}\s|^\s*<table>\s*$|^\s*>\s/.test(s)||listMatch(s)||(s.includes("|")&&sep(next));
    for(let i=0;i<lines.length;){
        const line=lines[i];if(!line.trim()){i++;continue;}
        const h=/^(#{1,6})\s+(.+)$/.exec(line);
        if(h){root.append(add(el("h"+Math.min(6,Math.max(1,h[1].length+(o.headingOffset??2)))),mdInline(h[2],o)));i++;continue;}
        if(/^\s*<table>\s*$/.test(line)){
            let end=i+1;while(end<lines.length&&!/^\s*<\/table>\s*$/.test(lines[end]))end++;
            const raw=lines.slice(i,Math.min(end+1,lines.length)).join("\n");root.append(fateTable(raw,o)??el("p",raw));i=end+1;continue;
        }
        if(line.includes("|")&&sep(lines[i+1])){const rows=[pipe(line)];i+=2;while(i<lines.length&&lines[i].includes("|")&&lines[i].trim())rows.push(pipe(lines[i++]));root.append(mdTable(rows,o));continue;}
        if(listMatch(line)){
            const stack=[];
            while(i<lines.length){
                const m=listMatch(lines[i]);if(!m)break;
                const indent=m[1].replace(/\t/g,"    ").length,ordered=/^\d/.test(m[2]);
                while(stack.length&&indent<stack.at(-1).indent)stack.pop();
                let e=stack.at(-1);
                if(!e||indent>e.indent||ordered!==e.ordered){
                    if(e&&indent===e.indent){stack.pop();e=stack.at(-1);}
                    const list=el(ordered?"ol":"ul");if(ordered)list.start=parseInt(m[2],10);
                    (e?.last??root).append(list);e={indent,ordered,list,last:null};stack.push(e);
                }
                e.last=add(el("li"),mdInline(m[3],o));e.list.append(e.last);i++;
            }continue;
        }
        if(/^\s*>\s/.test(line)){const b=el("blockquote");while(i<lines.length&&/^\s*>\s/.test(lines[i]))b.append(add(el("p"),mdInline(lines[i++].replace(/^\s*>\s/,""),o)));root.append(b);continue;}
        const paragraph=[line];i++;while(i<lines.length&&!boundary(lines[i],lines[i+1]))paragraph.push(lines[i++]);root.append(add(el("p"),mdInline(paragraph.join(" "),o)));
    }return root;
}
