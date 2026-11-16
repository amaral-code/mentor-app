import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { userRepository } from '@mentor/api/UserRepository';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { marcarOnboardingLocal } from '@mentor/core/onboardingLocal';
import {
  apagarRascunho,
  carregarRascunho,
  erroDataProva,
  erroNascimento,
  PASSOS,
  podeAvancar,
  salvarRascunho,
  type RascunhoPrimeiroAcesso,
} from '@mentor/core/primeiroAcesso';
import { dataBrParaIso } from '@mentor/core/vinculoCodigo';
import { useAppStore } from '@mentor/state/appStore';
import { anunciar } from '../src/ui/acessibilidade';
import { Botao } from '../src/ui/Botao';
import { Campo } from '../src/ui/Basicos';
import { Cartao } from '../src/ui/Cartao';
import { imagemSagui, type PoseSagui } from '../src/ui/sagui';
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
const POSE: PoseSagui[] = ['pulando', 'aprovacao', 'estudando', 'estudando_caderno', 'meditando'];

function Chip({ texto, ativo, aoTocar, papel = 'checkbox' }: { texto: string; ativo: boolean; aoTocar: () => void; papel?: 'checkbox' | 'radio' }) {
  return (
    <Pressable onPress={aoTocar} accessibilityRole={papel} accessibilityState={{ checked: ativo }} style={[estilos.chip, ativo ? estilos.chipAtivo : null]}>
      <Texto negrito cor={ativo ? cor.ceu700 : cor.tinta700}>
        {texto}
      </Texto>
    </Pressable>
  );
}

/**
 * Primeiro acesso do aluno em cinco passos curtos (#33): boas-vindas,
 * metas, objetivo (curso, universidade, data da prova), rotina e data de
 * nascimento. Objetivo e nascimento são opcionais. O rascunho fica no
 * aparelho a cada passo: fechar o app no meio não obriga a recomeçar.
 */
