/**
 * Prova deterministica de que a renderizacao progressiva funciona.
 *
 * O fps nesta maquina oscila 3x entre execucoes, entao nao serve para
 * sustentar a conclusao. A contagem de nos de DOM, sim: ela nao depende de
 * escalonamento, carga nem compositor. Se no primeiro quadro a lista tem
 * poucos nos e depois chega a 1127, a divisao em blocos esta funcionando e
 * nenhuma linha foi perdida.
 */
import { chromium } from 'playwright';
const SUPA='https://bxidxlcismcvryznpomh.supabase.co';
const SVC= process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL='prog@exemplo-descartavel.com', SENHA='Prog!2026abc';
const api=(m,p,b,t)=>fetch(SUPA+p,{method:m,headers:{apikey:SVC,Authorization:'Bearer '+(t||SVC),'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,t:await r.text()}));
let uid=null;
const nav=await chromium.launch({args:['--use-gl=swiftshader']});
try{
  const r=await api('POST','/auth/v1/admin/users',{email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{nome:'Prog'}});
  uid=r.s<300?JSON.parse(r.t).id:null;
  const ctx=await nav.newContext({viewport:{width:375,height:812},locale:'pt-BR'});
  const page=await ctx.newPage(); const cdp=await ctx.newCDPSession(page);
  await page.goto('http://localhost:4184',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Aluno/}).first().click();
  await page.locator('#campo-email').fill(EMAIL);
  await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button',{name:/^Entrar$/}).click();
  await page.waitForSelector('[data-tab="dashboard"]:visible',{timeout:30000});
  await page.waitForTimeout(2500);
  const ir=async(t)=>{let a=page.locator(`[data-tab="${t}"]:visible`).first();
    if(!(await a.isVisible().catch(()=>false))){await page.getByRole('button',{name:/^Mais$/}).first().click();await page.waitForTimeout(700);a=page.locator(`[data-tab="${t}"]:visible`).first();}
    await a.click().catch(()=>{});};
  await ir('ranking'); await page.waitForTimeout(1800); await ir('dashboard'); await page.waitForTimeout(1200);

  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  // Instala o observador ANTES da troca, para pegar o primeiro quadro.
  await page.evaluate(()=>{
    window.__amostras=[];
    const t0=performance.now();
    const tick=()=>{
      const linhas=document.querySelectorAll('.linha-ranking');
      let completas=0;
      for(const l of linhas) if(l.querySelectorAll('*').length>1) completas++;
      window.__amostras.push({t:Math.round(performance.now()-t0),reservadas:linhas.length,completas});
      if(performance.now()-t0<3000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await ir('ranking');
  await page.waitForTimeout(3400);
  const am=await page.evaluate(()=>window.__amostras);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});

  const comLinhas=am.filter(a=>a.reservadas>0);
  console.log('\n=== preenchimento da lista, quadro a quadro (throttling 4x) ===');
  console.log('    tempo   espaco reservado   linhas completas');
  const marcos=[];
  let ultimo=-1;
  for(const a of comLinhas){ if(a.completas!==ultimo){marcos.push(a);ultimo=a.completas;} }
  for(const a of marcos.slice(0,14)) console.log(`  ${String(a.t).padStart(5)} ms ${String(a.reservadas).padStart(14)} ${String(a.completas).padStart(18)}`);
  const fim=comLinhas[comLinhas.length-1];
  console.log(`\n  primeiro quadro com a lista : ${comLinhas[0].completas} linhas completas de ${comLinhas[0].reservadas} reservadas`);
  console.log(`  estado final                : ${fim.completas} completas de ${fim.reservadas} reservadas`);
  console.log(`  altura reservada desde o inicio? ${comLinhas[0].reservadas===fim.reservadas?'SIM (rolagem nao pula)':'NAO'}`);
  console.log(`  todas as linhas chegaram?        ${fim.completas===49?'SIM':'NAO ('+fim.completas+')'}`);
  await ctx.close();
} finally { await nav.close(); if(uid) await api('DELETE',`/auth/v1/admin/users/${uid}`); }
