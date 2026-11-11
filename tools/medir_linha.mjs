import { chromium } from 'playwright';
const SUPA='https://bxidxlcismcvryznpomh.supabase.co';
const SVC= process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL='linha@exemplo-descartavel.com', SENHA='Linha!2026abc';
const api=(m,p,b,t)=>fetch(SUPA+p,{method:m,headers:{apikey:SVC,Authorization:'Bearer '+(t||SVC),'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,t:await r.text()}));
let uid=null;
const nav=await chromium.launch({args:['--use-gl=swiftshader']});
try{
  const r=await api('POST','/auth/v1/admin/users',{email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{nome:'Linha'}});
  uid=r.s<300?JSON.parse(r.t).id:null;
  const ctx=await nav.newContext({viewport:{width:375,height:812},locale:'pt-BR'});
  const page=await ctx.newPage();
  await page.goto('http://localhost:4184',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Aluno/}).first().click();
  await page.locator('#campo-email').fill(EMAIL);
  await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button',{name:/^Entrar$/}).click();
  await page.waitForSelector('[data-tab="dashboard"]:visible',{timeout:30000});
  await page.waitForTimeout(2500);
  let a=page.locator('[data-tab="ranking"]:visible').first();
  if(!(await a.isVisible().catch(()=>false))){await page.getByRole('button',{name:/^Mais$/}).first().click();await page.waitForTimeout(700);a=page.locator('[data-tab="ranking"]:visible').first();}
  await a.click(); await page.waitForTimeout(2200);
  const info=await page.evaluate(()=>{
    const ls=[...document.querySelectorAll('.linha-ranking')];
    const alturas=ls.map(e=>e.getBoundingClientRect().height);
    const tops=ls.map(e=>e.getBoundingClientRect().top);
    const passos=tops.slice(1).map((t,i)=>Math.round(t-tops[i]));
    const nos=ls[0]?ls[0].querySelectorAll('*').length+1:0;
    return {qtd:ls.length,alturaMin:Math.min(...alturas),alturaMax:Math.max(...alturas),
      passoMaisComum:passos.sort((x,y)=>passos.filter(v=>v===y).length-passos.filter(v=>v===x).length)[0],
      nosPorLinha:nos,nosTotais:document.querySelectorAll('*').length};
  });
  console.log('\n=== geometria das linhas do ranking ===');
  console.log(`  linhas                : ${info.qtd}`);
  console.log(`  altura min/max        : ${info.alturaMin} / ${info.alturaMax} px`);
  console.log(`  passo entre linhas    : ${info.passoMaisComum} px  (altura + espacamento)`);
  console.log(`  nos de DOM por linha  : ${info.nosPorLinha}`);
  console.log(`  nos de DOM na pagina  : ${info.nosTotais}  (linhas = ${info.qtd*info.nosPorLinha})`);
  await ctx.close();
} finally { await nav.close(); if(uid) await api('DELETE',`/auth/v1/admin/users/${uid}`); }
