import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Nota } from '@mentor/core/types';
import { useAppStore } from '@mentor/state/appStore';
import { Estudio } from '../../../src/features/caderno/Estudio';
import { Campo, Selo, Vazio } from '../../../src/ui/Basicos';
import { Botao } from '../../../src/ui/Botao';
import { Cartao } from '../../../src/ui/Cartao';
import { Tela } from '../../../src/ui/Tela';
import { Texto } from '../../../src/ui/Texto';
import { cor } from '../../../src/ui/tema';

const COR_TAG: Record<string, string> = {
  chat: cor.ceu600,
  erro: cor.vermelho600,
  resumo: cor.esmeralda600,
  revisao: cor.violeta600,
  redacao: cor.ambar600,
};

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Caderno de estudos: escrever, ver e abrir as anotações, e o Studio
 * sobre o caderno inteiro. Cada nota abre sozinha para editar e virar
 * resumo, mapa mental ou cartões.
 */
export default function Caderno() {
  const notas = useAppStore((s) => s.notas);
  const [texto, setTexto] = useState('');
  const [tag, setTag] = useState('');
  const [estudioAberto, setEstudioAberto] = useState(false);

  function adicionar() {
    if (!texto.trim()) return;
    const nota: Nota = { id: `tmp_${Date.now()}`, text: texto.trim(), data: new Date().toISOString(), tag: tag.trim() || undefined };
    // O store grava no banco e troca o id provisório pelo definitivo.
    useAppStore.getState().addNota(nota);
    setTexto('');
    setTag('');
  }

  const ordenadas = [...notas].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <Tela
      cabecalho={{
        titulo: 'Caderno',
        subtitulo: `${notas.length} ${notas.length === 1 ? 'anotação' : 'anotações'}`,
        cor: 'azul',
        pose: 'estudando_caderno',
        voltar: true,
        acao: notas.length > 0 ? <Botao titulo={estudioAberto ? 'Fechar Studio' : 'Studio'} compacto variante="secundario" icone="sparkles" aoTocar={() => setEstudioAberto((v) => !v)} /> : undefined,
      }}
    >
      <Cartao estilo={{ gap: 10 }}>
        <Campo rotulo="Nova anotação" value={texto} onChangeText={setTexto} multiline placeholder="O que você aprendeu agora?" />
        <Campo rotulo="Etiqueta (opcional)" value={tag} onChangeText={setTag} placeholder="resumo, erro, revisao" autoCapitalize="none" />
        <Botao titulo="Salvar anotação" icone="add" aoTocar={adicionar} desabilitado={!texto.trim()} />
      </Cartao>

      {estudioAberto ? <Estudio notas={notas} titulo="Meu caderno" /> : null}

      {ordenadas.length === 0 ? (
        <Vazio titulo="Caderno vazio." texto="Anote o que aprendeu no quiz ou no Mentor. Daqui saem resumo, mapa mental e flashcards." pose="estudando_caderno" />
      ) : (
        ordenadas.map((n) => (
          <Cartao key={n.id} aoTocar={() => router.push({ pathname: '/caderno/[id]', params: { id: n.id } })} rotuloAcessivel={`Abrir anotação: ${n.text.slice(0, 80)}`} estilo={[estilos.nota, { borderLeftColor: COR_TAG[n.tag ?? ''] ?? cor.cinza200 }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Texto numberOfLines={3}>{n.text}</Texto>
              <View style={estilos.rodape}>
                <Texto variante="legenda">{dataCurta(n.data)}</Texto>
                {n.tag ? <Selo texto={n.tag} /> : null}
              </View>
            </View>
            <Pressable hitSlop={8} accessibilityElementsHidden importantForAccessibility="no">
              <Ionicons name="chevron-forward" size={20} color={cor.cinza400} />
            </Pressable>
          </Cartao>
        ))
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  nota: { flexDirection: 'row', alignItems: 'center', gap: 8, borderLeftWidth: 6 },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
