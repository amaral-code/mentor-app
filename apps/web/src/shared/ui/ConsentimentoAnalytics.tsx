import { useState } from 'react';
import { ehMenorDe16 } from '@mentor/core/vinculoCodigo';
import { posthogKey } from '@mentor/core/runtimeConfig';
import { useAppStore } from '@mentor/state/appStore';
import { consentiuAnalytics, definirConsentimentoAnalytics } from '../lib/observabilidade';

/**
 * Consentimento para dados de uso (#66). Desligado por padrão; menor de
 * 16 não liga (ver `podeRastrear` no núcleo). O texto diz exatamente o que
 * sai, porque consentimento só vale se a pessoa sabe com o que concorda.
 */
export function ConsentimentoAnalytics() {
  const nascimento = useAppStore((s) => s.session?.dataNascimento ?? null);
  const [ligado, setLigado] = useState(consentiuAnalytics);
  if (!posthogKey()) return null;
  const menor = ehMenorDe16(nascimento);

  return (
    <section id="secao-dados-uso" className="cartao p-5 scroll-mt-24 space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">Dados de uso</h2>
      <p className="text-sm text-slate-600 leading-relaxed">
        Ajude a melhorar o app compartilhando, de forma anônima, quais telas você usa (por exemplo: terminou um quiz, corrigiu uma
        redação). Nunca vão seu nome, e-mail, escola, notas, conversas nem nada que você escreve.
      </p>
      {menor ? (
        <p className="text-xs text-slate-500">Para quem tem menos de 16 anos, ou não informou a data de nascimento, esta opção fica desligada.</p>
      ) : (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-5 h-5 accent-ceu-500"
            checked={ligado}
            onChange={(e) => {
              definirConsentimentoAnalytics(e.target.checked);
              setLigado(e.target.checked);
            }}
          />
          <span className="text-sm font-bold text-tinta-900">Compartilhar dados de uso anônimos</span>
        </label>
      )}
    </section>
  );
}
