# octabs-search (Cloudflare Worker)

Busca a melodia de uma música pelo nome usando a API do Claude com busca na web.
A chave da API fica guardada como segredo no Worker; o app só conhece o endereço e um token pessoal.

## Publicar (uma vez)

Pré-requisitos: conta grátis na Cloudflare e créditos na API da Anthropic
(console.anthropic.com → Settings → Billing; a assinatura Claude Pro **não** inclui a API).

Na pasta `worker/`:

```bash
npm install
npx wrangler login
npx wrangler deploy
```

O deploy mostra o endereço, algo como `https://octabs-search.SEU-USUARIO.workers.dev`.

Crie a chave em console.anthropic.com → API Keys e guarde como segredo (o comando pede para colar):

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Invente um token (qualquer senha longa) e guarde também:

```bash
npx wrangler secret put APP_TOKEN
```

No app: **+ Nova → Buscar → Configurar**, cole o endereço do Worker e o mesmo token.

## Custos

- Modelo padrão `claude-sonnet-5` (mais barato). Para mais precisão, troque `MODEL` em `wrangler.toml` para `claude-opus-5` (≈2,5x mais caro) e rode `npx wrangler deploy` de novo.
- Cada busca na web custa US$ 10 por 1.000 buscas (máximo de 3 por música, em até 3 rodadas).
- O gasto estimado de cada rodada aparece nos logs: `npx wrangler tail octabs-search`.
- Dá para definir um limite de gasto mensal no console da Anthropic (Settings → Limits).

## Desenvolvimento

```bash
npm test          # testes
npm run typecheck
npx wrangler dev  # roda local; segredos locais em .dev.vars (ANTHROPIC_API_KEY=..., APP_TOKEN=...)
```
