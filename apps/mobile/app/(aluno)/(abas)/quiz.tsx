import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { NivelQuiz } from '@mentor/core/aiService';
import { MATERIAS_QUIZ, TOPICOS_POR_MATERIA, notaDoQuiz } from '@mentor/core/sessaoQuiz';
import { useRodadaQuiz } from '../../../src/features/quiz/useRodadaQuiz';
import { TextoRico } from '../../../src/features/mentor/TextoRico';
import { Barra, Selo } from '../../../src/ui/Basicos';
import { Botao } from '../../../src/ui/Botao';
import { Cartao } from '../../../src/ui/Cartao';
import { Tela } from '../../../src/ui/Tela';
import { Texto } from '../../../src/ui/Texto';
import { cor, LARGURA_NOTEBOOK, raio } from '../../../src/ui/tema';
import { useCoresSinal } from '../../../src/ui/preferenciasAcessibilidade';

const QUANTIDADES = [5, 10, 15];
const NIVEIS: { id: NivelQuiz; rotulo: string }[] = [
  { id: 'facil', rotulo: 'Fácil' },
  { id: 'media', rotulo: 'Médio' },
  { id: 'dificil', rotulo: 'Difícil' },
];
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

function Chip({ texto, ativo, aoTocar }: { texto: string; ativo: boolean; aoTocar: () => void }) {
  return (
    <Pressable onPress={aoTocar} accessibilityRole="checkbox" accessibilityState={{ checked: ativo }} style={[estilos.chip, ativo ? estilos.chipAtivo : null]}>
      <Texto negrito cor={ativo ? cor.ceu700 : cor.tinta700} style={{ fontSize: 14 }}>
        {texto}
      </Texto>
    </Pressable>
  );
}

/**
 * Quiz adaptativo: matéria, tópicos, quantidade e nível; uma questão por
 * vez, resposta registrada no toque, vibração de acerto e erro, tutor no
 * erro. Aberto pelo calendário (?materia=&topico=&revisao=), reagenda o
 * tópico daquela revisão.
 */
