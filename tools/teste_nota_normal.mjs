/**
 * Caminho feliz do caderno: criar anotacao com a rede normal.
 *
 * O teste de falha acusou que, no caso de CONTROLE, a anotacao nao ficou
 * na tela. Ou o teste estava mal encadeado (a pagina vinha de uma falha
 * anterior) ou eu introduzi uma regressao ao fazer as escritas propagarem
 * erro. Este script isola: sessao limpa, rede normal, uma anotacao.
 */
import { chromium } from 'playwright';
const SUPA='https://bxidxlcismcvryznpomh.supabase.co';
const SVC= process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL='ok@exemplo-descartavel.com', SENHA='Ok!2026abcdef';
const api=(m,p,b,t)=>fetch(SUPA+p,{method:m,headers:{apikey:SVC,Authorization:'Bearer '+(t||SVC),'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,t:await r.text()}));
let uid=null;
const nav=await chromium.launch({args:['--use-gl=swiftshader']});
try{
  const r=await api('POST','/auth/v1/admin/users',{email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{nome:'Ok'}});
  uid=r.s<300?JSON.parse(r.t).id:null;
  const ctx=await nav.newContext({viewport:{width:1280,height:900},locale:'pt-BR'});
  const page=await ctx.newPage();
  const erros=[];
  page.on('console', m => { if (m.type()==='error') erros.push(m.text().slice(0,120)); });
  await page.goto('http://localhost:4184',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Aluno/}).first().click();
  await page.locator('#campo-email').fill(EMAIL);
  await page.locator('#campo-senha').fill(SENHA);
  await page.getByRole('button',{name:/^Entrar$/}).click();
  await page.waitForSelector('[data-tab="dashboard"]:visible',{timeout:30000});
  await page.waitForTimeout(2500);
  await page.locator('[data-tab="notebook"]:visible').first().click();
  await page.waitForTimeout(1500);

  const TEXTO='Resumo de funcao do segundo grau';
  await page.locator('textarea').first().fill(TEXTO);
  await page.getByRole('button',{name:/Adicionar/}).click();
  await page.waitForTimeout(2500);

  const naTela=await page.locator(`text=${TEXTO}`).count();
  const toast=await page.evaluate(()=>{const e=document.querySelector('[role="status"],[role="alert"]');return e?e.textContent.trim():null;});
  console.log(`\n  anotacao na tela apos criar : ${naTela>0?'SIM':'NAO'}`);
  console.log(`  aviso de erro               : ${toast?'"'+toast+'"':'nenhum (correto)'}`);

  // A prova real: recarregar e ver se veio do banco.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  await page.locator('[data-tab="notebook"]:visible').first().click();
  await page.waitForTimeout(2000);
  const apos=await page.locator(`text=${TEXTO}`).count();
  console.log(`  anotacao apos recarregar    : ${apos>0?'SIM (gravou de verdade)':'NAO'}`);

  // Confere direto no banco, sem passar pela interface.
  const noBanco=await api('GET',`/rest/v1/notas?user_id=eq.${uid}&select=texto`);
  console.log(`  no banco                    : ${noBanco.t.includes('segundo grau')?'SIM':'NAO'}`);
  if(erros.length) console.log(`  erros de console            : ${erros.slice(0,3).join(' | ')}`);
  await ctx.close();
} finally { await nav.close(); if(uid) await api('DELETE',`/auth/v1/admin/users/${uid}`); }
