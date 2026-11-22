import { createRequire } from 'node:module';
const require = createRequire('/Users/heebiny/diyProj/mini-crimes/client/e2e/x.mjs');
const { chromium } = require('/Users/heebiny/diyProj/voodoo/node_modules/playwright');
import { ALL_CASES } from '/Users/heebiny/diyProj/mini-crimes/client/src/data/cases.js';
const BASE='http://localhost:5173'; const c=ALL_CASES[0];
const b=await chromium.launch();
async function mk(n){const ctx=await b.newContext();await ctx.addInitScript(([n])=>{localStorage.setItem('mc:profiles',JSON.stringify([{id:'p1',name:n,createdAt:'2026'}]));localStorage.setItem('mc:currentProfile','p1');},[n]);return ctx.newPage();}
const H=await mk('방장'); await H.goto(BASE+'/'); await H.locator('.case-id').first().waitFor();
await H.getByText(c.title,{exact:true}).first().locator('xpath=ancestor::div[.//button[normalize-space()="팀 수사"]][1]').getByText('팀 수사',{exact:true}).click();
await H.locator('.modal-overlay button.btn-primary').last().click(); await H.waitForURL(/\/lobby\//);
const code=H.url().split('/lobby/')[1]; console.log('code',code);
const variants={ '소문자':code.toLowerCase(), '앞뒤공백(fill)':`  ${code}  `, '앞공백1칸':` ${code}`, '뒤공백1칸':`${code} ` };
for (const [k,v] of Object.entries(variants)) {
  const G=await mk('게스트'+k.length); await G.goto(BASE+'/'); await G.locator('.case-id').first().waitFor();
  const inp=G.getByPlaceholder('방 코드'); await inp.fill(v);
  const val=await inp.inputValue();
  await G.getByText('→ 참가').click();
  const ok=await G.waitForURL(/\/lobby\//,{timeout:12000}).then(()=>true).catch(()=>false);
  const msg=ok?'':(await G.locator('body').innerText()).replace(/\s+/g,' ').match(/(방을 찾을|꽉|이미|같은 이름|코드|연결)[^]{0,40}/)?.[0];
  console.log(JSON.stringify({variant:k,sent:v,inputValueAfterFill:val,joined:ok,msg}));
  await G.context().close();
}
await b.close();
