# Política de segurança

O Midnight Mentor é usado por adolescentes e guarda dados sensíveis (estudo, bem-estar, vínculo com responsáveis e psicólogos). Levamos falhas de segurança a sério.

## Como reportar

**Não abra uma issue pública.** Use o reporte privado do GitHub:
aba **Security → Report a vulnerability** neste repositório.

Inclua, se puder:

- o que é afetado (app, worker, banco/RLS)
- passos para reproduzir
- o impacto que você imagina

Respondemos em até 5 dias úteis e avisamos quando a correção for publicada.

## Vazou uma chave?

1. Avise a equipe pelo canal privado na hora.
2. **Gire a chave** no painel do provedor (Supabase, Cloudflare, DeepSeek, Google). Apagar o commit não basta: o histórico do git e os forks continuam com ela.
3. Atualize o cofre de senhas da equipe e os segredos dos ambientes.
4. Registre o ocorrido na issue de segurança privada.
