import { chromium } from 'playwright';
const SUPA='https://bxidxlcismcvryznpomh.supabase.co';
const SVC= process.env.SUPABASE_SERVICE_KEY ?? '';
const EMAIL='mat@exemplo-descartavel.com', SENHA='Mat!2026abcd';
const api=(m,p,b,tok)=>fetch(SUPA+p,{method:m,headers:{apikey:SVC,Authorization:'Bearer '+(tok||SVC),'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,t:await r.text()}));
let uid=null; const nav=await chromium.launch();
try{
  const r=await api('POST','/auth/v1/admin/users',{email:EMAIL,password:SENHA,email_confirm:true,user_metadata:{nome:'Mat'}});
  uid=r.s<300?JSON.parse(r.t).id:null;
  const ctx=await nav.newContext({viewport:{width:1280,height:900}}); const page=await ctx.newPage();
  const entrar=async()=>{
    await page.goto(process.argv[2],{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1200);
    // Na segunda passada a sessao ja existe e o app abre direto.
    const temLogin = await page.getByRole('button',{name:/Aluno/}).first().isVisible().catch(()=>false);
    if (temLogin) {
      await page.getByRole('button',{name:/Aluno/}).first().click();
      await page.locator('#campo-email').fill(EMAIL); await page.locator('#campo-senha').fill(SENHA);
      await page.getByRole('button',{name:/^Entrar$/}).click();
    }
    await page.waitForSelector('[data-tab="chat"]:visible',{timeout:30000});
    await page.locator('[data-tab="chat"]:visible').first().click();
    await page.waitForTimeout(2000);
  };
  await entrar();
  const semHistorico = await page.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,300));
  console.log('SEM HISTORICO:');
  console.log('  cabecalho tem "retomando"? ', /retomando/.test(semHistorico));
  console.log('  saudacao:', semHistorico.match(/Oi![^]{0,120}/)?.[0] || '(nao achou)');

  // grava um quiz de Historia via API autenticada
  const tk=JSON.parse((await api('POST','/auth/v1/token?grant_type=password',{email:EMAIL,password:SENHA})).t).access_token;
  await api('POST','/rest/v1/quiz_resultados',{user_id:uid,materia:'História',acertos:4,total:5,xp_ganho:40},tk);
  await entrar();
  const comHistorico = await page.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,300));
  console.log('\nAPOS UM QUIZ DE HISTORIA:');
  console.log('  cabecalho:', comHistorico.match(/retomando: [^·]{0,30}/)?.[0] || '(sem retomando)');
} finally { await nav.close(); if(uid) await api('DELETE','/auth/v1/admin/users/'+uid); }
