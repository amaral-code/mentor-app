import { chromium } from 'playwright';
const SUPA='https://bxidxlcismcvryznpomh.supabase.co';
const SVC= process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL='ovf@exemplo-descartavel.com', SENHA='Ovf!2026abc';
const api=(m,p,b)=>fetch(SUPA+p,{method:m,headers:{apikey:SVC,Authorization:'Bearer '+SVC,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,t:await r.text()}));
let uid=null; const nav=await chromium.launch();
try{
  const r=await api('POST','/auth/v1/admin/users',{email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{nome:'Ovf'}});
  uid=r.s<300?JSON.parse(r.t).id:null;
  const ctx=await nav.newContext({viewport:{width:375,height:812}}); const page=await ctx.newPage();
  await page.goto(process.argv[2]||'http://localhost:5178',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Aluno/}).first().click();
  await page.locator('#campo-email').fill(EMAIL); await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button',{name:/^Entrar$/}).click();
  await page.waitForSelector('[data-tab="chat"]:visible',{timeout:30000});
  await page.locator('[data-tab="chat"]:visible').first().click();
  await page.waitForTimeout(1500);
  const culpados = await page.evaluate(() => {
    const larg = document.documentElement.clientWidth;
    return [...document.querySelectorAll('*')]
      .map(el => { const r = el.getBoundingClientRect();
        return { dir: Math.round(r.right), larg: Math.round(r.width),
                 tag: el.tagName, cls: (el.className?.toString?.()||'').slice(0,90),
                 txt: (el.textContent||'').trim().slice(0,40) }; })
      .filter(x => x.dir > larg + 1)
      .sort((a,b) => b.dir - a.dir).slice(0, 8);
  });
  console.log(JSON.stringify(culpados,null,2));
  await page.screenshot({path:'tools/capturas/debug-overflow-chat.png'});
} finally { await nav.close(); if(uid) await api('DELETE','/auth/v1/admin/users/'+uid); }
