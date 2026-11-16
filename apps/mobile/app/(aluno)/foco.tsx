import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { calcularMoedas, META_MINUTOS_MODO, moedasDeHoje } from '@mentor/core/focusShield';
import { CONSCIOUS_PAUSE_SECONDS, formatFocusTime } from '@mentor/core/focusLogic';
import { estadoDoPomodoro, POMODORO_PADRAO } from '@mentor/core/pomodoro';
import { safeGet, safeRemove, safeSet } from '@mentor/core/safeStorage';
import type { ModoEscudo } from '@mentor/core/types';
import * as FocusShield from '../../modules/focus-shield';
import { anunciar, vibrar } from '../../src/ui/acessibilidade';
import { Selo } from '../../src/ui/Basicos';
import { Botao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { cor, raio } from '../../src/ui/tema';

const CHAVE_POMODORO = 'mm_pomodoro_inicio';
const MODOS: { id: ModoEscudo; rotulo: string; texto: string }[] = [
  { id: 'leve', rotulo: 'Leve', texto: '15 min' },
  { id: 'enem', rotulo: 'ENEM', texto: '25 min' },
  { id: 'maratona', rotulo: 'Maratona', texto: '50 min ou mais' },
];
const NOME_FASE = { foco: 'Foco', pausa: 'Pausa curta', pausaLonga: 'Pausa longa' } as const;

function Anel({ fracao, cor: corAnel, children }: { fracao: number; cor: string; children: React.ReactNode }) {
  const r = 92;
  const c = 2 * Math.PI * r;
  return (
    <View style={estilos.anel}>
      <Svg width={220} height={220} style={{ position: 'absolute' }}>
        <Circle cx={110} cy={110} r={r} stroke={cor.cinza100} strokeWidth={14} fill="none" />
        <Circle
          cx={110}
          cy={110}
          r={r}
          stroke={corAnel}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fracao)))}
          transform="rotate(-90 110 110)"
        />
      </Svg>
      {children}
    </View>
  );
}

/**
 * Pausa consciente: o aluno desbloqueou o celular no meio do escudo.
 * Não é bronca: é um respiro de 2 minutos e a escolha de voltar ou
 * encerrar. Quem decide é ele.
 */
