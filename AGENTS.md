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

## Arquivos

- `index.html` / `style.css` / `script.js`: página principal, CSS e animações/formulário.
- `admin.html` / `admin.js`: painel de leads (login via Supabase Auth).
- `api/notifica-lead.js`: função serverless que envia o e-mail de aviso de lead novo.
- `privacidade.html`: política de privacidade (LGPD).
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
  `sb_secret_...`, senha do banco, chaves de IA, `RESEND_API_KEY`, `WEBHOOK_SECRET`.
- Permitido no front-end: URL do Supabase e chave `sb_publishable_...`.
- O assistente de IA não deve gerar, mostrar ou repetir segredos nas respostas.
  Usar apenas os NOMES das variáveis de ambiente. Os valores são criados e
  cadastrados pelo dono do projeto fora do chat (Vercel/Supabase).
- Usar `textContent` (nunca `innerHTML`) para dados vindos de usuários.
- Antes de qualquer commit, varrer os arquivos procurando segredos.
- Não fazer `git push --force` e não apagar tabelas nem dados sem confirmação.
- Se uma funcionalidade mudar o uso dos dados pessoais, avisar para atualizar a
  política de privacidade (LGPD).

## Status

- [x] Passo 1: limpeza de HTML/CSS (sem mudança visual).
- [x] Passo 2: aviso de lead novo por e-mail.
      - Webhook do Supabase envia o segredo no cabeçalho `x-webhook-secret`
        (em HTTP Headers, não em HTTP Parameters).
      - Remetente atual: `onboarding@resend.dev` (provisório até configurar o domínio).
      - Variáveis na Vercel: `WEBHOOK_SECRET`, `RESEND_API_KEY`, `LEAD_EMAIL`, `SITE_URL`.
- [ ] Passo 3 (ADIADO de propósito): domínio próprio e configuração na Vercel.
      Não pagar domínio nem planos da Vercel/Supabase até a empresa gerar retorno.
- [ ] Próximo passo: IA de diagnóstico do Instagram com página de resultado
      (`resultado.html?id=...`) e botão de WhatsApp.

## Pendências de conteúdo

- Preencher os campos `[DATA]`, `[SEU E-MAIL]` e `[RAZÃO SOCIAL / CNPJ]` em `privacidade.html`.
- Escrever a resposta real de "Posso cancelar quando quiser?" no FAQ.
- Definir as regras do plano anual (à vista ou parcelado, multa, quais planos).
- Revisar os textos dos serviços para refletir só o que a MAD realmente vende.
- Definir preços dos planos e o preço real do e-book.
- Conferir os termos do plano Hobby da Vercel (uso comercial) e avaliar o plano
  Pro do Supabase para evitar a pausa por inatividade.