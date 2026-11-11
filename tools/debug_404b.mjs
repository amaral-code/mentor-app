import { chromium } from 'playwright';
const SUPA='https://bxidxlcismcvryznpomh.supabase.co';
const SVC= process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL='e404@exemplo-descartavel.com', SENHA='E404!2026abc';
const api=(m,p,b)=>fetch(SUPA+p,{method:m,headers:{apikey:SVC,Authorization:'Bearer '+SVC,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,t:await r.text()}));
let uid=null; const nav=await chromium.launch();
try{
  const r=await api('POST','/auth/v1/admin/users',{email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{nome:'E404'}});
  uid=r.s<300?JSON.parse(r.t).id:null;
  const ctx=await nav.newContext({viewport:{width:375,height:812}}); const page=await ctx.newPage();
  page.on('response', r=>{ if(r.status()>=400) console.log(`${r.status()}  ${r.url().slice(0,140)}`); });
  await page.goto(process.argv[2],{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Aluno/}).first().click();
  await page.locator('#campo-email').fill(EMAIL); await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button',{name:/^Entrar$/}).click();
  await page.waitForSelector('[data-tab="dashboard"]:visible',{timeout:30000});
  for (const t of ['chat','quiz','foco','ranking','store','notebook','profile','comunidade','essay']) {
    let el = page.locator(`[data-tab="${t}"]:visible`).first();
    if (!(await el.isVisible().catch(()=>false))) {
      const mais = page.getByRole('button',{name:/^Mais$/}).first();
      if (await mais.isVisible().catch(()=>false)) { await mais.click(); await page.waitForTimeout(600); }
      el = page.locator(`[data-tab="${t}"]:visible`).first();
    }
    if (await el.isVisible().catch(()=>false)) { await el.click({timeout:6000}).catch(()=>{}); await page.waitForTimeout(1300); }
  }
} finally { await nav.close(); if(uid) await api('DELETE','/auth/v1/admin/users/'+uid); }