function PausaConsciente({ aberta, aoVoltar, aoEncerrar }: { aberta: boolean; aoVoltar: () => void; aoEncerrar: () => void }) {
  const [restante, setRestante] = useState(CONSCIOUS_PAUSE_SECONDS);
  useEffect(() => {
    if (!aberta) return;
    setRestante(CONSCIOUS_PAUSE_SECONDS);
    const t = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [aberta]);
  return (
    <Modal visible={aberta} transparent animationType="fade" onRequestClose={aoVoltar}>
      <View style={estilos.fundoModal}>
        <Cartao estilo={estilos.modal}>
          <Texto variante="subtitulo" centro accessibilityRole="header">
            Pausa consciente
          </Texto>
          <Texto centro>Você voltou ao celular. Respira fundo: o que você veio fazer aqui agora?</Texto>
          <Texto variante="numero" centro cor={cor.esmeralda600} accessibilityLabel={`${restante} segundos de pausa`}>
            {formatFocusTime(restante)}
          </Texto>
          <Botao titulo="Voltar ao foco" variante="sucesso" aoTocar={aoVoltar} />
          <Botao titulo="Encerrar a sessão" variante="secundario" aoTocar={aoEncerrar} />
        </Cartao>
      </View>
    </Modal>
  );
}

/**
 * Modo Foco: Pomodoro e Escudo de Dopamina.
 *
 * O Pomodoro sai do instante de início (volta certo depois da tela
 * apagada). O Escudo mede o tempo com o celular bloqueado pelo módulo
 * nativo e o servidor paga as moedas pelo próprio relógio (031).
 */
export default function Foco() {
  const escudo = useBemEstarStore((s) => s.escudo);
  const carteira = useBemEstarStore((s) => s.carteira);
  const sessoes = useBemEstarStore((s) => s.sessoesOffline);
  const [aba, setAba] = useState<'pomodoro' | 'escudo'>(escudo.ativo ? 'escudo' : 'pomodoro');
  const [inicioPomodoro, setInicioPomodoro] = useState<number | null>(() => Number(safeGet(CHAVE_POMODORO)) || null);
  const [agora, setAgora] = useState(Date.now());
  const [modo, setModo] = useState<ModoEscudo>('enem');
  const [medido, setMedido] = useState<FocusShield.EstadoEscudoNativo | null>(null);
  const [pausaAberta, setPausaAberta] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [resultado, setResultado] = useState<{ moedas: number; minutos: number } | null>(null);

  // Um tique por segundo só re-renderiza esta tela; os números vêm de timestamps.
  useEffect(() => {
    if (!inicioPomodoro && !escudo.ativo) return;
    const t = setInterval(() => {
      setAgora(Date.now());
      if (escudo.ativo) setMedido(FocusShield.estado());
    }, 1000);
    return () => clearInterval(t);
  }, [inicioPomodoro, escudo.ativo]);

  // Desbloqueou no meio do escudo: abre a pausa consciente.
  useEffect(() => {
    if (!escudo.ativo) return;
    const sub = FocusShield.ouvir('retornou', (e) => {
      setMedido(e);
      useBemEstarStore.getState().registrarInterrupcao();
      setPausaAberta(true);
    });
    return () => sub.remove();
  }, [escudo.ativo]);

  /* Fase do Pomodoro mudou: vibra e anuncia (com a tela acesa). */
  const pomodoro = inicioPomodoro ? estadoDoPomodoro(inicioPomodoro, agora) : null;
  const fase = pomodoro?.fase;
  useEffect(() => {
    if (!fase) return;
    void vibrar('toque');
    anunciar(fase === 'foco' ? 'Hora de focar.' : 'Hora da pausa. Levanta, bebe água.');
  }, [fase]);

  function alternarPomodoro() {
    if (inicioPomodoro) {
      safeRemove(CHAVE_POMODORO);
      setInicioPomodoro(null);
      return;
    }
    const agoraMs = Date.now();
    safeSet(CHAVE_POMODORO, String(agoraMs));
    setInicioPomodoro(agoraMs);
    setAgora(agoraMs);
  }

  async function ativarEscudo() {
    setResultado(null);
    const e = await FocusShield.iniciar(modo);
    setMedido(e);
    useBemEstarStore.getState().iniciarEscudo(modo);
    anunciar('Escudo ativo. Bloqueie o celular e vá estudar.');
  }

  async function encerrarEscudo() {
    setPausaAberta(false);
    setEncerrando(true);
    try {
      const final = await FocusShield.encerrar();
      const r = await useBemEstarStore.getState().encerrarEscudo({ minutosOffline: final.minutosOffline, interrupcoes: final.interrupcoes });
      setResultado(r);
      if (r) {
        void vibrar('acerto');
        anunciar(`Sessão encerrada: ${Math.round(r.minutos)} minutos, ${r.moedas} moedas.`);
      }
    } finally {
      setEncerrando(false);
      setMedido(null);
    }
  }

  const minutosOffline = medido?.minutosOffline ?? 0;
  const previa = calcularMoedas(minutosOffline, medido?.interrupcoes ?? escudo.interrupcoes, escudo.modo, moedasDeHoje(sessoes));
  const meta = META_MINUTOS_MODO[escudo.ativo ? escudo.modo : modo];

  return (
    <Tela cabecalho={{ titulo: 'Modo Foco', subtitulo: 'Pomodoro e Escudo de Dopamina', cor: 'ambar', pose: 'meditando', voltar: true }}>
      <View style={estilos.alternador} accessibilityRole="tablist">
        {(['pomodoro', 'escudo'] as const).map((a) => (
          <Pressable key={a} onPress={() => setAba(a)} accessibilityRole="tab" accessibilityState={{ selected: aba === a }} style={[estilos.botaoAba, aba === a ? estilos.botaoAbaAtivo : null]}>
            <Texto negrito cor={aba === a ? cor.branco : cor.tinta700}>
              {a === 'pomodoro' ? 'Pomodoro' : 'Escudo'}
            </Texto>
          </Pressable>
        ))}
      </View>

      {aba === 'pomodoro' ? (
        <Cartao estilo={{ alignItems: 'center', gap: 14 }}>
          <Anel fracao={pomodoro ? 1 - pomodoro.restanteSeg / pomodoro.duracaoSeg : 0} cor={pomodoro?.fase === 'foco' || !pomodoro ? cor.ambar500 : cor.esmeralda500}>
            <Texto variante="rotulo">{pomodoro ? NOME_FASE[pomodoro.fase] : 'Pronto'}</Texto>
            <Texto variante="numero" style={{ fontSize: 44 }} accessibilityLabel={pomodoro ? `${Math.ceil(pomodoro.restanteSeg / 60)} minutos restantes` : '25 minutos'}>
              {formatFocusTime(pomodoro?.restanteSeg ?? POMODORO_PADRAO.focoMin * 60)}
            </Texto>
            {pomodoro ? <Texto variante="legenda">Ciclo {pomodoro.ciclo}</Texto> : null}
          </Anel>
          <Botao titulo={inicioPomodoro ? 'Parar' : 'Começar 25 minutos'} variante={inicioPomodoro ? 'secundario' : 'ambar'} aoTocar={alternarPomodoro} estilo={{ alignSelf: 'stretch' }} />
          {pomodoro && pomodoro.focoConcluidoMin > 0 ? <Texto variante="legenda">{pomodoro.focoConcluidoMin} minutos de foco hoje nesta sequência</Texto> : null}
          <Texto variante="legenda" centro>
            O tempo continua certo com a tela apagada ou o app fechado: ele sai da hora em que você começou.
          </Texto>
        </Cartao>
      ) : (
        <>
          <Cartao estilo={{ gap: 6 }}>
            <View style={estilos.linha}>
              <Texto variante="subtitulo">Carteira de foco</Texto>
              <Selo texto={`${carteira.saldo} moedas`} corFundo={cor.ambar100} corTexto={cor.ambar700} />
            </View>
            <Texto variante="legenda">Moedas valem na Loja do Sagui. Quem conta e paga é o servidor, pelo relógio dele.</Texto>
          </Cartao>

          {!escudo.ativo ? (
            <Cartao estilo={{ gap: 12 }}>
              <Texto variante="subtitulo">Escolha o desafio</Texto>
              <View style={estilos.modos}>
                {MODOS.map((m) => (
                  <Pressable key={m.id} onPress={() => setModo(m.id)} accessibilityRole="radio" accessibilityState={{ checked: modo === m.id }} style={[estilos.modo, modo === m.id ? estilos.modoAtivo : null]}>
                    <Texto negrito>{m.rotulo}</Texto>
                    <Texto variante="legenda">{m.texto}</Texto>
                  </Pressable>
                ))}
              </View>
              <Botao titulo="Ativar escudo" variante="ambar" icone="shield-checkmark" aoTocar={() => void ativarEscudo()} />
              <Texto variante="legenda">
                Comece com internet (o servidor marca o início). Depois pode bloquear o celular e até pôr no modo avião.
              </Texto>
              {!FocusShield.temModuloNativo() ? (
                <Texto variante="legenda" cor={cor.ambar700}>
                  Aqui a medição é aproximada: conta o tempo com o app em segundo plano. No app instalado, conta só o celular bloqueado.
                </Texto>
              ) : null}
            </Cartao>
          ) : (
            <Cartao estilo={{ alignItems: 'center', gap: 12 }} destaque={cor.ambar500}>
              <Anel fracao={minutosOffline / meta} cor={cor.ambar500}>
                <Texto variante="rotulo">Longe da tela</Texto>
                <Texto variante="numero" style={{ fontSize: 40 }}>
                  {Math.floor(minutosOffline)} min
                </Texto>
                <Texto variante="legenda">meta {meta} min</Texto>
              </Anel>
              <Texto centro negrito>
                Bloqueie o celular e vá estudar. O tempo conta sozinho.
              </Texto>
              <Texto variante="legenda" centro>
                Prévia: {previa.moedas} moedas · {medido?.interrupcoes ?? 0} {medido?.interrupcoes === 1 ? 'volta' : 'voltas'} ao celular
              </Texto>
              <Botao titulo="Encerrar e receber" variante="sucesso" carregando={encerrando} aoTocar={() => void encerrarEscudo()} estilo={{ alignSelf: 'stretch' }} />
              <Botao
                titulo="Cancelar sem receber"
                variante="fantasma"
                compacto
                aoTocar={() => {
                  void FocusShield.encerrar();
                  useBemEstarStore.getState().cancelarEscudo();
                  setMedido(null);
                }}
              />
            </Cartao>
          )}

          {resultado ? (
            <Cartao destaque={cor.esmeralda500} estilo={{ alignItems: 'center', gap: 6 }}>
              <Texto variante="rotulo" cor={cor.esmeralda700}>
                Sessão encerrada
              </Texto>
              <Texto variante="numero" cor={cor.esmeralda600}>
                +{resultado.moedas} moedas
              </Texto>
              <Texto variante="legenda">
                {Math.round(resultado.minutos)} minutos contados pelo servidor
                {resultado.moedas === 0 ? '. Sessões com menos de 5 minutos longe não pagam.' : '.'}
              </Texto>
              <Botao titulo="Ir para a loja" compacto variante="secundario" aoTocar={() => router.push('/loja')} />
            </Cartao>
          ) : null}
        </>
      )}

      <PausaConsciente aberta={pausaAberta} aoVoltar={() => setPausaAberta(false)} aoEncerrar={() => void encerrarEscudo()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  alternador: { flexDirection: 'row', gap: 8 },
  botaoAba: { flex: 1, minHeight: 44, borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.cinza200, alignItems: 'center', justifyContent: 'center' },
  botaoAbaAtivo: { backgroundColor: cor.ambar600, borderColor: cor.ambar600 },
  anel: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modos: { flexDirection: 'row', gap: 8 },
  modo: { flex: 1, minHeight: 64, borderRadius: raio.md, borderWidth: 2, borderColor: cor.cinza200, alignItems: 'center', justifyContent: 'center', padding: 8 },
  modoAtivo: { borderColor: cor.ambar500, backgroundColor: cor.ambar50 },
  fundoModal: { flex: 1, backgroundColor: 'rgba(11,15,25,0.5)', justifyContent: 'center', padding: 20 },
  modal: { gap: 12, maxWidth: 440, width: '100%', alignSelf: 'center' },
});
