# tools/

Scripts de depuração e de validação visual, usados durante o
desenvolvimento. Nenhum deles faz parte do app publicado.

## Chave de serviço

Vários destes scripts criam e apagam uma conta de teste, e para isso
precisam da chave `service_role` do Supabase. Ela **não fica mais no
arquivo**: é lida da variável de ambiente.

```bash
SUPABASE_SERVICE_KEY=... node tools/validar_visual.mjs
```

Essa chave ignora toda a RLS. Nunca a escreva num arquivo versionado.
Uma versão antiga dela ficou gravada no histórico do git e precisa ser
trocada no painel do Supabase (Settings, API): apagar do arquivo não a
invalida.