export default function Quiz() {
  const params = useLocalSearchParams<{ materia?: string; topico?: string; revisao?: string; rapido?: string }>();
  const r = useRodadaQuiz();
  const sinal = useCoresSinal();
  const { width } = useWindowDimensions();
  const duasColunas = width >= LARGURA_NOTEBOOK;
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [quantidade, setQuantidade] = useState(10);
  const [nivel, setNivel] = useState<NivelQuiz>('media');
  const abertoPorRevisao = useRef<string | null>(null);

  /* Veio do calendário de revisões (reagenda o tópico) ou do convite
     anti doomscroll ("só 3 questões rápidas"): já gera o quiz. */
  useEffect(() => {
    const chave = params.revisao ?? (params.rapido ? `rapido:${params.materia}:${params.rapido}` : null);
    if (!params.materia || !chave || abertoPorRevisao.current === chave) return;
    abertoPorRevisao.current = chave;
    const topico = params.topico || params.materia;
    if (params.revisao) {
      void r.gerar(params.materia, [topico], 5, 'media', { topicoId: params.revisao, topicoNome: topico, materia: params.materia });
    } else {
      void r.gerar(params.materia, ['Geral'], Math.min(5, Number(params.rapido) || 3), 'facil');
    }
  }, [params.materia, params.topico, params.revisao, params.rapido, r]);

  if (r.gerando) {
    return (
      <Tela cabecalho={{ titulo: 'Quiz', subtitulo: r.materia, cor: 'ceu', pose: 'estudando' }}>
        <Cartao estilo={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <ActivityIndicator size="large" color={cor.ceu600} />
          <Texto negrito accessibilityLiveRegion="polite">{r.progresso || 'Montando suas questões…'}</Texto>
        </Cartao>
      </Tela>
    );
  }

  if (r.etapa === 'materia') {
    return (
      <Tela cabecalho={{ titulo: 'Quiz', subtitulo: 'Escolha uma matéria para praticar', cor: 'ceu', pose: 'estudando' }}>
        <View style={estilos.grade}>
          {MATERIAS_QUIZ.map((m) => (
            <Cartao
              key={m}
              aoTocar={() => {
                r.setMateria(m);
                setSelecionados([]);
                r.setEtapa('topicos');
              }}
              rotuloAcessivel={`Quiz de ${m}`}
              estilo={[estilos.materia, { width: duasColunas ? '31%' : '47%' }]}
            >
              <Texto negrito centro>
                {m}
              </Texto>
            </Cartao>
          ))}
        </View>
        <Botao titulo="Flashcards do caderno" variante="secundario" icone="albums-outline" aoTocar={() => router.push('/flashcards')} />
      </Tela>
    );
  }

  if (r.etapa === 'topicos') {
    const topicos = TOPICOS_POR_MATERIA[r.materia] ?? [];
    return (
      <Tela cabecalho={{ titulo: r.materia, subtitulo: 'Escolha os tópicos (ou nenhum, para geral)', cor: 'ceu', pose: 'estudando', acao: <Botao titulo="Trocar matéria" compacto variante="secundario" aoTocar={() => r.setEtapa('materia')} /> }}>
        <Cartao estilo={{ gap: 12 }}>
          <Texto variante="subtitulo">Tópicos</Texto>
          <View style={estilos.chips}>
            {topicos.map((t) => (
              <Chip key={t} texto={t} ativo={selecionados.includes(t)} aoTocar={() => setSelecionados((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))} />
            ))}
          </View>
          <Texto variante="subtitulo">Quantas questões?</Texto>
          <View style={estilos.chips}>
            {QUANTIDADES.map((q) => (
              <Chip key={q} texto={String(q)} ativo={quantidade === q} aoTocar={() => setQuantidade(q)} />
            ))}
          </View>
          <Texto variante="subtitulo">Nível</Texto>
          <View style={estilos.chips}>
            {NIVEIS.map((n) => (
              <Chip key={n.id} texto={n.rotulo} ativo={nivel === n.id} aoTocar={() => setNivel(n.id)} />
            ))}
          </View>
        </Cartao>
        <Botao titulo="Começar" variante="ambar" icone="play" aoTocar={() => void r.gerar(r.materia, selecionados.length ? selecionados : ['Geral'], quantidade, nivel)} />
      </Tela>
    );
  }

  if (r.etapa === 'resultado' && r.resultado) {
    const precisao = notaDoQuiz(r.resultado.acertos, r.resultado.total);
    return (
      <Tela cabecalho={{ titulo: 'Lição concluída!', subtitulo: r.materia, cor: 'esmeralda', pose: 'pulando' }}>
        <View style={estilos.placar}>
          {[
            { rotulo: 'XP', valor: `+${r.resultado.xpGanho}`, cor: cor.ambar600 },
            { rotulo: 'Acertos', valor: `${r.resultado.acertos}/${r.resultado.total}`, cor: cor.esmeralda600 },
            { rotulo: 'Precisão', valor: `${precisao}%`, cor: cor.ceu600 },
          ].map((c) => (
            <Cartao key={c.rotulo} estilo={estilos.cartaoPlacar} destaque={c.cor}>
              <Texto variante="rotulo" cor={c.cor}>
                {c.rotulo}
              </Texto>
              <Texto variante="numero" cor={c.cor}>
                {c.valor}
              </Texto>
            </Cartao>
          ))}
        </View>
        <Texto variante="legenda" centro>
          A nota deste quiz marcou a próxima revisão destes tópicos no calendário.
        </Texto>
        <Cartao estilo={{ gap: 10 }}>
          <Texto variante="subtitulo">Gabarito</Texto>
          {r.questoes.map((q, i) => {
            const certo = r.respostas[i] === q.correta;
            return (
              <View key={q.id} style={estilos.linhaGabarito}>
                <Ionicons name={certo ? 'checkmark-circle' : 'close-circle'} size={22} color={certo ? sinal.acerto : sinal.erro} />
                <Texto style={{ flex: 1 }} numberOfLines={2}>
                  {i + 1}. {q.enunciado}
                </Texto>
              </View>
            );
          })}
        </Cartao>
        <Botao titulo="Outro quiz" variante="ambar" aoTocar={() => r.setEtapa('materia')} />
        <Botao titulo="Ver revisões" variante="secundario" icone="calendar-outline" aoTocar={() => router.push('/revisoes')} />
      </Tela>
    );
  }

  const q = r.questao;
  if (!q) return null;
  const respondida = r.escolhida !== null;
  const acertou = respondida && r.escolhida === q.correta;

  return (
    <Tela cabecalho={{ titulo: r.materia, subtitulo: q.topico ?? undefined, cor: 'ceu', pose: 'estudando' }}>
      <View style={{ gap: 6 }}>
        <View style={estilos.linha}>
          <Texto variante="legenda">
            Questão {r.indice + 1} de {r.questoes.length}
          </Texto>
          {r.sequencia >= 3 ? <Selo texto={`${r.sequencia} seguidas!`} corFundo={cor.ambar100} corTexto={cor.ambar700} /> : null}
        </View>
        <Barra valor={((r.indice + (respondida ? 1 : 0)) / r.questoes.length) * 100} corBarra={cor.esmeralda500} altura={12} rotulo="Progresso do quiz" />
      </View>

      <Cartao estilo={{ gap: 8 }}>
        {q.fonte ? <Selo texto={q.fonte} /> : null}
        <TextoRico texto={q.enunciado} />
      </Cartao>

      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        {q.alternativas.map((alt, i) => {
          const marcada = r.escolhida === i;
          const certa = respondida && i === q.correta;
          const errada = marcada && !certa;
          const borda = certa ? sinal.acerto : errada ? sinal.erro : marcada ? cor.ceu500 : undefined;
          return (
            <Cartao
              key={i}
              aoTocar={respondida ? undefined : () => r.responder(i)}
              destaque={borda}
              selecionado={marcada}
              rotuloAcessivel={`Alternativa ${LETRAS[i]}: ${alt}${certa ? ', correta' : errada ? ', marcada, errada' : ''}`}
              estilo={[estilos.alternativa, certa ? { backgroundColor: sinal.acertoFundo } : errada ? { backgroundColor: sinal.erroFundo } : null]}
            >
              <View style={[estilos.letra, certa ? { backgroundColor: sinal.acerto } : errada ? { backgroundColor: sinal.erro } : null]}>
                <Texto negrito cor={certa || errada ? cor.branco : cor.tinta700}>
                  {LETRAS[i]}
                </Texto>
              </View>
              <Texto style={{ flex: 1 }}>{alt}</Texto>
            </Cartao>
          );
        })}
      </View>

      {respondida ? (
        <Cartao destaque={acertou ? sinal.acerto : sinal.erro} estilo={{ gap: 8, backgroundColor: acertou ? sinal.acertoFundo : sinal.erroFundo }}>
          <Texto variante="subtitulo" cor={acertou ? sinal.acerto : sinal.erro} accessibilityLiveRegion="polite">
            {acertou ? 'Mandou bem!' : 'Quase lá!'}
          </Texto>
          <TextoRico texto={q.explicacao} />
          {!acertou ? (
            r.tutor ? (
              r.tutor.carregando ? (
                <ActivityIndicator color={cor.ceu600} />
              ) : (
                <View style={estilos.tutor}>
                  <Texto variante="rotulo" cor={cor.ceu700}>
                    O tutor explica
                  </Texto>
                  <TextoRico texto={r.tutor.texto} />
                </View>
              )
            ) : (
              <Botao titulo="Entender meu erro" variante="secundario" compacto icone="bulb-outline" aoTocar={() => void r.pedirTutor()} />
            )
          ) : null}
          <Botao titulo={r.indice + 1 < r.questoes.length ? 'Próxima' : 'Ver resultado'} variante={acertou ? 'sucesso' : 'perigo'} aoTocar={r.proxima} />
        </Cartao>
      ) : q.dica ? (
        <Texto variante="legenda">Dica: {q.dica}</Texto>
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  materia: { minHeight: 72, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.cinza200 },
  chipAtivo: { borderColor: cor.ceu500, backgroundColor: cor.ceu50 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alternativa: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  letra: { width: 36, height: 36, borderRadius: 12, backgroundColor: cor.cinza100, alignItems: 'center', justifyContent: 'center' },
  tutor: { backgroundColor: cor.ceu50, borderRadius: raio.md, padding: 12, gap: 6 },
  placar: { flexDirection: 'row', gap: 10 },
  cartaoPlacar: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  linhaGabarito: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
