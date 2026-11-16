/**
 * Supabase e IA simulados para os testes E2E.
 *
 * `prepararConta(page, opcoes)` intercepta tudo que iria para o Supabase e
 * responde como um banco com UMA conta. Devolve `chamadas`, a lista do que
 * o app pediu ao banco, para o teste conferir o que foi gravado.
 */
export const UID = '11111111-1111-4111-8111-111111111111';
const SUPABASE = 'https://e2e-simulado.supabase.co';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export async function prepararConta(page, { papel = 'student', onboarding = true, nascimento = '2008-01-01' } = {}) {
  const agora = Math.floor(Date.now() / 1000);
  const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: UID, role: 'authenticated', exp: agora + 3600 })}.e2e`;
  const usuario = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'ana@exemplo.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const perfil = {
    id: UID, email: 'ana@exemplo.invalid', nome: 'Ana', papel, escola_id: null, turma_id: null,
    deve_trocar_senha: false, onboarding_completed: onboarding, metas_estudo: [], tempo_diario_estudo: null,
    turno_estudo: null, data_nascimento: nascimento,
  };
  const chamadas = [];

  await page.context().route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    let corpo = null;
    try { corpo = req.postDataJSON(); } catch { corpo = null; }
    chamadas.push({ metodo: req.method(), caminho: u.pathname, corpo });

    if (u.pathname.startsWith('/auth/v1/token')) return json({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: agora + 3600, refresh_token: 'r', user: usuario });
    if (u.pathname.startsWith('/auth/v1/user')) return json(usuario);
    const umSo = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (u.pathname === '/rest/v1/perfis') {
      if (req.method() === 'PATCH' && corpo) Object.assign(perfil, corpo);
      return json(umSo ? perfil : [perfil]);
    }
    if (u.pathname === '/rest/v1/preferencias' && req.method() === 'GET') return json(umSo ? { tutorial_completo: true } : [{ tutorial_completo: true }]);
    if (u.pathname === '/rest/v1/rpc/aplicar_operacao') {
      return json(corpo?.p_tipo === 'xp' ? { gamificacao: { xp: Number(corpo.p_dados?.xp) || 0, level: 1, streak: 1, ultimo_acesso: '2026-11-16' } } : { ok: true });
    }
    if (u.pathname === '/rest/v1/rpc/minhas_turmas') return json([{ id: 't1', nome: '3º A' }]);
    if (u.pathname === '/rest/v1/rpc/resumo_turma') return json([{ turma_nome: '3º A', total_alunos: 30, alunos_ativos: 20, respostas: 400, taxa_acerto: 62 }]);
    if (u.pathname === '/rest/v1/rpc/relatorio_turma') return json([{ materia: 'Matemática', topico: 'Funções', alunos_medidos: 12, alunos_com_dificuldade: 7, respostas: 120, taxa_acerto: 44 }]);
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(null);
    if (req.method() === 'GET') return umSo ? json({ code: 'PGRST116', message: 'sem linhas' }, 406) : json([]);
    return json([]);
  });

  // IA simulada: quiz com duas questões e uma resposta do Mentor.
  await page.route('**/api/generate', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify([
          { tema: 'Funções', enunciado: 'Quanto vale f(2) se f(x) = 3x + 1?', alternativas: ['7', '6', '5', '9'], correta: 0, explicacao: 'f(2) = 3 · 2 + 1 = 7.', dica: 'Troque x por 2.', fonte: 'ENEM', dificuldade: 'facil' },
          { tema: 'Funções', enunciado: 'Qual é o coeficiente angular de y = 2x + 5?', alternativas: ['2', '5', '7', '1'], correta: 0, explicacao: 'O número que multiplica x.', dica: 'Olhe o x.', fonte: 'ENEM', dificuldade: 'facil' },
        ]) }] } }],
      }),
    }),
  );
  await page.route('**/api/chat/completions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ texto: 'Mitose gera duas células iguais à original.', frustrationDetected: false, modo: 'geral', modelo: 'e2e', fontes: [], consultas: [], groundingUsado: false, citouProva: false }) }),
  );

  return { chamadas, perfil };
}

export async function entrar(page, caminho = '/') {
  await page.goto(caminho);
  await page.locator('#campo-email').fill('ana@exemplo.invalid');
  await page.locator('#campo-senha').fill('senha-e2e');
  await page.locator('button[type="submit"]').click();
}

/** Abre uma aba do aluno, no computador (sidebar) ou no celular (folha "Mais"). */
export async function abrirAba(page, id) {
  // Espera o painel montar: logo depois do login ainda não há aba nenhuma.
  await page.locator('[data-tab]:visible').first().waitFor();
  const visivel = page.locator(`[data-tab="${id}"]:visible`).first();
  if (await visivel.count()) return visivel.click();
  await page.getByRole('button', { name: /^Mais/ }).click();
  await page.locator(`[data-tab="${id}"]:visible`).first().click();
}

export async function fecharAvisos(page) {
  await page.keyboard.press('Escape');
  const pular = page.getByRole('button', { name: /pular tour/i });
  if (await pular.count()) await pular.first().click().catch(() => {});
}
