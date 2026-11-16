/* pose_15 acena de verdade (o arquivo "acenando" mostra o sagui meditando)
   e pose_17 comemora com a bandeira: as duas entraram para a floresta. */
export type PoseSagui = 'acenando' | 'aprovacao' | 'estudando' | 'estudando_caderno' | 'meditando' | 'pulando' | 'pose_15' | 'pose_17';

/* require estático: o Metro só empacota imagem citada assim, por extenso.
   Poses reduzidas para 256px (as de 512px do web pesavam 280 KB cada). */
const POSES: Record<PoseSagui, number> = {
  acenando: require('../../assets/sagui/acenando.png'),
  aprovacao: require('../../assets/sagui/aprovacao.png'),
  estudando: require('../../assets/sagui/estudando.png'),
  estudando_caderno: require('../../assets/sagui/estudando_caderno.png'),
  meditando: require('../../assets/sagui/meditando.png'),
  pulando: require('../../assets/sagui/pulando.png'),
  pose_15: require('../../assets/sagui/pose_15.png'),
  pose_17: require('../../assets/sagui/pose_17.png'),
};

export function imagemSagui(pose: PoseSagui): number {
  return POSES[pose];
}
