import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppStore } from '@mentor/state/appStore';
import { CameraComGuia } from '../../src/features/redacao/CameraComGuia';
import { corrigirFotoNoServidor, corrigirOffline, type ResultadoRedacao } from '../../src/features/redacao/corrigirFoto';
import { escolherFoto, type FotoPronta } from '../../src/lib/foto';
import { bytesDoBase64 } from '../../src/lib/imagem';
import { anunciar } from '../../src/ui/acessibilidade';
import { Barra, Campo, Selo } from '../../src/ui/Basicos';
import { Botao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { cor, LARGURA_NOTEBOOK, raio } from '../../src/ui/tema';

function corNota(nota: number, max: number): string {
  const p = nota / max;
  return p >= 0.7 ? cor.esmeralda600 : p >= 0.4 ? cor.ambar600 : cor.vermelho600;
}

/**
 * Redação por foto: fotografar a folha, ler a letra e corrigir nas 5
 * competências. Sem rede, o corretor offline avalia o texto digitado.
 */
export default function Redacao() {
  const { width } = useWindowDimensions();
  const lado = width >= LARGURA_NOTEBOOK;
  const [tema, setTema] = useState('');
  const [cameraAberta, setCameraAberta] = useState(false);
  const [foto, setFoto] = useState<FotoPronta | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [resultado, setResultado] = useState<ResultadoRedacao | null>(null);
  const [erro, setErro] = useState('');
  const [modoOffline, setModoOffline] = useState(false);
  const [textoOffline, setTextoOffline] = useState('');
  const [aba, setAba] = useState<'foto' | 'texto'>('texto');
  const controle = useRef<AbortController | null>(null);

  useEffect(() => () => controle.current?.abort(), []);
  useEffect(() => {
    if (!enviando) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [enviando]);

  function premiar(r: ResultadoRedacao) {
    // Mesma recompensa da redação digitada no web.
    const xp = r.total >= 600 ? 100 : 50;
    const app = useAppStore.getState();
    app.addXP(xp);
    app.addLog({ timestamp: Date.now(), type: 'essay', description: `Redação corrigida: ${r.total}/1000`, xp });
    app.setLastCorrection(r.paraStore);
    anunciar(`Correção pronta: ${r.total} de 1000.`);
  }

  async function enviar(f: FotoPronta) {
    setFoto(f);
    setCameraAberta(false);
    setErro('');
    setResultado(null);
    setSegundos(0);
    setEnviando(true);
    controle.current = new AbortController();
    try {
      const r = await corrigirFotoNoServidor(f, tema, controle.current.signal);
      setResultado(r);
      if (r.ilegivel) {
        setErro('Não consegui ler a folha. Tente outra foto com mais luz e a folha reta.');
        return;
      }
      premiar(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível corrigir esta foto.');
    } finally {
      setEnviando(false);
    }
  }

  async function daGaleria() {
    setCameraAberta(false);
    const f = await escolherFoto('galeria', { cortarNaGuia: false }).catch(() => null);
    if (f) void enviar(f);
  }

  function abrirCamera() {
    // No navegador a câmera em tela cheia não ajuda: o seletor de arquivo já oferece a câmera no celular.
    if (Platform.OS === 'web') void escolherFoto('camera').then((f) => f && enviar(f));
    else setCameraAberta(true);
  }

  function corrigirSemInternet() {
    const texto = textoOffline.trim() || resultado?.transcricao || '';
    if (texto.length < 200) {
      setErro('Para a correção offline, digite a redação (pelo menos alguns parágrafos).');
      return;
    }
    const r = corrigirOffline(texto, tema);
    setErro('');
    setResultado(r);
    premiar(r);
  }

  const imagem = foto ? <Image source={{ uri: foto.uri }} style={estilos.foto} resizeMode="contain" accessibilityLabel="Foto da redação enviada" /> : null;
  const transcricao = resultado?.transcricao ? (
    <Texto selectable style={estilos.transcricao}>
      {resultado.transcricao}
    </Texto>
  ) : null;

  return (
    <Tela cabecalho={{ titulo: 'Redação', subtitulo: 'Fotografe a folha e receba a nota nas 5 competências', cor: 'violeta', pose: 'estudando_caderno', voltar: true }}>
      {!resultado && !enviando ? (
        <Cartao estilo={{ gap: 12 }}>
          <Campo rotulo="Tema (opcional)" value={tema} onChangeText={setTema} placeholder="Ex.: desafios da mobilidade urbana no Brasil" />
          <Botao titulo="Fotografar a folha" icone="camera" variante="ambar" aoTocar={abrirCamera} />
          <Botao titulo="Escolher da galeria" icone="images-outline" variante="secundario" aoTocar={() => void daGaleria()} />
          <Pressable onPress={() => setModoOffline((v) => !v)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Texto negrito cor={cor.ceu700}>
              {modoOffline ? 'Fechar correção sem internet' : 'Sem internet? Digite e corrija offline'}
            </Texto>
          </Pressable>
          {modoOffline ? (
            <>
              <Campo rotulo="Texto da redação" value={textoOffline} onChangeText={setTextoOffline} multiline style={{ minHeight: 220 }} />
              <Botao titulo="Corrigir offline" variante="secundario" aoTocar={corrigirSemInternet} />
            </>
          ) : null}
        </Cartao>
      ) : null}

      {enviando ? (
        <Cartao estilo={{ gap: 10, alignItems: 'center' }}>
          {imagem}
          <Texto negrito accessibilityLiveRegion="polite">Enviando e lendo a letra… {segundos}s</Texto>
          {foto ? <Texto variante="legenda">Foto reduzida para {Math.round(bytesDoBase64(foto.base64) / 1024)} KB</Texto> : null}
          <Botao titulo="Cancelar" variante="fantasma" aoTocar={() => controle.current?.abort()} />
        </Cartao>
      ) : null}

      {erro ? (
        <Cartao destaque={cor.vermelho500} estilo={{ gap: 10 }}>
          <Texto negrito cor={cor.vermelho600} accessibilityLiveRegion="assertive">
            {erro}
          </Texto>
          <Botao titulo="Tentar outra foto" variante="secundario" aoTocar={() => { setErro(''); setResultado(null); setFoto(null); }} />
          {!modoOffline ? <Botao titulo="Corrigir offline" variante="fantasma" aoTocar={() => { setErro(''); setResultado(null); setModoOffline(true); }} /> : null}
        </Cartao>
      ) : null}

      {resultado && !resultado.ilegivel ? (
        <>
          <Cartao estilo={{ gap: 8, alignItems: 'center' }}>
            <Texto variante="rotulo">Nota final</Texto>
            <Texto variante="numero" style={{ fontSize: 44 }} cor={corNota(resultado.total, 1000)}>
              {resultado.total}
            </Texto>
            <Texto variante="legenda">de 1000</Texto>
            {resultado.origem === 'offline' ? (
              <Selo texto="Estimativa offline: corrija com a IA quando a rede voltar" corFundo={cor.ambar100} corTexto={cor.ambar700} />
            ) : null}
            {resultado.tema ? <Texto variante="legenda">Tema: {resultado.tema}</Texto> : null}
          </Cartao>

          <Cartao estilo={{ gap: 12 }}>
            <Texto variante="subtitulo">Competências</Texto>
            {resultado.competencias.map((c, i) => (
              <View key={c.titulo} style={{ gap: 4 }} accessible accessibilityLabel={`Competência ${i + 1}, ${c.titulo}: ${c.nota} de 200. ${c.feedback}`}>
                <View style={estilos.linha}>
                  <Texto negrito style={{ flex: 1 }}>
                    {i + 1}. {c.titulo}
                  </Texto>
                  <Texto negrito cor={corNota(c.nota, 200)}>{c.nota}</Texto>
                </View>
                <Barra valor={(c.nota / 200) * 100} corBarra={corNota(c.nota, 200)} altura={10} />
                {c.feedback ? <Texto variante="legenda">{c.feedback}</Texto> : null}
              </View>
            ))}
          </Cartao>

          {resultado.fortes.length > 0 || resultado.melhorar.length > 0 ? (
            <Cartao estilo={{ gap: 8 }}>
              {resultado.fortes.length > 0 ? <Texto variante="subtitulo">Pontos fortes</Texto> : null}
              {resultado.fortes.map((t) => (
                <Texto key={t}>• {t}</Texto>
              ))}
              {resultado.melhorar.length > 0 ? <Texto variante="subtitulo">Para subir a nota</Texto> : null}
              {resultado.melhorar.map((t) => (
                <Texto key={t}>• {t}</Texto>
              ))}
            </Cartao>
          ) : null}

          {foto || transcricao ? (
            <Cartao estilo={{ gap: 10 }}>
              <Texto variante="subtitulo">{foto ? 'Foto e texto lido' : 'Texto corrigido'}</Texto>
              <Texto variante="legenda">Confira se a leitura bate com o que você escreveu: palavra lida errado tira ponto que não é seu.</Texto>
              {!foto ? (
                transcricao
              ) : lado ? (
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1 }}>{imagem}</View>
                  <View style={{ flex: 1 }}>{transcricao}</View>
                </View>
              ) : (
                <>
                  <View style={estilos.alternador} accessibilityRole="tablist">
                    {(['texto', 'foto'] as const).map((a) => (
                      <Pressable key={a} onPress={() => setAba(a)} accessibilityRole="tab" accessibilityState={{ selected: aba === a }} style={[estilos.botaoAba, aba === a ? estilos.botaoAbaAtivo : null]}>
                        <Texto negrito cor={aba === a ? cor.branco : cor.tinta700}>
                          {a === 'texto' ? 'Texto lido' : 'Foto'}
                        </Texto>
                      </Pressable>
                    ))}
                  </View>
                  {aba === 'foto' ? imagem : transcricao}
                </>
              )}
            </Cartao>
          ) : null}

          <Botao titulo="Corrigir outra redação" variante="secundario" icone="refresh" aoTocar={() => { setResultado(null); setFoto(null); setTextoOffline(''); }} />
        </>
      ) : null}

      <CameraComGuia aberta={cameraAberta} aoFechar={() => setCameraAberta(false)} aoFotografar={(f) => void enviar(f)} aoPedirGaleria={() => void daGaleria()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  foto: { width: '100%', height: 360, borderRadius: raio.md, backgroundColor: cor.cinza100 },
  transcricao: { backgroundColor: cor.superficie, borderRadius: raio.md, padding: 12, lineHeight: 24 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alternador: { flexDirection: 'row', gap: 8 },
  botaoAba: { flex: 1, minHeight: 44, borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.cinza200, alignItems: 'center', justifyContent: 'center' },
  botaoAbaAtivo: { backgroundColor: cor.violeta600, borderColor: cor.violeta600 },
});
