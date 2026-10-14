-- ============================================================
-- MAD — Novas tabelas (diagnóstico com IA)
-- Aplicar manualmente no Supabase SQL Editor.
-- NÃO altera tabelas existentes (leads, etc.).
-- RLS habilitado SEM policy pública: leitura/escrita apenas via
-- service_role (backend). O navegador nunca acessa essas tabelas.
-- ============================================================

create extension if not exists pgcrypto;

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

create index if not exists diagnosticos_created_at_idx
  on diagnosticos (created_at desc);

alter table diagnosticos enable row level security;
-- sem policies: apenas service_role (backend) acessa.
