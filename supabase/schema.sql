-- ============================================================
-- MAD — Schema do Supabase
-- Aplicar manualmente no Supabase SQL Editor.
-- Pode rodar mais de uma vez (tudo usa IF NOT EXISTS).
--
-- RLS habilitado SEM policy pública: leitura/escrita apenas via
-- service_role (backend). O navegador nunca acessa essas tabelas
-- (só insere em "leads" com a chave publicável).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- TABELA "leads" (criada fora deste repositório)
-- Só adicionamos colunas — nenhuma linha é alterada ou apagada.
-- ------------------------------------------------------------

-- Liga a Parte 1 (dados da empresa) com a Parte 2 (dados do
-- Instagram). Gerado no navegador, um por preenchimento do
-- formulário: nunca duplica o lead.
alter table leads add column if not exists lead_id uuid;

-- Um lead_id por linha (protege contra lead duplicado).
create unique index if not exists leads_lead_id_uniq
  on leads (lead_id) where lead_id is not null;

-- ------------------------------------------------------------
-- analises_log: controle de uso (rate limit) por contato e por IP
-- ------------------------------------------------------------
create table if not exists analises_log (
  id          uuid        primary key default gen_random_uuid(),
  email       text,
  whatsapp    text,
  ip_hash     text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists analises_log_email_idx
  on analises_log (email, created_at desc);
create index if not exists analises_log_whatsapp_idx
  on analises_log (whatsapp, created_at desc);
create index if not exists analises_log_ip_idx
  on analises_log (ip_hash, created_at desc);

alter table analises_log enable row level security;
-- sem policies: ninguém (anon/authenticated) lê ou escreve.
-- apenas service_role (backend) acessa.

-- ------------------------------------------------------------
-- diagnosticos: resultados gerados pela IA
-- ------------------------------------------------------------
create table if not exists diagnosticos (
  id              uuid        primary key,
  created_at      timestamptz not null default now(),
  nome            text        not null,
  empresa         text,
  whatsapp        text,
  instagram       text,
  cidade          text,
  investimento    text,
  servico         text,
  email           text,
  seguidores      text,
  posts_semana    text,
  tipos_conteudo  text[],
  bio             text,
  link_bio        boolean,
  objetivo        text,
  diagnostico     jsonb       not null,
  ip_hash         text
);

-- Colunas novas (formulário em 2 partes + prazo de retenção).
-- ADD COLUMN IF NOT EXISTS: pode rodar mais de uma vez sem erro.

-- Lead da Parte 1 que originou este diagnóstico (liga as duas partes).
alter table diagnosticos add column if not exists lead_id uuid;

-- Identificador público do link resultado.html?id=...
-- (string aleatória longa, diferente do id interno)
alter table diagnosticos add column if not exists token text;

-- Depois desta data o diagnóstico é apagado pela rotina de limpeza
-- (api/cron/limpeza.js) e o link devolve "não disponível".
alter table diagnosticos add column if not exists expira_em timestamptz
  default now() + interval '90 days';

-- Engajamento/retenção informados pelo cliente ("Não sei" = informação ausente).
alter table diagnosticos add column if not exists engajamento text;

-- Frequência de stories e reels ("Não sei / varia muito" = informação ausente).
alter table diagnosticos add column if not exists frequencia_stories text;

-- Principal dificuldade informada pelo cliente.
alter table diagnosticos add column if not exists dificuldade text;

-- Um diagnóstico por lead (impede e-mail e diagnóstico duplicados).
create unique index if not exists diagnosticos_lead_id_uniq
  on diagnosticos (lead_id) where lead_id is not null;

-- O token público é único (é a chave do link de resultado).
create unique index if not exists diagnosticos_token_uniq
  on diagnosticos (token);

create index if not exists diagnosticos_created_at_idx
  on diagnosticos (created_at desc);

create index if not exists diagnosticos_expira_em_idx
  on diagnosticos (expira_em);

alter table diagnosticos enable row level security;
-- sem policies: apenas service_role (backend) acessa.
