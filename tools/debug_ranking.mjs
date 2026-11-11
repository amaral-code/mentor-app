import { chromium } from 'playwright';
const SUPA='https://bxidxlcismcvryznpomh.supabase.co';
const SVC= process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL='rk@exemplo-descartavel.com', SENHA='Rk!2026abcd';
const api=(m,p,b)=>fetch(SUPA+p,{method:m,headers:{apikey:SVC,Authorization:'Bearer '+SVC,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,t:await r.text()}));
let uid=null; const nav=await chromium.launch();
try{
  const r=await api('POST','/auth/v1/admin/users',{email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{nome:'Rk'}});
  uid=r.s<300?JSON.parse(r.t).id:null;
  const ctx=await nav.newContext({viewport:{width:1280,height:900}}); const page=await ctx.newPage();
  await page.goto(process.argv[2],{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Aluno/}).first().click();
  await page.locator('#campo-email').fill(EMAIL); await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button',{name:/^Entrar$/}).click();
  await page.waitForSelector('[data-tab="ranking"]:visible',{timeout:30000});
  await page.locator('[data-tab="ranking"]:visible').first().click();
  await page.waitForTimeout(2500);
  const r2 = await page.evaluate(() => {
    const cont = document.querySelector('.p-3.space-y-1');
    const filhos = cont ? [...cont.children] : [];
    return {
      containerAchado: !!cont,
      qtdFilhos: filhos.length,
      amostra: filhos.slice(0,3).map(el => {
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return { op: s.opacity, transform: s.transform, h: Math.round(b.height), txt: (el.textContent||'').trim().slice(0,40) };
      }),
    };
  });
  console.log(JSON.stringify(r2,null,1));
} finally { await nav.close(); if(uid) await api('DELETE','/auth/v1/admin/users/'+uid); }
