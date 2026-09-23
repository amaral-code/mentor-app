import { useCallback, useEffect, useMemo, useState } from 'react';
import { EyeOff, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useMarketplaceStore } from '../../stores/marketplaceStore';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';
import type { Consentimento } from '../../shared/storage/PsicologiaRepository';
import {
  DIAS_PADRAO,
  DURACOES,
  ESCOPOS,
  diasRestantes,
  mensagemErroConsentimento,
  rotuloEscopo,
  type EscopoConsentimento,
} from '../../shared/lib/consentimento';

/**
 * QUEM O PSICÓLOGO PODE VER, E ATÉ QUANDO.
 *
 * A regra é do dono do produto e da LGPD: o aluno autoriza; menor de 16
 * precisa do responsável. As duas pontas são exclusivas, então a mesma
 * tela se comporta de quatro jeitos:
 *
 *                 aluno com 16+     aluno com menos de 16
 *   aluno         concede           vê o que foi concedido, e encerra
 *   responsável   vê, e encerra     concede
 *
 * ENCERRAR é aberto a todos os que veem, inclusive ao menor. Encerrar só
 * reduz o que é compartilhado, e um adolescente que quer se afastar de
 * um acompanhamento não pode depender de um adulto para isso.
 *
 * A caixa "o que nunca é compartilhado" não é enfeite: é a informação
 * que faz alguém confiar o suficiente para autorizar.
 */

interface Props {
  aluno: { id: string; nome: string };
  papel: 'aluno' | 'responsavel';
}

