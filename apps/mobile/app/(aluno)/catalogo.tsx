import { useState } from 'react';
import { Text, View } from 'react-native';
import { AA_NORMAL, contraste } from '@mentor/ui-tokens/contraste';
import { paletas as p, branco } from '@mentor/ui-tokens/tokens';
import { Barra, Campo, Esqueleto, Selo, Vazio } from '../../src/ui/Basicos';
import { Botao, type VarianteBotao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { Cabecalho, Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { FAIXA, type CorFaixa } from '../../src/ui/tema';

const VARIANTES: VarianteBotao[] = ['primario', 'secundario', 'ambar', 'sucesso', 'ceu', 'perigo', 'fantasma'];
const FAIXAS: CorFaixa[] = ['azul', 'ceu', 'ambar', 'esmeralda', 'violeta'];

function Razao({ texto, fundo }: { texto: string; fundo: string }) {
  const r = contraste(texto, fundo);
  return (
    <Text className={r >= AA_NORMAL ? 'text-esmeralda-700 text-xs font-bold' : 'text-vermelho-700 text-xs font-bold'}>
      {r.toFixed(1)}:1 {r >= AA_NORMAL ? 'AA' : 'abaixo do AA'}
    </Text>
  );
}

/**
 * Catálogo dos componentes base (#30), para a equipe conferir no
 * Android, no iOS e no navegador lado a lado. Fica fora do menu do
 * aluno: só aparece em Mais nas builds de desenvolvimento.
 *
 * Os blocos com `className` são NativeWind: o mesmo Tailwind do web,
 * com as cores de @mentor/ui-tokens.
 */
export default function Catalogo() {
  const [texto, setTexto] = useState('');
  return (
    <Tela cabecalho={{ titulo: 'Catálogo', subtitulo: 'Componentes base do app', cor: 'azul', pose: 'aprovacao', voltar: true }}>
      <Cartao estilo={{ gap: 6 }}>
        <Texto variante="titulo">Título</Texto>
        <Texto variante="subtitulo">Subtítulo</Texto>
        <Texto>Corpo de texto, que acompanha o tamanho de fonte do sistema.</Texto>
        <Texto variante="legenda">Legenda</Texto>
        <Texto variante="rotulo">Rótulo</Texto>
        <Texto variante="numero">1.234</Texto>
      </Cartao>

      <Cartao estilo={{ gap: 10 }}>
        <Texto variante="subtitulo">Botões</Texto>
        {VARIANTES.map((v) => (
          <Botao key={v} titulo={v} variante={v} aoTocar={() => {}} />
        ))}
        <Botao titulo="desabilitado" desabilitado aoTocar={() => {}} />
        <Botao titulo="carregando" carregando aoTocar={() => {}} />
        <Botao titulo="compacto" compacto icone="star" aoTocar={() => {}} />
      </Cartao>

      <Cartao estilo={{ gap: 10 }}>
        <Texto variante="subtitulo">Campos, barras e selos</Texto>
        <Campo rotulo="Campo" value={texto} onChangeText={setTexto} placeholder="Digite algo" />
        <Campo rotulo="Campo com erro" value="" onChangeText={() => {}} erro="Mensagem de erro do campo." />
        <Barra valor={65} rotulo="Exemplo" />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Selo texto="Selo padrão" />
          <Selo texto="Âmbar" corFundo={p.ambar[100]} corTexto={p.ambar[700]} />
        </View>
        <Esqueleto altura={20} />
      </Cartao>

      <Texto variante="subtitulo">Faixas de cabeçalho</Texto>
      {FAIXAS.map((f) => (
        <View key={f} style={{ gap: 4 }}>
          <Cabecalho titulo={`Faixa ${f}`} subtitulo="Subtítulo em texto normal" cor={f} pose="acenando" />
          <Razao texto={branco} fundo={FAIXA[f].fundo} />
        </View>
      ))}

      <View className="rounded-adesivo border-2 border-cinza-200 bg-superficie p-4 gap-2">
        <Text className="text-tinta-900 text-lg font-extrabold">NativeWind</Text>
        <Text className="text-tinta-500">Este cartão é só className, com os tokens do web.</Text>
        <View className="flex-row gap-2">
          <View className="h-8 w-8 rounded-full bg-azul-600" />
          <View className="h-8 w-8 rounded-full bg-ceu-500" />
          <View className="h-8 w-8 rounded-full bg-ambar-500" />
          <View className="h-8 w-8 rounded-full bg-esmeralda-500" />
          <View className="h-8 w-8 rounded-full bg-violeta-600" />
        </View>
      </View>

      <Vazio titulo="Estado vazio" texto="Quando não há o que mostrar." />
    </Tela>
  );
}
