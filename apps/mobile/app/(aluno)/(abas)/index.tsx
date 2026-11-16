import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { userRepository } from '@mentor/api/UserRepository';
import { diasAteAProva } from '@mentor/core/primeiroAcesso';
import { acertoPorMateria, atividadeDaSemana, mediaDeAcerto, progressoDeNivel } from '@mentor/core/painelAluno';
import { getToday, MOOD_LABEL } from '@mentor/core/utils';
import { useAppStore } from '@mentor/state/appStore';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { CartaoFadiga } from '../../../src/features/central/CartaoFadiga';
import { CheckinSSC } from '../../../src/features/central/CheckinSSC';
import { FlorestaDoDia } from '../../../src/features/central/FlorestaDoDia';
import { recarregarTudo, useEstadoCarga } from '../../../src/sessao/carga';
import { Barra, Esqueleto, Selo, Vazio } from '../../../src/ui/Basicos';
import { Cartao } from '../../../src/ui/Cartao';
import { GraficoBarras } from '../../../src/ui/Graficos';
import { Tela } from '../../../src/ui/Tela';
import { Texto } from '../../../src/ui/Texto';
import { cor } from '../../../src/ui/tema';
import { useLayout } from '../../../src/ui/layout';
import { useCoresSinal } from '../../../src/ui/preferenciasAcessibilidade';
import type { CoresSinal } from '@mentor/core/acessibilidadeCores';

function corDoAcerto(pct: number, sinal: CoresSinal): string {
  return pct >= 70 ? sinal.acerto : pct >= 40 ? sinal.aviso : sinal.erro;
}

/**
 * Central de Comando: tela inicial do aluno.
 *
 * Pinta na hora com o que já está no store (nada de tela branca
 * esperando rede) e mostra esqueleto só onde o dado ainda está chegando:
 * dizer "nenhuma atividade" enquanto a atividade carrega seria mentir.
 */
