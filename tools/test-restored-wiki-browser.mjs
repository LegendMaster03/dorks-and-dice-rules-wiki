import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<main id="tool-root" data-tool-context-url="/context"></main>', {
    url: 'https://site.test/tools/rules-wiki', pretendToBeVisual: true
});
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'Node', 'Event', 'KeyboardEvent']) globalThis[key] = dom.window[key];
window.dorksAndDiceToolHost = { setContentLayout(value) { assert.equal(value, 'full-bleed'); } };
const fingerprint = '870ca5e89a97b9176f0a3b55fb6cb9467227d13562a83dd7d72ecee5a57ecda6';
const records = [
    {id:'condition.blinded',name:'Blinded',kind:'condition'},
    {id:'condition.exhaustion',name:'Exhaustion',kind:'leveled-condition'},
    {id:'rules.conditions',name:'Conditions chapter',kind:'ruleChapter'},
    ...Array.from({length:100}, (_, i) => ({id:`rule.${i}`,name:`Rule ${i}`,kind:'rule'}))
];
const calls=[];
globalThis.fetch = async (url, options={}) => {
    calls.push({url,options});
    let body;
    if (url === '/context') body={apiBaseUrl:'/host/api',toolBasePath:'/tools/rules-wiki',toolRoute:'/',siteMode:'dorks-and-dice'};
    else if (url === '/host/api/session') body={user:{displayName:'Tester'},globalRoles:['Owner']};
    else {
        const op=String(url).split('/').at(-1);
        const args=JSON.parse(options.body).arguments;
        if (op==='getNativeRulesets') body={rulesets:[{id:'first-party-001',entityCount:records.length,fingerprint}]};
        else if (op==='searchNativeRules') {
            assert.equal(args[0],'first-party-001');
            const filters=args[1]; assert.ok(filters.limit<=100);
            const found=records.filter(x=>!filters.q || x.name.toLowerCase().includes(filters.q.toLowerCase()));
            body={rulesetId:args[0],fingerprint,total:found.length,rules:found.slice(filters.offset,filters.offset+filters.limit)};
        } else if (op==='getNativeRule') {
            const rule=records.find(x=>x.id===args[1]); assert.ok(rule);
            body={rulesetId:args[0],fingerprint,rule:{...rule,definition:{description:'Cannot see <img src=x onerror=alert(1)>',effects:[{type:'sense',availability:'none'}]}}};
        } else throw new Error(`Unexpected network operation: ${op}`);
    }
    return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
};
await import('../src/RulesWiki.Web/wwwroot/app.js');
const root=document.getElementById('tool-root');
const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}assert.fail('UI did not reach expected state: '+root.textContent.slice(0,500));};
assert.ok(root.querySelector('.rules-core-library-shell'));
assert.ok(root.querySelector('.rules-core-library-index'));
assert.ok(root.querySelector('.rules-core-library-detail'));
assert.ok(root.querySelector('.rules-core-nav-shell'));
assert.ok([...document.querySelectorAll('link')].some(x=>x.href.endsWith('/rules-wiki-shell.css')));
assert.match(root.textContent,/Native rules/);
assert.ok(calls.some(x=>JSON.parse(x.options.body||'{}').arguments?.[1]?.offset===100),'fetches all native pages');
await wait(()=>root.querySelector('.rules-core-library-detail-body'));
assert.ok(root.textContent.includes('condition.blinded'));
assert.equal(root.querySelector('img'),null,'native description is text, not HTML');
const source=[...root.querySelectorAll('button')].find(x=>x.textContent==='Source Library');
assert.ok(source.disabled,'unsupported workspace is explicit and disabled');
const conditions=[...root.querySelectorAll('button')].find(x=>x.textContent==='Conditions');
assert.ok(conditions); conditions.click();
await wait(()=>root.querySelectorAll('.rules-core-library-row').length===2);
assert.match(root.textContent,/Exhaustion/,'leveled conditions remain under Conditions');
const search=root.querySelector('input[type=search]');
search.value='Exhaustion'; search.dispatchEvent(new Event('input',{bubbles:true}));
await wait(()=>root.querySelectorAll('.rules-core-library-row').length===1 && root.textContent.includes('Exhaustion'));
root.querySelector('.rules-core-library-row').click();
await wait(()=>root.textContent.includes('condition.exhaustion'));
assert.ok(window.location.pathname.includes('exhaustion'));
const { parseToolRoute } = await import('../src/RulesWiki.Web/wwwroot/rules-browser-routing.js');
assert.equal(parseToolRoute('/conditions/blinded').conceptKey, 'condition.blinded');
assert.equal(parseToolRoute('/rules/condition.blinded').conceptKey, 'condition.blinded');
assert.equal(parseToolRoute('/rulesets/first-party-001/rules/condition.blinded').conceptKey, 'condition.blinded');
const spells=[...root.querySelectorAll('button')].find(x=>x.textContent==='Spells'); spells.click();
await wait(()=>root.textContent.includes('No native rules match this category or search.'));
assert.ok(!root.textContent.includes('Rules Wiki unavailable'));
assert.ok(calls.every(x=>!String(x.url).includes('core-private')&&!String(x.url).includes('/api/wiki/')));
console.log('Restored shell, native pagination, category grouping, search, selection, empty states and text-only rendering passed.');
dom.window.close();
