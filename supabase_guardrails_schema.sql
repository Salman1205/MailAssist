-- Guardrails single-row table
create table if not exists public.guardrails (
  id integer primary key default 1,
  tone_style text,
  rules text,
  banned_words text[] default '{}',
  topic_rules jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- Allow only one row (id=1)
insert into public.guardrails (id)
values (1)
on conflict do nothing;