export default function BoasVindas() {
  const uid = useAppStore((s) => s.session?.uid ?? '');
  const nome = useAppStore((s) => (s.session?.nome ?? '').split(/\s+/)[0] || 'estudante');
  const [r, setR] = useState<RascunhoPrimeiroAcesso>(() => carregarRascunho(uid));
  const [salvando, setSalvando] = useState(false);
  const passo = PASSOS[r.passo];

  useEffect(() => {
    if (uid) salvarRascunho(uid, r);
  }, [uid, r]);

  const mudar = (parcial: Partial<RascunhoPrimeiroAcesso>) => setR((atual) => ({ ...atual, ...parcial }));

  function avancar() {
    if (!podeAvancar(r)) return;
    if (r.passo < PASSOS.length - 1) {
      mudar({ passo: r.passo + 1 });
      anunciar(`Passo ${r.passo + 2} de ${PASSOS.length}`);
    } else void concluir();
  }

  async function concluir() {
    if (!r.tempo || !r.turno) return;
    setSalvando(true);
    const app = useAppStore.getState();
    try {
      const ok = await userRepository.concluirOnboarding({
        metas: r.metas,
        tempoDiario: r.tempo,
        turno: r.turno,
        dataNascimento: r.nascimento.trim() ? dataBrParaIso(r.nascimento) : null,
      });
      if (r.curso || r.universidade || r.dataProva) {
        void userRepository.salvarObjetivo({ curso: r.curso, universidade: r.universidade, dataProva: r.dataProva ? dataBrParaIso(r.dataProva) : null });
      }
      if (!ok) app.setToast('Preferências salvas neste aparelho. Sincronizamos quando a rede voltar.', 'info');
    } catch {
      app.setToast('Sem conexão agora. Suas escolhas ficaram neste aparelho.', 'info');
    } finally {
      // Libera de qualquer jeito: ninguém fica preso no primeiro acesso por causa de rede.
      app.concluirOnboardingLocal({ metas: r.metas, tempoDiario: r.tempo, turno: r.turno });
      marcarOnboardingLocal(uid);
      apagarRascunho(uid);
      // O tour das abas vem logo depois, na primeira entrada.
      useAppStore.setState({ showTutorial: true, tutorialStep: 0 });
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cor.branco }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.coluna}>
          <View style={estilos.progresso} accessible accessibilityRole="progressbar" accessibilityLabel={`Passo ${r.passo + 1} de ${PASSOS.length}`}>
            {PASSOS.map((p, i) => (
              <View key={p} style={[estilos.risco, { backgroundColor: i <= r.passo ? cor.ambar500 : cor.cinza100 }]} />
            ))}
          </View>
          <Image source={imagemSagui(POSE[r.passo])} style={estilos.sagui} accessible={false} />

          {passo === 'boasVindas' ? (
            <>
              <Texto variante="titulo" centro accessibilityRole="header">
                Oi, {nome}! Eu sou o Sagui.
              </Texto>
              <Texto centro>Em menos de dois minutos a gente monta o seu plano de estudos.</Texto>
            </>
          ) : null}

          {passo === 'metas' ? (
            <Cartao estilo={{ gap: 10 }}>
              <Texto variante="subtitulo" accessibilityRole="header">O que você quer conquistar?</Texto>
              <View style={estilos.chips}>
                {METAS.map((m) => (
                  <Chip key={m} texto={m} ativo={r.metas.includes(m)} aoTocar={() => mudar({ metas: r.metas.includes(m) ? r.metas.filter((x) => x !== m) : [...r.metas, m] })} />
                ))}
              </View>
            </Cartao>
          ) : null}

          {passo === 'objetivo' ? (
            <Cartao estilo={{ gap: 12 }}>
              <Texto variante="subtitulo" accessibilityRole="header">Para onde você vai?</Texto>
              <Texto variante="legenda">Opcional. Serve para a contagem até a prova e para o plano.</Texto>
              <Campo rotulo="Curso" value={r.curso} onChangeText={(t) => mudar({ curso: t })} placeholder="Ex.: Enfermagem" maxLength={80} />
              <Campo rotulo="Universidade" value={r.universidade} onChangeText={(t) => mudar({ universidade: t })} placeholder="Ex.: UFPE" maxLength={80} />
              <Campo
                rotulo="Data da prova"
                value={r.dataProva}
                onChangeText={(t) => mudar({ dataProva: t })}
                placeholder="08/11/2027"
                keyboardType="numbers-and-punctuation"
                erro={erroDataProva(r.dataProva) || undefined}
              />
            </Cartao>
          ) : null}

          {passo === 'rotina' ? (
            <Cartao estilo={{ gap: 10 }}>
              <Texto variante="subtitulo" accessibilityRole="header">Quanto tempo por dia?</Texto>
              <View style={estilos.chips}>
                {TEMPOS.map((t) => (
                  <Chip key={t} papel="radio" texto={t} ativo={r.tempo === t} aoTocar={() => mudar({ tempo: t })} />
                ))}
              </View>
              <Texto variante="subtitulo">Em que turno?</Texto>
              <View style={estilos.chips}>
                {TURNOS.map((t) => (
                  <Chip key={t.id} papel="radio" texto={t.rotulo} ativo={r.turno === t.id} aoTocar={() => mudar({ turno: t.id })} />
                ))}
              </View>
            </Cartao>
          ) : null}

          {passo === 'nascimento' ? (
            <Cartao estilo={{ gap: 8 }}>
              <Texto variante="subtitulo" accessibilityRole="header">Quando você nasceu?</Texto>
              <Campo
                rotulo="Data de nascimento (opcional)"
                value={r.nascimento}
                onChangeText={(t) => mudar({ nascimento: t })}
                placeholder="31/12/2008"
                keyboardType="numbers-and-punctuation"
                erro={erroNascimento(r.nascimento) || undefined}
              />
              <Texto variante="legenda">
                Serve para a regra dos 16 anos: abaixo disso, quem libera o acesso de um psicólogo aos seus dados é o seu
                responsável. Sem data, o app considera menor de 16.
              </Texto>
            </Cartao>
          ) : null}

          <Botao
            titulo={r.passo === PASSOS.length - 1 ? 'Começar' : r.passo === 0 ? 'Vamos lá' : 'Continuar'}
            variante="ambar"
            aoTocar={avancar}
            desabilitado={!podeAvancar(r)}
            carregando={salvando}
          />
          {r.passo > 0 ? <Botao titulo="Voltar" variante="fantasma" aoTocar={() => mudar({ passo: r.passo - 1 })} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 20, paddingTop: 48, backgroundColor: cor.branco, flexGrow: 1 },
  coluna: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  progresso: { flexDirection: 'row', gap: 6 },
  risco: { flex: 1, height: 6, borderRadius: 3 },
  sagui: { width: 110, height: 110, alignSelf: 'center', resizeMode: 'contain' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.cinza200, backgroundColor: cor.branco },
  chipAtivo: { borderColor: cor.ceu500, backgroundColor: cor.ceu50 },
});
