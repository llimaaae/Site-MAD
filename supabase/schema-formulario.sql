-- ============================================================
-- MAD — schema-formulario.sql
-- Alterações do formulário comercial simplificado (1 etapa).
-- Aplicar em Supabase Dashboard > SQL Editor.
-- Seguro para rodar mais de uma vez: só ADD COLUMN / CREATE
-- INDEX / ADD CONSTRAINT, sem DROP e sem alterar dados.
-- As colunas novas nascem NULL; linhas antigas continuam válidas.
-- ============================================================

-- Colunas novas do formulário simplificado
alter table leads add column if not exists email text;
alter table leads add column if not exists investe_marketing text;
alter table leads add column if not exists interesses text[];

-- Coluna antiga da versão em 2 partes (preservada; não é usada
-- pelo formulário novo, mas não se apaga nada).
alter table leads add column if not exists lead_id uuid;

-- Um lead_id por linha (protege contra lead duplicado).
create unique index if not exists leads_lead_id_uniq
  on leads (lead_id) where lead_id is not null;

-- Índice para busca por e-mail
create index if not exists leads_email_idx on leads (email);

-- Índice para o painel ordenar por data
create index if not exists leads_created_at_idx on leads (created_at desc);

-- ------------------------------------------------------------
-- CHECKs de tamanho e formato (null-tolerante: linha antiga
-- sem a coluna preenchida continua válida).
-- Cada ALTER dentro de DO/EXCEPTION: roda mais de uma vez.
-- ------------------------------------------------------------
do $$
begin
  alter table leads add constraint leads_email_len
    check (email is null or (char_length(email) <= 150 and email like '%@%'));
exception when duplicate_object or undefined_object then null; end $$;

do $$
begin
  alter table leads add constraint leads_investe_len
    check (investe_marketing is null or char_length(investe_marketing) <= 50);
exception when duplicate_object or undefined_object then null; end $$;

do $$
begin
  alter table leads add constraint leads_whatsapp_len
    -- linhas antigas têm formatos variados (ex.: 0, 1 ou 14 dígitos);
    -- a regra nova só limita o TAMANHO. O formulário novo grava 10-11.
    check (whatsapp is null or char_length(regexp_replace(whatsapp, '\D', '', 'g')) <= 13);
exception when duplicate_object or undefined_object then null; end $$;

do $$
begin
  alter table leads add constraint leads_instagram_len
    check (instagram is null or char_length(instagram) <= 31);
exception when duplicate_object or undefined_object then null; end $$;

do $$
begin
  alter table leads add constraint leads_interesses_tam
    check (interesses is null or array_length(interesses, 1) <= 5);
exception when duplicate_object or undefined_object then null; end $$;

-- ============================================================
-- FIM — conferir com:
-- select column_name from information_schema.columns
--   where table_name = 'leads';
-- ============================================================