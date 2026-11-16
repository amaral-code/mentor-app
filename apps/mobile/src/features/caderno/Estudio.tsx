import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { DadosMapaMental } from '@mentor/core/aiService';
import { gerarMapaDoEstudio, gerarTextoDoEstudio, type FerramentaEstudio } from '@mentor/core/estudioCaderno';
import { gerarFlashcards, guardarFlashcards } from '@mentor/core/flashcards';
import type { Nota } from '@mentor/core/types';
import { useAppStore } from '@mentor/state/appStore';
import { Selo } from '../../ui/Basicos';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';
import { TextoRico } from '../mentor/TextoRico';
import { MapaMental } from './MapaMental';

const FERRAMENTAS: { id: FerramentaEstudio; rotulo: string }[] = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'mapa', rotulo: 'Mapa mental' },
  { id: 'flashcards', rotulo: 'Flashcards' },
  { id: 'lacunas', rotulo: 'Lacunas' },
];

/**
 * Notebook AI Studio sobre um conjunto de notas (o caderno todo ou uma
 * nota só). Sem IA, cada ferramenta tem um plano B local e diz que é.
 */
export function Estudio({ notas, titulo }: { notas: Nota[]; titulo: string }) {
  const apiKey = useAppStore((s) => s.apiKey);
  const [ferramenta, setFerramenta] = useState<FerramentaEstudio>('resumo');
  const [carregando, setCarregando] = useState(false);
  const [texto, setTexto] = useState('');
  const [mapa, setMapa] = useState<DadosMapaMental | null>(null);
  const [viaIA, setViaIA] = useState<boolean | null>(null);
  const [cartoes, setCartoes] = useState(0);

  async function gerar(f: FerramentaEstudio) {
    setFerramenta(f);
    setCarregando(true);
    setTexto('');
    setMapa(null);
    setCartoes(0);
    const textos = notas.map((n) => n.text);
    try {
      if (f === 'mapa') {
        const r = await gerarMapaDoEstudio(textos, apiKey);
        setMapa(r.dados ? { ...r.dados, titulo: r.viaIA ? r.dados.titulo : titulo } : null);
        setViaIA(r.viaIA);
        if (!r.dados) setTexto('Ainda não há conteúdo suficiente para um mapa. Escreva mais algumas linhas.');
      } else if (f === 'flashcards') {
        const r = await gerarFlashcards(notas, apiKey);
        if (r.cartoes.length > 0) guardarFlashcards(r.cartoes);
        setCartoes(r.cartoes.length);
        setViaIA(r.viaIA);
        if (r.cartoes.length === 0) setTexto('Escreva frases mais completas para virar cartão.');
      } else {
        const r = await gerarTextoDoEstudio(f, textos, apiKey);
        setTexto(r.texto);
        setViaIA(r.viaIA);
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Cartao estilo={{ gap: 12 }}>
      <Texto variante="subtitulo">Studio</Texto>
      <View style={estilos.ferramentas}>
        {FERRAMENTAS.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => void gerar(x.id)}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityState={{ selected: ferramenta === x.id && viaIA !== null }}
            style={[estilos.ferramenta, ferramenta === x.id && viaIA !== null ? estilos.ferramentaAtiva : null]}
          >
            <Texto negrito cor={ferramenta === x.id && viaIA !== null ? cor.branco : cor.azul600}>
              {x.rotulo}
            </Texto>
          </Pressable>
        ))}
      </View>
      {carregando ? (
        <View style={estilos.carregando} accessibilityLiveRegion="polite">
          <ActivityIndicator color={cor.azul600} />
          <Texto negrito>Trabalhando nas suas anotações…</Texto>
        </View>
      ) : null}
      {viaIA === false && !carregando ? <Selo texto="Feito sem IA (sem conexão)" corFundo={cor.ambar100} corTexto={cor.ambar700} /> : null}
      {mapa && !carregando ? <MapaMental dados={mapa} /> : null}
      {texto && !carregando ? <TextoRico texto={texto} /> : null}
      {cartoes > 0 && !carregando ? (
        <View style={{ gap: 8 }}>
          <Texto negrito>{cartoes} cartões prontos no seu baralho.</Texto>
          <Botao titulo="Estudar os cartões" variante="sucesso" icone="albums" aoTocar={() => router.push('/flashcards')} />
        </View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  ferramentas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ferramenta: { minHeight: 44, paddingHorizontal: 14, borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.azul200, justifyContent: 'center' },
  ferramentaAtiva: { backgroundColor: cor.azul600, borderColor: cor.azul600 },
  carregando: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
});
