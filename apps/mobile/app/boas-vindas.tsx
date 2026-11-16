import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { userRepository } from '@mentor/api/UserRepository';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { marcarOnboardingLocal } from '@mentor/core/onboardingLocal';
import { safeSet } from '@mentor/core/safeStorage';
import { dataBrParaIso, validarDataNascimento } from '@mentor/core/vinculoCodigo';
import { useAppStore } from '@mentor/state/appStore';
import { Botao } from '../src/ui/Botao';
import { Campo } from '../src/ui/Basicos';
import { Cartao } from '../src/ui/Cartao';
import { imagemSagui } from '../src/ui/sagui';
import { Texto } from '../src/ui/Texto';
import { cor, raio } from '../src/ui/tema';

/* Mesmas opções do OnboardingFlow do web: o banco guarda o texto. */
const METAS = ['Passar no ENEM', 'Não reprovar de ano', 'Aprender Programação', 'Passar em concurso', 'Melhorar as notas', 'Criar rotina de estudos'];
const TEMPOS = ['15 min', '30 min', '1 hora', 'Mais de 2 horas'];
const TURNOS = [
  { id: 'manha', rotulo: 'Manhã' },
  { id: 'tarde', rotulo: 'Tarde' },
  { id: 'noite', rotulo: 'Noite' },
];

function Chip({ texto, ativo, aoTocar }: { texto: string; ativo: boolean; aoTocar: () => void }) {
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ativo }}
      style={[estilos.chip, ativo ? estilos.chipAtivo : null]}
    >
      <Texto negrito cor={ativo ? cor.ceu700 : cor.tinta700}>
        {texto}
      </Texto>
    </Pressable>
  );
}

/**
 * Primeiro acesso do aluno numa tela só: metas, tempo, turno e data de
 * nascimento. O fluxo completo, com tour guiado, é a issue #33 (M2); esta
 * versão existe para que o aluno novo não fique sem caminho no celular.
 */
export default function BoasVindas() {
  const nome = useAppStore((s) => (s.session?.nome ?? '').split(/\s+/)[0] || 'estudante');
  const [metas, setMetas] = useState<string[]>([]);
  const [tempo, setTempo] = useState<string | null>(null);
  const [turno, setTurno] = useState<string | null>(null);
  const [nascimento, setNascimento] = useState('');
  const [salvando, setSalvando] = useState(false);

  /* Em branco passa (a pergunta é obrigatória de fazer, não de
     responder: sem data o app trata como menor de 16). Preenchida e
     inválida trava, porque gravar ano errado é pior que não ter. */
  const iso = nascimento.trim() ? dataBrParaIso(nascimento) : null;
  const validacao = iso ? validarDataNascimento(iso) : null;
  const erroData = nascimento.trim()
    ? !iso
      ? 'Use dia, mês e ano: 31/12/2008.'
      : validacao && !validacao.ok
        ? validacao.erro
        : ''
    : '';
  const pronto = metas.length > 0 && !!tempo && !!turno && !erroData;

  async function concluir() {
    if (!pronto || !tempo || !turno) return;
    setSalvando(true);
    const uid = useAppStore.getState().session?.uid ?? '';
    try {
      const ok = await userRepository.concluirOnboarding({ metas, tempoDiario: tempo, turno, dataNascimento: iso });
      if (!ok) useAppStore.getState().setToast('Preferências salvas neste aparelho. Sincronizamos quando a rede voltar.', 'info');
      supabaseRepository.savePreferencias({ tutorial_completo: true }).catch(() => {});
    } catch {
      useAppStore.getState().setToast('Sem conexão agora. Suas escolhas ficaram neste aparelho.', 'info');
    } finally {
      // Libera de qualquer jeito: ninguém fica preso no primeiro acesso por causa de rede.
      useAppStore.getState().concluirOnboardingLocal({ metas, tempoDiario: tempo, turno });
      marcarOnboardingLocal(uid);
      safeSet('mm_tour_visto', '1');
      setSalvando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <View style={estilos.coluna}>
        <Image source={imagemSagui('pulando')} style={estilos.sagui} accessible={false} />
        <Texto variante="titulo" centro accessibilityRole="header">
          Oi, {nome}! Vamos montar seu plano.
        </Texto>

        <Cartao estilo={{ gap: 10 }}>
          <Texto variante="subtitulo">O que você quer conquistar?</Texto>
          <View style={estilos.chips}>
            {METAS.map((m) => (
              <Chip key={m} texto={m} ativo={metas.includes(m)} aoTocar={() => setMetas((a) => (a.includes(m) ? a.filter((x) => x !== m) : [...a, m]))} />
            ))}
          </View>
        </Cartao>

        <Cartao estilo={{ gap: 10 }}>
          <Texto variante="subtitulo">Quanto tempo por dia?</Texto>
          <View style={estilos.chips}>
            {TEMPOS.map((t) => (
              <Chip key={t} texto={t} ativo={tempo === t} aoTocar={() => setTempo(t)} />
            ))}
          </View>
          <Texto variante="subtitulo">Em que turno?</Texto>
          <View style={estilos.chips}>
            {TURNOS.map((t) => (
              <Chip key={t.id} texto={t.rotulo} ativo={turno === t.id} aoTocar={() => setTurno(t.id)} />
            ))}
          </View>
        </Cartao>

        <Cartao estilo={{ gap: 8 }}>
          <Campo
            rotulo="Data de nascimento (opcional)"
            value={nascimento}
            onChangeText={setNascimento}
            placeholder="31/12/2008"
            keyboardType="numbers-and-punctuation"
            erro={erroData || undefined}
          />
          <Texto variante="legenda">
            Serve para a regra dos 16 anos: abaixo disso, quem libera o acesso de um psicólogo aos seus dados é o seu
            responsável. Sem data, o app considera menor de 16.
          </Texto>
        </Cartao>

        <Botao titulo="Começar" variante="ambar" aoTocar={() => void concluir()} desabilitado={!pronto} carregando={salvando} />
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 20, paddingTop: 48, backgroundColor: cor.branco },
  coluna: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  sagui: { width: 110, height: 110, alignSelf: 'center', resizeMode: 'contain' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.cinza200,
    backgroundColor: cor.branco,
  },
  chipAtivo: { borderColor: cor.ceu500, backgroundColor: cor.ceu50 },
});
