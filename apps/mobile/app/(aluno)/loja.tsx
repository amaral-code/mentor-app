import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHOP_ITEMS } from '@mentor/core/storeCatalog';
import { RECOMPENSAS } from '@mentor/core/focusShield';
import { formatarXp } from '@mentor/core/marcosXp';
import { useAppStore } from '@mentor/state/appStore';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { useStoreStore } from '@mentor/state/storeStore';
import { vibrar } from '../../src/ui/acessibilidade';
import { Selo } from '../../src/ui/Basicos';
import { Botao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { SaguiAnimado } from '../../src/ui/SaguiAnimado';
import { Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { cor } from '../../src/ui/tema';

type NomeIcone = keyof typeof Ionicons.glyphMap;
const ICONE_ITEM: Record<string, NomeIcone> = { moletom: 'shirt', oculos: 'glasses', fone: 'headset' };
const ICONE_RECOMPENSA: Record<string, NomeIcone> = { moon: 'moon', shield: 'shield', headphones: 'headset', sun: 'sunny', zap: 'flash' };

/**
 * Loja do Sagui.
 *
 * Duas moedas, como no web: acessórios custam XP (RPC comprar_item, 005)
 * e recompensas de descanso custam moedas de foco (gastar_moedas_foco).
 * Em nenhuma o aparelho decide preço ou saldo: o servidor confere e
 * devolve o saldo que vale.
 */
export default function Loja() {
  const xp = useAppStore((s) => s.gamification.xp);
  const inventario = useStoreStore((s) => s.inventory);
  const moedas = useBemEstarStore((s) => s.carteira.saldo);
  const [operando, setOperando] = useState<string | null>(null);

  useEffect(() => {
    void useStoreStore.getState().carregar();
  }, []);

  const equipado = SHOP_ITEMS.find((i) => inventario[i.id]?.equipped);

  async function comprar(id: string) {
    if (operando) return; // trava o duplo toque enquanto o servidor responde
    setOperando(id);
    try {
      if (await useStoreStore.getState().buyItem(id)) void vibrar('acerto');
    } finally {
      setOperando(null);
    }
  }

  async function equipar(id: string, nome: string) {
    if (operando) return;
    setOperando(id);
    try {
      await useStoreStore.getState().equipItem(id);
      useAppStore.getState().setToast(`${nome} equipado no Sagui!`, 'success');
    } finally {
      setOperando(null);
    }
  }

  async function resgatar(id: string, nome: string, custo: number) {
    if (operando) return;
    setOperando(id);
    try {
      if (await useBemEstarStore.getState().gastarMoedas(custo, `Recompensa: ${nome}`)) {
        void vibrar('acerto');
        useAppStore.getState().setToast(`${nome} resgatado!`, 'success');
      }
    } finally {
      setOperando(null);
    }
  }

  return (
    <Tela cabecalho={{ titulo: 'Loja do Sagui', subtitulo: 'Personalize o seu companheiro de estudos', cor: 'violeta', pose: 'pulando', voltar: true }}>
      <Cartao estilo={estilos.vitrine}>
        <SaguiAnimado pose={equipado ? 'aprovacao' : 'acenando'} tamanho={120} />
        <View style={{ flex: 1, gap: 6 }}>
          <Selo texto={`${formatarXp(xp)} XP`} corFundo={cor.ambar100} corTexto={cor.ambar700} />
          <Selo texto={`${moedas} moedas de foco`} corFundo={cor.esmeralda50} corTexto={cor.esmeralda700} />
          <Texto variante="legenda">{equipado ? `Usando: ${equipado.name}` : 'Nenhum acessório equipado'}</Texto>
        </View>
      </Cartao>

      <Texto variante="rotulo">Acessórios (XP)</Texto>
      {SHOP_ITEMS.map((item) => {
        const comprado = !!inventario[item.id]?.purchased;
        const emUso = !!inventario[item.id]?.equipped;
        const podePagar = xp >= item.price;
        return (
          <Cartao key={item.id} estilo={estilos.item} destaque={emUso ? cor.violeta600 : undefined}>
            <View style={estilos.icone}>
              <Ionicons name={ICONE_ITEM[item.icon] ?? 'gift'} size={26} color={cor.violeta600} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto negrito>{item.name}</Texto>
              <Texto variante="legenda">{item.desc}</Texto>
              {!comprado ? (
                <Texto variante="legenda" negrito cor={podePagar ? cor.ambar700 : cor.cinza400}>
                  {formatarXp(item.price)} XP
                </Texto>
              ) : null}
            </View>
            {comprado ? (
              <Botao titulo={emUso ? 'Em uso' : 'Equipar'} compacto variante={emUso ? 'fantasma' : 'ceu'} desabilitado={emUso} carregando={operando === item.id} aoTocar={() => void equipar(item.id, item.name)} />
            ) : (
              <Botao
                titulo={podePagar ? 'Comprar' : 'Falta XP'}
                compacto
                variante="ambar"
                desabilitado={!podePagar}
                carregando={operando === item.id}
                aoTocar={() => void comprar(item.id)}
                rotuloAcessivel={`Comprar ${item.name} por ${item.price} XP`}
              />
            )}
          </Cartao>
        );
      })}

      <Texto variante="rotulo">Recompensas de descanso (moedas de foco)</Texto>
      <Texto variante="legenda">Moedas vêm do tempo longe da tela no Modo Foco. Prêmio de quem descansou não é mais conteúdo: é descanso.</Texto>
      {RECOMPENSAS.map((r) => (
        <Cartao key={r.id} estilo={estilos.item}>
          <View style={[estilos.icone, { backgroundColor: cor.esmeralda50 }]}>
            <Ionicons name={ICONE_RECOMPENSA[r.icone] ?? 'gift'} size={24} color={cor.esmeralda600} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto negrito>{r.nome}</Texto>
            <Texto variante="legenda">{r.descricao}</Texto>
          </View>
          <Botao
            titulo={`${r.custo}`}
            icone="leaf"
            compacto
            variante="sucesso"
            desabilitado={moedas < r.custo}
            carregando={operando === r.id}
            aoTocar={() => void resgatar(r.id, r.nome, r.custo)}
            rotuloAcessivel={`Resgatar ${r.nome} por ${r.custo} moedas`}
          />
        </Cartao>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  vitrine: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
});
