import { Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MODOS_DALTONISMO, coresDeSinal } from '@mentor/core/acessibilidadeCores';
import { Botao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { cor, raio, ALVO_TOQUE } from '../../src/ui/tema';
import { useAcessibilidadeStore, useAltoContraste } from '../../src/ui/preferenciasAcessibilidade';

/**
 * Preferências de acessibilidade.
 *
 * Só o que o sistema NÃO resolve fica aqui: alto contraste (também segue
 * o do sistema) e as cores de acerto e erro para daltonismo. Tamanho da
 * letra e movimento reduzido vêm do sistema, e o app já obedece; duplicar
 * a chave no app criaria dois lugares que discordam.
 */
export default function Acessibilidade() {
  const doSistema = useAcessibilidadeStore((s) => s.contrasteDoSistema);
  const daltonismo = useAcessibilidadeStore((s) => s.daltonismo);
  const mudar = useAcessibilidadeStore((s) => s.mudar);
  const alto = useAltoContraste();
  const amostra = coresDeSinal(daltonismo);
  // O web guarda as variantes "anomaly"; aqui elas caem na opção da mesma família.
  const familia = daltonismo.replace('anomaly', 'anopia').replace('achromatomaly', 'achromatopsia');

  return (
    <Tela cabecalho={{ titulo: 'Acessibilidade', subtitulo: 'Contraste e cores do jeito que você enxerga melhor', cor: 'azul', pose: 'aprovacao', voltar: true }}>
      <Cartao estilo={{ gap: 10 }}>
        <View style={estilos.linha}>
          <View style={{ flex: 1 }}>
            <Texto variante="subtitulo">Alto contraste</Texto>
            <Texto variante="legenda">Texto mais escuro e bordas mais fortes. Ajuda no sol e com a vista cansada.</Texto>
          </View>
          <Switch
            value={alto}
            onValueChange={(v) => mudar({ altoContraste: v })}
            disabled={doSistema}
            accessibilityLabel="Alto contraste"
            trackColor={{ true: cor.azul600, false: cor.cinza300 }}
            thumbColor={cor.branco}
          />
        </View>
        {doSistema ? (
          <Texto variante="legenda" cor={cor.azul600}>
            Ligado pelo sistema do celular. Para desligar, mude nos ajustes do aparelho.
          </Texto>
        ) : null}
      </Cartao>

      <Cartao estilo={{ gap: 10 }}>
        <Texto variante="subtitulo" accessibilityRole="header">
          Cores de acerto e erro
        </Texto>
        <Texto variante="legenda">O ícone de certo e de xis aparece sempre junto. A cor nunca é o único sinal.</Texto>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {MODOS_DALTONISMO.map((m) => {
            const ativo = familia === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => mudar({ daltonismo: m.id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: ativo }}
                accessibilityLabel={`${m.rotulo}. ${m.texto}`}
                style={[estilos.opcao, ativo ? { borderColor: cor.ceu600, backgroundColor: cor.ceu50 } : null]}
              >
                <Ionicons name={ativo ? 'radio-button-on' : 'radio-button-off'} size={22} color={ativo ? cor.ceu600 : cor.cinza400} />
                <View style={{ flex: 1 }}>
                  <Texto negrito>{m.rotulo}</Texto>
                  <Texto variante="legenda">{m.texto}</Texto>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={estilos.amostras} accessible accessibilityLabel="Amostra das cores escolhidas: acerto e erro">
          <View style={[estilos.amostra, { backgroundColor: amostra.acertoFundo, borderColor: amostra.acerto }]}>
            <Ionicons name="checkmark-circle" size={20} color={amostra.acerto} />
            <Texto negrito cor={amostra.acerto}>Mandou bem!</Texto>
          </View>
          <View style={[estilos.amostra, { backgroundColor: amostra.erroFundo, borderColor: amostra.erro }]}>
            <Ionicons name="close-circle" size={20} color={amostra.erro} />
            <Texto negrito cor={amostra.erro}>Quase lá!</Texto>
          </View>
        </View>
      </Cartao>

      <Cartao estilo={{ gap: 8 }}>
        <Texto variante="subtitulo">Letra e movimento</Texto>
        <Texto variante="legenda">
          O tamanho da letra e a opção de reduzir animações vêm dos ajustes do celular. O app segue os dois, inclusive o leitor de tela
          {Platform.OS === 'ios' ? ' (VoiceOver)' : Platform.OS === 'android' ? ' (TalkBack)' : ''}.
        </Texto>
        {Platform.OS !== 'web' ? (
          <Botao titulo="Abrir ajustes do celular" variante="secundario" icone="settings-outline" aoTocar={() => void Linking.openSettings()} />
        ) : null}
      </Cartao>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: ALVO_TOQUE,
    padding: 12,
    borderRadius: raio.md,
    borderWidth: 2,
    borderColor: cor.cinza200,
  },
  amostras: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amostra: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: raio.md, borderWidth: 2 },
});
