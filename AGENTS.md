# MAD — Site

Site estático (HTML + CSS + JavaScript puro, sem build) da MAD, empresa de
marketing digital (não é SaaS). Vendemos planos mensais com serviços como
tráfego pago (Google Ads e Meta Ads), gestão de redes sociais, criação de
sites, branding e automações. Nicho inicial: clínicas estéticas (ainda não
fechado). Papel do TI: sites e automações.

## Stack

- HTML/CSS/JS puro, sem framework e sem build. Hospedagem: Vercel (plano Hobby),
  deploy automático a cada push no GitHub (repositório "Site-MAD", branch main).
- Banco de dados: Supabase (plano grátis), acessado via REST com fetch (sem SDK).
- Fontes: Montserrat (títulos) e Inter (textos), via Google Fonts.
- IA: Groq (plano grátis) via `api/diagnostico.js`.

## Arquivos

- `index.html` / `style.css` / `script.js`: página principal, CSS e animações.
- `formulario.js`: lógica do formulário em 2 partes (sem DOM, testável em Node).
- `admin.html` / `admin.js`: painel de leads (login via Supabase Auth).
- `resultado.html` / `resultado.js`: página de resultado do diagnóstico
  (`resultado.html?id=...`), sem login, com PDF e link para copiar.
- `api/notifica-lead.js`: função serverless que envia o e-mail de aviso de lead novo.
- `api/diagnostico.js`: função serverless que junta a Parte 1 e a Parte 2 do
  formulário, chama a IA, salva o diagnóstico e envia o e-mail do diagnóstico.
- `api/resultado.js`: devolve um diagnóstico pelo token público do link.
- `api/cron/limpeza.js`: rotina diária (Vercel Cron) que apaga diagnósticos
  vencidos (90 dias) e logs de análise com mais de 24h. Exige `CRON_SECRET`.
- `api/_lib/`: cors, email (Resend), groq, rateLimit, supabase, validation.
- `privacidade.html`: política de privacidade (LGPD).
- `supabase/schema.sql`: colunas e índices novos (aplicar no SQL Editor).
- `tests/`: testes automatizados (`node --test`), sem dependências externas.
- `vercel.json`: agendamento do cron de limpeza (1x por dia).
- `assets/logo.png`: logo oficial da MAD (PNG transparente).

## Identidade visual

- Cores: azul-marinho `#090D18` (fundo), `#0d1424` (fundo alternativo), azul
  elétrico `#009FE3`, azul claro `#80C6FA`, branco. Variáveis CSS em `:root`.
- Estilo: dark tech, minimalista, formas geométricas (triângulo da marca), espaço negativo.

### Decisões de design que devem ser mantidas

- Pouco efeito. Sem brilho (box-shadow azul) espalhado, sem gradiente em texto
  (destaques em azul sólido); hover apenas em elementos clicáveis e só trocando
  de cor. Objetivo: não parecer um site genérico feito por IA.
- Divisas entre seções com curvas alternando convexa e côncava.
- Triângulo grande no fundo do hero, que continua para a seção de baixo.
- Sem indicador de rolagem e sem círculos decorativos.
- Seção de equipe mostra funções (gestores de tráfego, editores de vídeo,
  designers, social medias, TI), não pessoas.
- Um único botão de ação abaixo do carrossel de serviços (não um por card).

## Segurança (regras do projeto)

- Nunca colocar no código, no GitHub ou no navegador: `service_role`,
  `sb_secret_...`, senha do banco, chaves de IA, `RESEND_API_KEY`, `WEBHOOK_SECRET`,
  `CRON_SECRET`.
- Permitido no front-end: URL do Supabase e chave `sb_publishable_...`.
- O assistente de IA não deve gerar, mostrar ou repetir segredos nas respostas.
  Usar apenas os NOMES das variáveis de ambiente. Os valores são criados e
  cadastrados pelo dono do projeto fora do chat (Vercel/Supabase).
