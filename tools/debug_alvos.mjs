import { chromium } from 'playwright';
const SUPA='https://bxidxlcismcvryznpomh.supabase.co';
const SVC= process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL='alvo@exemplo-descartavel.com', SENHA='Alvo!2026abc';
const api=(m,p,b)=>fetch(SUPA+p,{method:m,headers:{apikey:SVC,Authorization:'Bearer '+SVC,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,t:await r.text()}));
let uid=null; const nav=await chromium.launch();
try{
  const r=await api('POST','/auth/v1/admin/users',{email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{nome:'Alvo'}});
  uid=r.s<300?JSON.parse(r.t).id:null;
  const ctx=await nav.newContext({viewport:{width:375,height:812}}); const page=await ctx.newPage();
  await page.goto(process.argv[2],{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Aluno/}).first().click();
  await page.locator('#campo-email').fill(EMAIL); await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button',{name:/^Entrar$/}).click();
  await page.waitForSelector('[data-tab="dashboard"]:visible',{timeout:30000});
  for (const t of ['dashboard','quiz']) {
    await page.locator(`[data-tab="${t}"]:visible`).first().click(); await page.waitForTimeout(1200);
    const r = await page.evaluate(() => [...document.querySelectorAll('button,a[href],input,select,[role="button"]')]
      .map(el=>{const b=el.getBoundingClientRect();return{w:Math.round(b.width),h:Math.round(b.height),
        tag:el.tagName,tipo:el.getAttribute('type')||'',cls:(el.className?.toString?.()||'').slice(0,70),
        txt:(el.textContent||'').trim().slice(0,26)};})
      .filter(x=>x.w>0&&x.h>0&&(x.w<44||x.h<44)));
    console.log(`--- ${t}`); console.log(JSON.stringify(r,null,1));
  }
} finally { await nav.close(); if(uid) await api('DELETE','/auth/v1/admin/users/'+uid); }
