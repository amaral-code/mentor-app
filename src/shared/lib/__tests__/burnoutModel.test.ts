import { describe, expect, it } from 'vitest';
import {
  avaliar,
  classificar,
  deveBloquearConteudoDenso,
  extrairFeatures,
  inclinacao,
  preverBurnout,
  sigmoide,
  treinarLogistica,
  type AmostraTreino,
  type VetorFeatures,
} from '../burnoutModel';
import type { EventoTelemetria } from '../../types';

const HORA = 3600_000;

function evento(parcial: Partial<EventoTelemetria>): EventoTelemetria {
  return {
    questionId: 'q1',
    materia: 'Biologia',
    dificuldade: 'media',
    tempoGastoSegundos: 100,
    acertou: true,
    horaLocal: 20,
    timestamp: Date.now(),
    ...parcial,
  };
}

const SAUDAVEL: VetorFeatures = {
  taxaErro: 0.2,
  excessoTempoFacil: 0.9,
  quedaRendimento: -0.05,
  fracaoMadrugada: 0,
  horasEstudoDia: 1.2,
  diasSemPausa: 2,
  deficitSono: 0,
};

const ESGOTADO: VetorFeatures = {
  taxaErro: 0.8,
  excessoTempoFacil: 2.6,
  quedaRendimento: 0.5,
  fracaoMadrugada: 0.6,
  horasEstudoDia: 4,
  diasSemPausa: 12,
  deficitSono: 3.5,
};

describe('sigmoide', () => {
  it('e estavel nos extremos', () => {
    expect(sigmoide(0)).toBe(0.5);
    expect(sigmoide(-1000)).toBe(0);
    expect(sigmoide(1000)).toBe(1);
    expect(Number.isNaN(sigmoide(-800))).toBe(false);
  });
});

describe('preverBurnout', () => {
  it('separa perfil saudavel de perfil esgotado', () => {
    const bom = preverBurnout(SAUDAVEL);
    const ruim = preverBurnout(ESGOTADO);

    expect(bom.score).toBeLessThan(ruim.score);
    expect(bom.classe).toBe('saudavel');
    expect(ruim.classe).toBe('esgotamento');
  });

  it('explica o resultado com os dois maiores contribuintes', () => {
    const r = preverBurnout(ESGOTADO);
    expect(r.motivos.length).toBeGreaterThan(0);
    expect(r.motivos.length).toBeLessThanOrEqual(2);
    // A maior contribuicao aparece primeiro na lista detalhada.
    expect(Math.abs(r.contribuicoes[0].contribuicao)).toBeGreaterThanOrEqual(
      Math.abs(r.contribuicoes[1].contribuicao),
    );
  });

  it('classifica pelas faixas documentadas', () => {
    expect(classificar(10)).toBe('saudavel');
    expect(classificar(40)).toBe('alerta');
    expect(classificar(65)).toBe('fadiga');
    expect(classificar(85)).toBe('esgotamento');
  });

  it('bloqueia conteudo denso so a partir de fadiga', () => {
    expect(deveBloquearConteudoDenso('alerta')).toBe(false);
    expect(deveBloquearConteudoDenso('fadiga')).toBe(true);
    expect(deveBloquearConteudoDenso('esgotamento')).toBe(true);
  });
});