export default function Central() {
  const nome = useAppStore((s) => (s.session?.nome ?? '').split(' ')[0] || 'Estudante');
  const plano = useAppStore((s) => s.dailyPlan);
  const humor = useAppStore((s) => s.currentMood);
  const xp = useAppStore((s) => s.gamification.xp);
  const ofensiva = useAppStore((s) => s.gamification.streak);
  const logs = useAppStore((s) => s.logs);
  const quizzes = useAppStore((s) => s.quizResults);
  const carga = useEstadoCarga();
  const sinal = useCoresSinal();
  const [planoCarregando, setPlanoCarregando] = useState(!plano);
  const [atualizando, setAtualizando] = useState(false);
  const [dataProva, setDataProva] = useState<string | null>(null);
  const faltam = diasAteAProva(dataProva);
  const duasColunas = useLayout().duasColunas;

  /* Plano de hoje vem do banco; só gera um novo se não existir (como no web). */
  const carregarPlano = useCallback(async () => {
    const { recalcSSC, regeneratePlan } = useAppStore.getState();
    recalcSSC();
    try {
      const salvo = await supabaseRepository.loadPlano(getToday());
      if (salvo) useAppStore.setState({ dailyPlan: salvo });
      else regeneratePlan();
    } catch {
      regeneratePlan();
    } finally {
      setPlanoCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarPlano();
    if (!useBemEstarStore.getState().carregado) void useBemEstarStore.getState().carregarTudo();
    // Data da prova do primeiro acesso (033): banco sem a coluna devolve null.
    void userRepository.carregarDataProva().then(setDataProva);
  }, [carregarPlano]);

  async function atualizar() {
    setAtualizando(true);
    await Promise.allSettled([recarregarTudo(), carregarPlano()]);
    setAtualizando(false);
  }

  const nivel = progressoDeNivel(xp);
  const semana = useMemo(() => atividadeDaSemana(logs), [logs]);
  const materias = useMemo(() => acertoPorMateria(quizzes), [quizzes]);
  const media = mediaDeAcerto(materias);
  const tarefas = plano?.tasks ?? [];
  const feitas = tarefas.filter((t) => t.completed).length;
  const totalSemana = semana.reduce((s, d) => s + d.total, 0);
  const carregandoDados = carga === 'carregando' || carga === 'ociosa';

  const colunaPrincipal = (
    <View style={{ gap: 14 }}>
      <CheckinSSC />
      <CartaoFadiga />
      <View style={estilos.faixaPlano} accessible accessibilityRole="header">
        <View style={{ flex: 1 }}>
          <Texto variante="rotulo" cor={cor.ambar100}>
            Plano do dia · {MOOD_LABEL[humor] || 'Neutro'}
          </Texto>
          <Texto variante="subtitulo" cor={cor.branco}>
            {feitas} de {tarefas.length} tarefas concluídas
          </Texto>
        </View>
        <Ionicons name="locate" size={26} color={cor.branco} />
      </View>
      {planoCarregando ? (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} altura={70} largura={76} estilo={{ borderRadius: 38 }} />
          ))}
        </View>
      ) : tarefas.length > 0 ? (
        <FlorestaDoDia tarefas={tarefas} />
      ) : (
        <Vazio titulo="Diz como você está hoje." texto="O sagui monta o plano a partir daí." />
      )}
    </View>
  );

  const colunaLateral = (
    <View style={{ gap: 14 }}>
      <Cartao estilo={{ gap: 8 }}>
        <View style={estilos.linha}>
          <Texto variante="subtitulo">Progresso</Texto>
          <Selo texto={`Nível ${nivel.nivel}`} corFundo={cor.azul100} corTexto={cor.azul600} />
        </View>
        <Texto>
          <Texto variante="numero">{nivel.xpNoNivel}</Texto>
          <Texto negrito cor={cor.tinta500}> / {nivel.xpParaProximo} XP</Texto>
        </Texto>
        <Barra valor={nivel.pct} altura={14} rotulo={`Progresso do nível ${nivel.nivel}`} />
        <Texto variante="legenda">
          {xp} XP acumulados · ofensiva de {ofensiva} {ofensiva === 1 ? 'dia' : 'dias'}
        </Texto>
      </Cartao>

      <Cartao estilo={{ gap: 8 }}>
        <View style={estilos.linha}>
          <Texto variante="subtitulo">Sua semana</Texto>
          <Texto variante="legenda">{totalSemana} atividades</Texto>
        </View>
        {carregandoDados && logs.length === 0 ? (
          <Esqueleto altura={120} />
        ) : (
          <GraficoBarras
            barras={semana.map((d) => ({ rotulo: d.rotulo, valor: d.total, destaque: d.hoje }))}
            resumo={`Atividades nos últimos 7 dias: ${semana.map((d) => `${d.rotulo} ${d.total}`).join(', ')}`}
          />
        )}
      </Cartao>

      {materias.length > 0 ? (
        <Cartao estilo={{ gap: 10 }}>
          <View style={estilos.linha}>
            <Texto variante="subtitulo">Acertos por matéria</Texto>
            {media !== null ? <Selo texto={`${media}% média`} corFundo={`${corDoAcerto(media, sinal)}1A`} corTexto={corDoAcerto(media, sinal)} /> : null}
          </View>
          {materias.map((m) => (
            <View key={m.materia} style={{ gap: 4 }} accessible accessibilityLabel={`${m.materia}: ${m.acertos} de ${m.total}, ${m.pct} por cento`}>
              <View style={estilos.linha}>
                <Texto negrito numberOfLines={1} style={{ flex: 1 }}>
                  {m.materia}
                </Texto>
                <Texto negrito cor={corDoAcerto(m.pct, sinal)}>
                  {m.pct}%
                </Texto>
              </View>
              <Barra valor={m.pct} corBarra={corDoAcerto(m.pct, sinal)} altura={10} />
            </View>
          ))}
        </Cartao>
      ) : carregandoDados ? (
        <Esqueleto altura={140} />
      ) : null}
    </View>
  );

  return (
    <Tela
      cabecalho={{
        titulo: `Olá, ${nome}!`,
        subtitulo: faltam !== null && faltam >= 0 ? (faltam === 0 ? 'É hoje! Respira e confia no que você estudou.' : `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'} para a prova.`) : 'Bora manter a ofensiva hoje?',
        cor: 'ceu',
        pose: 'acenando',
      }}
      aoAtualizar={() => void atualizar()}
      atualizando={atualizando}
    >
      {duasColunas ? (
        <View style={estilos.colunas}>
          <View style={{ flex: 1 }}>{colunaPrincipal}</View>
          <View style={{ width: 320 }}>{colunaLateral}</View>
        </View>
      ) : (
        <>
          {colunaPrincipal}
          {colunaLateral}
        </>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  faixaPlano: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cor.azul600,
    borderRadius: 20,
    borderBottomWidth: 4,
    borderBottomColor: cor.azul700,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
