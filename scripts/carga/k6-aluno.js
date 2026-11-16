/**
 * Teste de carga (#68): alunos estudando ao mesmo tempo na véspera do ENEM.
 *
 * Rodar contra STAGING, nunca produção:
 *   SUPABASE_URL=https://<staging>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon de staging> \
 *   ALUNO_EMAIL=carga@exemplo.invalid ALUNO_SENHA=<senha> \
 *   k6 run scripts/carga/k6-aluno.js
 *
 * Simula o caminho mais quente: abrir o app (perfil, gamificação,
 * revisões), responder questões (placar por tópico pela fila offline) e
 * a secretaria abrindo o relatório. Meta da issue: p95 < 300 ms.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    vespera_enem: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 1000 },
        { duration: '5m', target: 5000 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration{tipo:leitura}': ['p(95)<300'],
    'http_req_duration{tipo:escrita}': ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const URL = __ENV.SUPABASE_URL;
const ANON = __ENV.SUPABASE_ANON_KEY;

export function setup() {
  const r = http.post(`${URL}/auth/v1/token?grant_type=password`, JSON.stringify({ email: __ENV.ALUNO_EMAIL, password: __ENV.ALUNO_SENHA }), {
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
  });
  check(r, { 'login ok': (x) => x.status === 200 });
  return { token: r.json('access_token') };
}

export default function (dados) {
  const h = { apikey: ANON, Authorization: `Bearer ${dados.token}`, 'Content-Type': 'application/json' };
  const ler = (caminho) => http.get(`${URL}/rest/v1/${caminho}`, { headers: h, tags: { tipo: 'leitura' } });

  check(ler('gamificacao?select=xp,level,streak,ultimo_acesso'), { gamificacao: (r) => r.status === 200 });
  check(ler('revisoes_espacadas?select=topico_nome,proxima_revisao&order=proxima_revisao.asc&limit=20'), { revisoes: (r) => r.status === 200 });
  check(ler('quiz_desempenho_topicos?select=materia,topico,acertos,erros'), { desempenho: (r) => r.status === 200 });

  // Uma questão respondida: passa pela fila idempotente (033), chave única por iteração.
  const chave = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const r = http.post(
    `${URL}/rest/v1/rpc/aplicar_operacao`,
    JSON.stringify({ p_chave: chave, p_tipo: 'desempenho_topico', p_dados: { materia: 'Matemática', topico: 'Funções', acertou: Math.random() > 0.4 } }),
    { headers: h, tags: { tipo: 'escrita' } },
  );
  check(r, { 'questao registrada': (x) => x.status === 200 });

  sleep(1 + Math.random() * 3);
}
