import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { useAppStore, persistir } from '@mentor/state/appStore';
import { Estudio } from '../../../src/features/caderno/Estudio';
import { Campo, Vazio } from '../../../src/ui/Basicos';
import { Botao } from '../../../src/ui/Botao';
import { Cartao } from '../../../src/ui/Cartao';
import { Tela } from '../../../src/ui/Tela';
import { Texto } from '../../../src/ui/Texto';

/**
 * Uma anotação: ler, editar, apagar e o Studio só sobre ela ("gerar
 * flashcards a partir da nota", #44). Gravação otimista com volta
 * atrás se o banco recusar, como no web.
 */
export default function NotaDoCaderno() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nota = useAppStore((s) => s.notas.find((n) => n.id === id));
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota?.text ?? '');
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  if (!nota) {
    return (
      <Tela cabecalho={{ titulo: 'Anotação', cor: 'azul', pose: 'estudando_caderno', voltar: true }}>
        <Vazio titulo="Esta anotação não está mais aqui." acao={<Botao titulo="Voltar ao caderno" aoTocar={() => router.replace('/caderno')} />} />
      </Tela>
    );
  }

  function salvar() {
    if (!nota || !texto.trim()) return;
    const { notas, setNotas } = useAppStore.getState();
    const anterior = notas;
    setNotas(notas.map((n) => (n.id === nota.id ? { ...n, text: texto.trim() } : n)));
    persistir(supabaseRepository.updateNota(nota.id, texto.trim()), {
      aoFalhar: () => setNotas(anterior),
      mensagem: 'Não foi possível salvar a edição. O texto anterior foi mantido.',
    });
    setEditando(false);
  }

  function apagar() {
    if (!nota) return;
    if (!confirmarApagar) return setConfirmarApagar(true);
    const { notas, setNotas } = useAppStore.getState();
    const anterior = notas;
    setNotas(notas.filter((n) => n.id !== nota.id));
    persistir(supabaseRepository.deleteNota(nota.id), {
      aoFalhar: () => setNotas(anterior),
      mensagem: 'Não foi possível apagar a anotação. Ela continua no seu caderno.',
    });
    router.back();
  }

  return (
    <Tela cabecalho={{ titulo: 'Anotação', subtitulo: nota.tag ? `Etiqueta: ${nota.tag}` : undefined, cor: 'azul', pose: 'estudando_caderno', voltar: true }}>
      <Cartao estilo={{ gap: 10 }}>
        {editando ? (
          <>
            <Campo rotulo="Texto da anotação" value={texto} onChangeText={setTexto} multiline style={{ minHeight: 180 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao titulo="Salvar" aoTocar={salvar} estilo={{ flex: 1 }} />
              <Botao titulo="Cancelar" variante="secundario" aoTocar={() => { setTexto(nota.text); setEditando(false); }} estilo={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <>
            <Texto selectable>{nota.text}</Texto>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao titulo="Editar" variante="secundario" icone="create-outline" compacto aoTocar={() => setEditando(true)} estilo={{ flex: 1 }} />
              <Botao titulo={confirmarApagar ? 'Toque de novo' : 'Apagar'} variante={confirmarApagar ? 'perigo' : 'fantasma'} icone="trash-outline" compacto aoTocar={apagar} estilo={{ flex: 1 }} />
            </View>
          </>
        )}
      </Cartao>
      <Estudio notas={[nota]} titulo={nota.text.split(/\s+/).slice(0, 4).join(' ')} />
    </Tela>
  );
}
