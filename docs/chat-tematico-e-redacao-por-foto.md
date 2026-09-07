# Chat temático com grounding e correção de redação manuscrita

Referência das duas funcionalidades: o que foi construído, onde cada peça
vive e por que as decisões estruturais foram tomadas assim.

Migração: `supabase/migrations/013_redacao_por_foto.sql`
(bucket `essay_scans` + colunas em `redacoes`).

---

## Onde ficam os endpoints

O pedido especifica `/api/chat/completions` e `/api/essays/upload-and-grade`.
Este projeto **não tem servidor Node**: é um SPA Vite + Supabase, e o
backend é o worker (`server/worker.js`, estilo Cloudflare) que já
hospedava `/generate`, `/tts` e o webhook de pagamento. As duas rotas
foram criadas ali, com exatamente esses caminhos. Publicar em Vercel ou
Netlify Functions funciona igual — o handler é `fetch(request, env)`.

**Prompt compartilhado, não duplicado.** `server/chatPrompt.js` e
`server/essaySchema.js` são JavaScript puro com `.d.ts` ao lado. O worker
importa (bundlado pelo wrangler) e o app importa (compilado pelo tsc).
Sem isso, o mentor seria socrático ou não dependendo de o proxy estar
configurado — e a nota da redação sairia de duas grades diferentes.

**Os dois caminhos.** Com o worker publicado, a chave fica no servidor e
a busca do Google entra. Sem worker, o app fala direto com o Gemini
usando a chave que o aluno colou no Perfil — que é como o projeto roda
hoje. O mesmo prompt, o mesmo contrato; o que muda é que a chave pessoal
raramente tem grounding, e nesse caso **nenhum badge de fonte aparece**,
em vez de aparecer um badge mentiroso.

---

## 1. Chat temático

### Modos

| Modo | Escopo | Bancas de referência |
|---|---|---|
| ENEM Geral | tudo, sem recusar assunto | ENEM (INEP) |
| Matemática | somente matemática | ENEM, Fuvest, Unicamp |
| Ciências da Natureza | biologia, física e química | ENEM, Fuvest, Unicamp, UFRGS |
| Linguagens | português, inglês, espanhol e redação | ENEM, Fuvest, Unicamp |
| Vestibulares Específicos | estilo de cada banca fora do ENEM | Fuvest, Unicamp, UFRGS, UERJ, UNESP, ITA, IME |

As bancas e as fontes de cada modo entram no prompt para orientar a
**busca**. Sem dizer onde procurar, o modelo cita "uma questão do ENEM"
genérica — que é exatamente a alucinação que o grounding deveria
eliminar.

**Modo × persona.** O app já tinha professores (personas). Deixar os dois
eixos soltos permitiria "Prof. Matemática no modo Humanas". A regra: o
modo manda e troca o professor junto; persona **criada pelo usuário**
continua no comando dela mesma, com a instrução que ele escreveu.

### System prompt dinâmico

Montado no servidor por `montarSystemInstructionChat({ modo, horaLocal, … })`:

- **Socrático com válvula de escape.** Um passo por mensagem, devolver o
  problema em pergunta, apontar em que passo o raciocínio saiu do trilho.
  E: se o aluno pedir a resposta direta **duas vezes** ou demonstrar
  frustração, entregar a solução completa. Insistir no método depois
  disso vira obstáculo, não ensino.
- **Densidade por horário.** Madrugada (0h–5h): 120 palavras, uma
  pergunta, oferecer parar. Noite (19h–5h): 180 palavras. Dia: até 250.
  O prompt proíbe comentar o horário — adaptar é serviço, anunciar é
  constrangimento.
- **Antialucinação.** Citar exige banca e ano; não achou, diz que não
  achou; questão autoral vai rotulada como "inédita, no estilo da banca".

### Busca e badges

O nome da ferramenta **muda entre gerações** do modelo:
`google_search_retrieval` no 1.5, `google_search` no 2.x. Mandar o nome
errado devolve 400 e derruba a conversa, então `ferramentasDeBusca()`
deriva do modelo configurado.

Se a busca falhar por 400 (indisponível na região ou no plano), o worker
**repete sem a ferramenta** e marca `groundingUsado: false` — responder
sem fonte é melhor que mostrar "erro" para quem só queria estudar.

Na interface, dois sinais distintos:

- **verde** — a IA abriu a fonte (chips com o domínio, clicáveis);
- **âmbar** — a resposta cita banca e ano **sem** fonte verificada. É
  precisamente o caso em que o aluno precisa desconfiar, e ele fica
  visível em vez de escondido.

Sem nenhum dos dois, nenhum badge: selo em toda mensagem vira ruído.

---

