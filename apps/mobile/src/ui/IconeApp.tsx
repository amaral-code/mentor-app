import { Ionicons } from '@expo/vector-icons';

type NomeIonicons = keyof typeof Ionicons.glyphMap;

/*
 * Os nomes que o core grava (plano do dia, personas) são os do `AppIcon`
 * do web, que usa lucide. Aqui cada um vira o equivalente do Ionicons,
 * que já vem com o Expo e não precisa de SVG por ícone.
 */
const MAPA: Record<string, NomeIonicons> = {
  alvo: 'locate',
  brilho: 'sparkles',
  cafe: 'cafe',
  cronometro: 'stopwatch',
  escrita: 'create',
  foguete: 'rocket',
  gota: 'water',
  lista: 'list',
  livro: 'book',
  marcador: 'bookmark',
  medalha: 'medal',
  mente: 'bulb',
  musica: 'musical-notes',
  passos: 'footsteps',
  raio: 'flash',
  respiracao: 'leaf',
  sono: 'moon',
  trofeu: 'trophy',
  video: 'videocam',
  luaCheia: 'moon',
  regua: 'calculator',
  ciencia: 'flask',
  globo: 'globe',
};

export function IconeApp({ nome, tamanho = 24, cor }: { nome: string; tamanho?: number; cor: string }) {
  return <Ionicons name={MAPA[nome] ?? 'ellipse'} size={tamanho} color={cor} />;
}