describe('extrairFeatures', () => {
  it('devolve vetor neutro sem eventos', () => {
    const f = extrairFeatures([], { horasSono: 8 });
    expect(f.taxaErro).toBe(0);
    expect(f.excessoTempoFacil).toBe(1);
    expect(f.deficitSono).toBe(0);
    expect(f.diasSemPausa).toBe(0);
  });

  it('calcula taxa de erro e fracao de madrugada', () => {
    const f = extrairFeatures([
      evento({ acertou: false, horaLocal: 2 }),
      evento({ acertou: false, horaLocal: 3 }),
      evento({ acertou: true, horaLocal: 19 }),
      evento({ acertou: true, horaLocal: 20 }),
    ]);
    expect(f.taxaErro).toBe(0.5);
    expect(f.fracaoMadrugada).toBe(0.5);
  });

  it('detecta tempo excessivo em questao facil', () => {
    const f = extrairFeatures([
      evento({ dificuldade: 'facil', tempoGastoSegundos: 180 }),
      evento({ dificuldade: 'facil', tempoGastoSegundos: 180 }),
    ]);
    // 180 s contra 60 s esperados = 3x (teto do indicador)
    expect(f.excessoTempoFacil).toBe(3);
  });

  it('ignora eventos fora da janela', () => {
    const antigo = Date.now() - 30 * 24 * HORA;
    const f = extrairFeatures([evento({ acertou: false, timestamp: antigo }), evento({ acertou: true })], {}, 7);
    expect(f.taxaErro).toBe(0);
  });

  it('marca queda de rendimento quando a acuracia cai dia a dia', () => {
    const dia = 24 * HORA;
    const agora = Date.now();
    const eventos = [
      evento({ timestamp: agora - 3 * dia, acertou: true }),
      evento({ timestamp: agora - 3 * dia, acertou: true }),
      evento({ timestamp: agora - 2 * dia, acertou: true }),
      evento({ timestamp: agora - 2 * dia, acertou: false }),
      evento({ timestamp: agora - dia, acertou: false }),
      evento({ timestamp: agora - dia, acertou: false }),
    ];
    expect(extrairFeatures(eventos).quedaRendimento).toBeGreaterThan(0);
  });

  it('conta dias consecutivos com estudo a partir da telemetria', () => {
    const dia = 24 * HORA;
    const agora = Date.now();
    const tresDias = [0, 1, 2].map((d) => evento({ timestamp: agora - d * dia }));
    expect(extrairFeatures(tresDias).diasSemPausa).toBe(3);
  });

  it('um dia de descanso zera a contagem', () => {
    const dia = 24 * HORA;
    const agora = Date.now();
    // Hoje + 3 dias atras (ontem e anteontem sem nada).
    const comFolga = [evento({ timestamp: agora }), evento({ timestamp: agora - 3 * dia })];
    expect(extrairFeatures(comFolga).diasSemPausa).toBe(1);
  });

  it('rotina longa nao explode: teto de 7 dias', () => {
    const dia = 24 * HORA;
    const agora = Date.now();
    const mes = Array.from({ length: 20 }, (_, d) => evento({ timestamp: agora - d * dia }));
    expect(extrairFeatures(mes).diasSemPausa).toBe(7);
  });

  it('consistencia diaria sozinha nao gera esgotamento', () => {
    const dia = 24 * HORA;
    const agora = Date.now();
    // 20 dias seguidos, tudo certo, de dia, dormindo 8h: rotina exemplar.
    const rotina = Array.from({ length: 20 }, (_, d) =>
      evento({ timestamp: agora - d * dia, horaLocal: 20 }),
    );
    const f = extrairFeatures(rotina, { horasSono: 8 });
    expect(preverBurnout(f).classe).not.toBe('esgotamento');
  });
});

describe('inclinacao', () => {
  it('e zero para serie curta ou constante', () => {
    expect(inclinacao([])).toBe(0);
    expect(inclinacao([0.5])).toBe(0);
    expect(inclinacao([0.5, 0.5, 0.5])).toBe(0);
  });

  it('acompanha o sentido da serie', () => {
    expect(inclinacao([0.2, 0.5, 0.8])).toBeGreaterThan(0);
    expect(inclinacao([0.8, 0.5, 0.2])).toBeLessThan(0);
  });
});

describe('treinarLogistica', () => {
  it('aprende a separar as duas classes do conjunto', () => {
    const amostras: AmostraTreino[] = [];
    for (let i = 0; i < 40; i++) {
      amostras.push({
        features: { ...SAUDAVEL, taxaErro: 0.15 + (i % 5) * 0.01 },
        rotulo: 0,
      });
      amostras.push({
        features: { ...ESGOTADO, taxaErro: 0.75 + (i % 5) * 0.01 },
        rotulo: 1,
      });
    }

    const modelo = treinarLogistica(amostras, { epocas: 300 });
    expect(avaliar(amostras, modelo)).toBeGreaterThan(0.9);
    expect(modelo.versao).toContain('treinado');
  });

  it('nao quebra com feature constante nem com conjunto vazio', () => {
    const constante: AmostraTreino[] = [
      { features: SAUDAVEL, rotulo: 0 },
      { features: SAUDAVEL, rotulo: 1 },
    ];
    const modelo = treinarLogistica(constante, { epocas: 10 });
    expect(modelo.pesos.every((p) => Number.isFinite(p))).toBe(true);
    expect(treinarLogistica([]).versao).toBe('logit-v1-sintetico');
  });
});