## 2. Correção de redação manuscrita

### Cliente

`imagePrep.ts` trata a foto **antes** de subir: 1600 px no lado maior,
tons de cinza, alongamento de níveis por percentil e JPEG 0.82 — uma
foto de 5 MB vira ~400 kB, e a tela mostra o ganho.

Duas decisões que parecem detalhe:

- **Não binariza.** Limiar deixa a imagem "mais limpa" na tela e apaga
  lápis fraco e acento — justamente o que decide a competência 1.
- **`imageOrientation: 'from-image'`.** Sem isso, a foto tirada com o
  celular deitado chega girada e o modelo tenta ler o texto de lado.

### Pipeline

`POST /api/essays/upload-and-grade` (multipart):

1. valida sessão (a foto é material escolar de um menor), tipo e tamanho;
2. sobe para o bucket **privado** `essay_scans`, em `<uid>/<uuid>.jpg` —
   o caminho começa pelo dono, que é o que permite a policy autorizar
   sem consultar tabela;
3. chama o Gemini multimodal **uma vez** com `responseMimeType:
   application/json` + `responseSchema`;
4. normaliza e grava em `redacoes` com `origem = 'foto'`;
5. devolve o JSON do contrato + `image_url` assinada + `essay_id`.

**OCR e correção na mesma chamada** porque são duas leituras da mesma
imagem: separar dobraria custo e latência e abriria a chance de a nota
avaliar uma transcrição diferente da que o aluno lê na tela.

### Três camadas para o JSON não quebrar a tela

1. `responseSchema` — o modelo já produz o formato;
2. `responseMimeType: application/json` — sem markdown em volta;
3. `normalizarCorrecao()` — conserta o que escapar.

A terceira existe porque as duas primeiras falham em produção. Ela
**recalcula o total** a partir das competências (o modelo erra a soma, e
é a soma que o aluno confere), prende cada nota na grade discreta do
INEP (0/40/80/120/160/200, empate para baixo) e preenche competência
faltante em vez de deixar a interface quebrar depois de o aluno esperar a
leitura da folha inteira.

**Foto ilegível não vira 0/1000.** Transcrição com menos de 180
caracteres é quase sempre foto ruim, não redação curta: a tela diz que o
problema foi a imagem, pede outra e **não grava** no histórico. Zero
seria uma avaliação do texto.

### Tela dividida

- **Lado A** — a foto enviada + transcrição do OCR, com aviso para
  conferir: se a IA leu errado, a nota avaliou outro texto. Botão leva a
  transcrição para o editor.
- **Lado B** — nota geral 0–1000 e as cinco competências, cada uma
  expansível com o feedback citando trecho do próprio texto.

### Privacidade

Bucket privado, URL assinada, policies por dono. **Não há policy para
responsável nem educador**: o painel dos pais mostra nota e evolução,
nunca a folha escrita à mão — a mesma fronteira do módulo de bem-estar.

---

## Contrato de retorno

```json
{
  "transcription": "…",
  "detected_theme": "…",
  "scores": {
    "competence_1": { "score": 160, "feedback": "…" },
    "competence_2": { "score": 200, "feedback": "…" },
    "competence_3": { "score": 160, "feedback": "…" },
    "competence_4": { "score": 200, "feedback": "…" },
    "competence_5": { "score": 160, "feedback": "…" }
  },
  "total_score": 880,
  "strengths": ["…"],
  "actionable_improvements": ["…"]
}
```

Acrescidos de `essay_id`, `image_url`, `image_path` e `ilegivel`, que a
tela usa e o contrato original não previa.

---

## Testes

`npm test` cobre as duas funcionalidades em 3 camadas:

- `chatGrounding.test.ts` — os cinco modos, densidade por faixa horária,
  regras socráticas e antialucinação **no texto que viaja para o
  modelo**, ferramenta certa por família, extração de fontes;
- `essayScan.test.ts` — esquema, prompt, grade do INEP, normalização
  contra respostas malformadas, detecção de foto ilegível, e a matemática
  do preparo de imagem (histograma, níveis, redimensionamento);
- `worker.test.mjs` — as duas rotas com fetch interceptado: prompt
  montado no servidor, busca ligada, repescagem sem busca no 400, sessão
  obrigatória no upload, caminho no bucket por dono, OCR+correção em uma
  chamada, soma recalculada, foto ilegível fora do histórico;
- `migracoes.test.mjs` — a 013 aplicada em Postgres real, colunas novas e
  `check` de `origem`.

Modelo padrão: `gemini-1.5-flash` nas duas rotas, trocável por
`GEMINI_MODEL_CHAT` / `GEMINI_MODEL_VISION` sem deploy.