export function AcessoPsicologo({ aluno, papel }: Props) {
  const setToast = useAppStore((s) => s.setToast);
  const agendamentos = useMarketplaceStore((s) => s.agendamentos);
  const carregarConsultas = useMarketplaceStore((s) => s.carregarConsultas);

  const [quem, setQuem] = useState<'aluno' | 'responsavel' | null>(null);
  const [lista, setLista] = useState<Consentimento[]>([]);
  const [psicologoId, setPsicologoId] = useState('');
  const [escopo, setEscopo] = useState<EscopoConsentimento[]>(['bem_estar']);
  const [dias, setDias] = useState(DIAS_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [encerrando, setEncerrando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [q, todos] = await Promise.all([
      psicologiaRepository.quemAutoriza(aluno.id),
      psicologiaRepository.meusConsentimentos(),
    ]);
    setQuem(q);
    setLista(todos.filter((c) => c.alunoId === aluno.id && c.vigente));
  }, [aluno.id]);

  useEffect(() => {
    void carregar();
    void carregarConsultas();
  }, [carregar, carregarConsultas]);

  /* Só profissionais com quem já existe consulta. Autorizar um nome
     tirado do catálogo, sem nunca ter falado com ele, seria entregar
     dado de saúde a um desconhecido. */
  const profissionais = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const a of agendamentos) {
      if (a.alunoId === aluno.id && a.status !== 'cancelado' && !vistos.has(a.psicologoId)) {
        vistos.set(a.psicologoId, a.psicologoNome ?? 'Profissional');
      }
    }
    return [...vistos].map(([id, nome]) => ({ id, nome }));
  }, [agendamentos, aluno.id]);

  useEffect(() => {
    if (!psicologoId && profissionais.length > 0) setPsicologoId(profissionais[0].id);
  }, [profissionais, psicologoId]);

  const podeConceder = quem !== null && quem === papel;

  function alternar(id: EscopoConsentimento) {
    setEscopo((atual) => (atual.includes(id) ? atual.filter((e) => e !== id) : [...atual, id]));
  }

  async function autorizar() {
    if (!psicologoId || escopo.length === 0 || salvando) return;
    setSalvando(true);
    try {
      await psicologiaRepository.conceder(aluno.id, psicologoId, escopo, dias);
      await carregar();
      setToast('Acesso autorizado.', 'success');
    } catch (e) {
      setToast(mensagemErroConsentimento(e), 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar(c: Consentimento) {
    setEncerrando(c.id);
    try {
      await psicologiaRepository.revogar(c.id);
      await carregar();
      setToast(`${c.psicologoNome} não vê mais esses dados.`, 'success');
    } catch {
      setToast('Não foi possível encerrar agora. Tente de novo.', 'error');
    } finally {
      setEncerrando(null);
    }
  }

  const ehAluno = papel === 'aluno';

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-cyan-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-200">
            {ehAluno ? 'O que o psicólogo pode ver' : `O que o psicólogo pode ver de ${aluno.nome}`}
          </h2>
          <p className="text-[11px] text-gray-500">Sempre com prazo, e dá para encerrar a qualquer hora.</p>
        </div>
      </div>

      <div className="glass-light rounded-xl px-3.5 py-3 border border-white/[0.04] flex gap-2.5">
        <EyeOff size={15} className="text-gray-500 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">
          <strong className="text-gray-300">Nunca é compartilhado:</strong> conversas com o Mentor,
          o caderno e o que {ehAluno ? 'você escreve' : 'o estudante escreve'} sobre como está se
          sentindo. Nem com o psicólogo, nem com ninguém.
        </p>
      </div>

      {quem === null ? (
        <div className="h-24 rounded-xl bg-white/5 animate-pulse" aria-hidden="true" />
      ) : !podeConceder ? (
        <div className="rounded-xl bg-violet-500/[0.06] border border-violet-500/15 px-3.5 py-3 flex gap-2.5" role="note">
          <UserRoundCheck size={15} className="text-violet-300 shrink-0 mt-0.5" />
          <p className="text-xs text-violet-200/90 leading-relaxed">
            {ehAluno
              ? 'Como você tem menos de 16 anos, quem autoriza é o seu responsável, pelo painel dele. É a lei (LGPD). Você vê tudo o que foi liberado aqui, e pode encerrar quando quiser.'
              : `${aluno.nome} tem 16 anos ou mais, então quem decide é o próprio estudante, pelo app dele. Você vê o que foi liberado e também pode encerrar.`}
          </p>
        </div>
      ) : profissionais.length === 0 ? (
        <p className="text-sm text-gray-500 glass-light rounded-xl px-3.5 py-3">
          Só dá para autorizar um profissional com quem já existe consulta marcada. Marque uma
          consulta primeiro, na lista de psicólogos.
        </p>
      ) : (
        <div className="space-y-3.5">
          <div>
            <label htmlFor="consent-psico" className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
              Profissional
            </label>
            <select
              id="consent-psico"
              value={psicologoId}
              onChange={(e) => setPsicologoId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white outline-none focus:border-cyan-500/40 min-h-[44px]"
            >
              {profissionais.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0d1426]">
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
              O que liberar
            </legend>
            <div className="space-y-2">
              {ESCOPOS.map((e) => {
                const marcado = escopo.includes(e.id);
                return (
                  <label
                    key={e.id}
                    className={`flex gap-3 items-start rounded-xl px-3.5 py-3 border cursor-pointer transition-all ${
                      marcado ? 'border-cyan-500/40 bg-cyan-500/[0.07]' : 'border-white/[0.06] glass-light'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(e.id)}
                      className="mt-0.5 accent-cyan-400 w-4 h-4"
                    />
                    <span>
                      <span className="block text-sm text-white font-medium">{e.rotulo}</span>
                      <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{e.detalhe}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Por quanto tempo</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {DURACOES.map((d) => (
                <button
                  key={d.dias}
                  type="button"
                  role="radio"
                  aria-checked={dias === d.dias}
                  onClick={() => setDias(d.dias)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                    dias === d.dias
                      ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40'
                      : 'text-gray-400 border-white/[0.06] glass-light'
                  }`}
                >
                  {d.rotulo}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-600 mt-1.5">Depois disso o acesso termina sozinho.</p>
          </fieldset>

          <button
            type="button"
            onClick={autorizar}
            disabled={salvando || escopo.length === 0}
            className="btn-primary w-full h-12 text-sm disabled:opacity-40"
          >
            {salvando ? 'Autorizando…' : 'Autorizar acesso'}
          </button>
          {escopo.length === 0 && (
            <p className="text-xs text-amber-300/90">Marque pelo menos um item para autorizar.</p>
          )}
        </div>
      )}

      <div>
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Acessos ativos</h3>
        {lista.length === 0 ? (
          <p className="text-sm text-gray-500 glass-light rounded-xl px-3.5 py-3">
            Nenhum. Enquanto for assim, nenhum psicólogo vê esses dados.
          </p>
        ) : (
          <ul className="space-y-2">
            {lista.map((c) => (
              <li key={c.id} className="glass-light rounded-xl px-3.5 py-3 border border-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{c.psicologoNome}</p>
                    <p className="text-[11px] text-gray-500">CRP {c.crp}</p>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      Vê {rotuloEscopo(c.escopo)}. Termina em {diasRestantes(c.validoAte)} dia(s).
                    </p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Autorizado por {c.concedidoPor}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => encerrar(c)}
                    disabled={encerrando === c.id}
                    className="px-3 py-2 rounded-lg text-xs text-gray-400 border border-white/10 hover:border-red-500/40 hover:text-red-300 transition-all min-h-[40px] shrink-0 disabled:opacity-50"
                  >
                    {encerrando === c.id ? 'Encerrando…' : 'Encerrar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