- Usar `textContent` (nunca `innerHTML`) para dados vindos de usuários.
- Antes de qualquer commit, varrer os arquivos procurando segredos.
- Não fazer `git push --force` e não apagar tabelas nem dados sem confirmação.
- Se uma funcionalidade mudar o uso dos dados pessoais, avisar para atualizar a
  política de privacidade (LGPD).

## Variáveis de ambiente (Vercel)

`WEBHOOK_SECRET`, `RESEND_API_KEY`, `LEAD_EMAIL`, `SITE_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`,
`IP_HASH_SALT`, `CRON_SECRET` (novo, protege o cron de limpeza) e `EMAIL_FROM`
(opcional; sem ele o remetente é `onboarding@resend.dev`).

## Status

- [x] Passo 1: limpeza de HTML/CSS (sem mudança visual).
- [x] Passo 2: aviso de lead novo por e-mail.
      - Webhook do Supabase envia o segredo no cabeçalho `x-webhook-secret`
        (em HTTP Headers, não em HTTP Parameters).
      - Remetente atual: `onboarding@resend.dev` (provisório até configurar o domínio).
- [x] Passo 3 (ADIADO de propósito): domínio próprio e configuração na Vercel.
      Não pagar domínio nem planos da Vercel/Supabase até a empresa gerar retorno.
- [x] E-book: REMOVIDO do site (seção, CSS e preço).
- [x] Diagnóstico com IA em 2 partes (mesmo cartão, sem página nova).
      - Parte 1: dados da empresa/contato. Salva o lead, dispara o e-mail de
        aviso (webhook do Supabase) e só então mostra a Parte 2.
      - `lead_id` (uuid gerado no navegador) liga as duas partes; um
        diagnóstico por lead (índice único em `diagnosticos.lead_id`).
      - Parte 2: seguidores, posts/semana, tipos de conteúdo, engajamento,
        stories/reels, link na bio, bio, objetivo e principal dificuldade.
        "Não sei" = informação ausente (a IA não inventa número).
      - Resultado em `resultado.html?id=<token aleatório de 32 caracteres>`.
      - E-mail do diagnóstico (Parte 2 + link) enviado pelo próprio
        `/api/diagnostico` depois de salvar; se o e-mail falhar, o diagnóstico
        continua valendo.
- [x] Rotina de limpeza: cron diário (`api/cron/limpeza.js`) apaga
      diagnósticos com mais de 90 dias e logs de análise com mais de 24h.
      A tabela `leads` não é apagada pela rotina.

## Pendências de conteúdo e operação

- [ ] Aplicar `supabase/schema.sql` no Supabase SQL Editor **antes** de
      publicar: sem as colunas `leads.lead_id` e `diagnosticos.*`, o
      formulário e o diagnóstico não funcionam.
- [ ] Conferir a URL do projeto Supabase: `utbiafditbvpsgpejmli.supabase.co`
      não resolveu DNS em 19/10/2026 (projeto pausado, deletado ou URL
      diferente). Atualizar `script.js` e `admin.js` se mudou.
- [ ] Cadastrar `CRON_SECRET` na Vercel (sem isso o cron responde 401) e
      conferir a execução em Settings > Cron Jobs.
- [ ] Preencher os campos `[DATA]`, `[SEU E-MAIL]` e `[RAZÃO SOCIAL / CNPJ]` em `privacidade.html`.
- [ ] Escrever a resposta real de "Posso cancelar quando quiser?" no FAQ.
- [ ] Definir as regras do plano anual (à vista ou parcelado, multa, quais planos).
- [ ] Revisar os textos dos serviços para refletir só o que a MAD realmente vende.
- [ ] Definir preços dos planos.
- [ ] Conferir os termos do plano Hobby da Vercel (uso comercial) e avaliar o
      plano Pro do Supabase para evitar a pausa por inatividade.
- [ ] Definir o prazo de retenção dos leads comerciais (a rotina de limpeza
      não apaga `leads`).
- [ ] Revisar `oportunidades_para_a_MAD` (agora "próximos passos" genéricos)
      quando os serviços e planos forem redefinidos.
