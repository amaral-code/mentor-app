import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { useMarketplaceStore } from '@mentor/state/marketplaceStore';
import { useAppStore } from '@mentor/state/appStore';
import { forcaDaMemoria, limitarCargaDiaria, ROTULO_NIVEL } from '@mentor/core/srsEngine';
import { diaLocal, estaAtrasada, INICIAIS_SEMANA, NOMES_MES, revisoesDoDia, semanasDoMes } from '@mentor/core/calendarioRevisoes';
import { ehLinkDeSalaValido, formatarDataHora, salaEstaAberta, tempoAte } from '@mentor/core/bookingEngine';
import type { RevisaoEspacada } from '@mentor/core/types';
import { Selo, Vazio } from '../../src/ui/Basicos';
import { Botao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { ALVO_TOQUE, cor, raio } from '../../src/ui/tema';

/* Teto do dia, como no web: depois de uma semana parado, 30 itens em
   vermelho são um convite a fechar o app. */
const TETO_DIARIO = 8;

function LinhaRevisao({ r }: { r: RevisaoEspacada }) {
  const atrasada = estaAtrasada(r);
  function revisar() {
    // O quiz é a revisão: o resultado volta para agendarRevisao e recalcula a data.
    router.push({ pathname: '/quiz', params: { materia: r.materia, topico: r.topicoNome, revisao: r.topicoId } });
  }
  async function adiar() {
    // Adiar = revisão mediana: não sobe de nível, mas sai da fila de hoje.
    await useBemEstarStore.getState().agendarRevisao(r.topicoId, r.topicoNome, r.materia, 70);
    useAppStore.getState().setToast('Tópico reagendado.', 'info');
  }
  return (
    <View style={estilos.linhaRevisao}>
      <View style={{ flex: 1 }}>
        <Texto negrito numberOfLines={1}>
          {r.topicoNome}
        </Texto>
        <Texto variante="legenda">
          {r.materia || 'Geral'} · {ROTULO_NIVEL[r.nivelMemoria]} · memória {forcaDaMemoria(r)}%{atrasada ? ' · atrasada' : ''}
        </Texto>
      </View>
      <Botao titulo="Revisar" compacto variante="ceu" aoTocar={revisar} rotuloAcessivel={`Revisar ${r.topicoNome}`} />
      <Pressable onPress={() => void adiar()} accessibilityRole="button" accessibilityLabel={`Adiar ${r.topicoNome}`} style={estilos.adiar}>
        <Ionicons name="time-outline" size={20} color={cor.tinta500} />
      </Pressable>
    </View>
  );
}

/**
 * Revisões e agenda: o calendário da revisão espaçada (cada quiz marca
 * sozinho quando o tópico volta) e as consultas marcadas com psicólogo.
 */
export default function Revisoes() {
  const revisoes = useBemEstarStore((s) => s.revisoes);
  const carregado = useBemEstarStore((s) => s.carregado);
  const consultas = useMarketplaceStore((s) => s.agendamentos);
  const hoje = new Date();
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaEscolhido, setDiaEscolhido] = useState(diaLocal(hoje));
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (!carregado) void useBemEstarStore.getState().carregarTudo();
    void useMarketplaceStore.getState().carregarConsultas().catch(() => {});
  }, [carregado]);
  // A contagem até a consulta anda sozinha, de minuto em minuto.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const semanas = useMemo(() => semanasDoMes(mes.ano, mes.mes, revisoes), [mes, revisoes]);
  const fila = useMemo(() => limitarCargaDiaria(revisoes, TETO_DIARIO), [revisoes]);
  const hojeStr = diaLocal(hoje);
  const doDia = diaEscolhido === hojeStr ? fila.hoje : revisoesDoDia(revisoes, diaEscolhido);
  const proximas = consultas
    .filter((c) => (c.status === 'agendado' || c.status === 'confirmado') && new Date(c.fim).getTime() > agora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  function andarMes(delta: number) {
    setMes(({ ano, mes: m }) => {
      const d = new Date(ano, m + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }

  const [, mm, dd] = diaEscolhido.split('-');

  return (
    <Tela cabecalho={{ titulo: 'Revisões', subtitulo: 'Entram sozinhas, no dia em que a memória começa a falhar', cor: 'ambar', pose: 'estudando_caderno', voltar: true }}>
      <Cartao estilo={{ gap: 10 }}>
        <View style={estilos.linhaMes}>
          <Pressable onPress={() => andarMes(-1)} accessibilityRole="button" accessibilityLabel="Mês anterior" style={estilos.seta}>
            <Ionicons name="chevron-back" size={22} color={cor.azul600} />
          </Pressable>
          <Texto variante="subtitulo" accessibilityRole="header">
            {NOMES_MES[mes.mes]} {mes.ano}
          </Texto>
          <Pressable onPress={() => andarMes(1)} accessibilityRole="button" accessibilityLabel="Próximo mês" style={estilos.seta}>
            <Ionicons name="chevron-forward" size={22} color={cor.azul600} />
          </Pressable>
        </View>
        <View style={estilos.semana}>
          {INICIAIS_SEMANA.map((l, i) => (
            <Texto key={i} variante="legenda" centro style={estilos.celulaTitulo}>
              {l}
            </Texto>
          ))}
        </View>
        {semanas.map((semana) => (
          <View key={semana[0].data} style={estilos.semana}>
            {semana.map((d) => {
              const escolhido = d.data === diaEscolhido;
              return (
                <Pressable
                  key={d.data}
                  onPress={() => setDiaEscolhido(d.data)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: escolhido }}
                  accessibilityLabel={`${d.dia} de ${NOMES_MES[Number(d.data.slice(5, 7)) - 1]}${d.hoje ? ', hoje' : ''}: ${d.quantidade} ${d.quantidade === 1 ? 'revisão' : 'revisões'}`}
                  style={[estilos.celula, escolhido ? estilos.celulaEscolhida : d.hoje ? estilos.celulaHoje : null]}
                >
                  <Texto negrito={d.hoje} cor={escolhido ? cor.branco : !d.doMes ? cor.cinza300 : d.passado ? cor.cinza400 : cor.tinta900}>
                    {d.dia}
                  </Texto>
                  {d.quantidade > 0 ? (
                    <View style={[estilos.ponto, { backgroundColor: escolhido ? cor.branco : d.quantidade >= 3 ? cor.vermelho500 : cor.ambar500 }]} />
                  ) : (
                    <View style={estilos.pontoVazio} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </Cartao>

      <Cartao estilo={{ gap: 6 }}>
        <View style={estilos.linhaTitulo}>
          <Texto variante="subtitulo">{diaEscolhido === hojeStr ? 'Para revisar hoje' : `Dia ${dd}/${mm}`}</Texto>
          {diaEscolhido === hojeStr && fila.hoje.length > 0 ? <Selo texto={`${fila.hoje.length} de ${fila.hoje.length + fila.adiadas.length}`} /> : null}
        </View>
        {doDia.length === 0 ? (
          <Vazio
            pose="aprovacao"
            titulo={diaEscolhido === hojeStr ? 'Nada vencendo hoje.' : 'Nenhuma revisão neste dia.'}
            texto="Faça um quiz: o tópico entra no calendário sozinho."
            acao={<Botao titulo="Ir para o quiz" compacto aoTocar={() => router.push('/quiz')} />}
          />
        ) : (
          doDia.map((r) => <LinhaRevisao key={r.topicoId} r={r} />)
        )}
        {diaEscolhido === hojeStr && fila.adiadas.length > 0 ? (
          <Texto variante="legenda" cor={cor.ambar700}>
            {fila.adiadas.length} {fila.adiadas.length === 1 ? 'tópico além do teto entra' : 'tópicos além do teto entram'} na fila de amanhã.
          </Texto>
        ) : null}
      </Cartao>

      <Cartao estilo={{ gap: 8 }}>
        <Texto variante="subtitulo">Consultas</Texto>
        {proximas.length === 0 ? (
          <Texto variante="legenda">Nenhuma consulta marcada. Quando você ou seu responsável marcar com um psicólogo, ela aparece aqui.</Texto>
        ) : (
          proximas.map((c) => {
            const aberta = salaEstaAberta(c, new Date(agora));
            return (
              <View key={c.id} style={estilos.consulta}>
                <View style={{ flex: 1 }}>
                  <Texto negrito>{c.psicologoNome ?? 'Psicólogo'}</Texto>
                  <Texto variante="legenda">
                    {formatarDataHora(c.inicio)} · {aberta ? 'sala aberta' : tempoAte(c.inicio, new Date(agora))}
                  </Texto>
                </View>
                {aberta && ehLinkDeSalaValido(c.meetingUrl) ? (
                  <Botao titulo="Entrar" compacto variante="sucesso" aoTocar={() => void Linking.openURL(c.meetingUrl!)} />
                ) : null}
              </View>
            );
          })
        )}
      </Cartao>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  linhaMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seta: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
  semana: { flexDirection: 'row' },
  celulaTitulo: { flex: 1, fontWeight: '800' },
  celula: { flex: 1, aspectRatio: 1, maxHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: raio.sm, gap: 2 },
  celulaHoje: { borderWidth: 2, borderColor: cor.ambar500 },
  celulaEscolhida: { backgroundColor: cor.ambar600 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  pontoVazio: { width: 6, height: 6 },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linhaRevisao: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: cor.cinza100 },
  adiar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  consulta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
});
