create extension if not exists pgcrypto;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  access_token text not null default encode(gen_random_bytes(32), 'hex'),
  pix_status text not null default 'pending' check (pix_status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists participants_email_unique
  on public.participants (lower(email));

create table if not exists public.matches (
  id integer primary key,
  home_team text not null,
  away_team text not null,
  home_flag text not null,
  away_flag text not null,
  round_label text not null default '1ª rodada',
  group_label text not null default 'Grupo A',
  display_date text not null,
  starts_at timestamptz,
  status text not null default 'open' check (status in ('open', 'locked', 'finished')),
  actual_home_score integer check (actual_home_score between 0 and 20),
  actual_away_score integer check (actual_away_score between 0 and 20),
  created_at timestamptz not null default now(),
  constraint finished_matches_need_score check (
    status <> 'finished'
    or (actual_home_score is not null and actual_away_score is not null)
  )
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  match_id integer not null references public.matches(id) on delete cascade,
  home_score integer not null check (home_score between 0 and 20),
  away_score integer not null check (away_score between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, match_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists predictions_set_updated_at on public.predictions;

create trigger predictions_set_updated_at
before update on public.predictions
for each row
execute function public.set_updated_at();

insert into public.matches (
  id,
  home_team,
  away_team,
  home_flag,
  away_flag,
  round_label,
  group_label,
  display_date,
  starts_at,
  status
) values
  (1, 'Brasil', 'Marrocos', 'BR', 'MA', '1ª rodada', 'Grupo A', 'Hoje, 13/06/2026', '2026-06-13 20:00:00-03', 'open'),
  (2, 'Brasil', 'Haiti', 'BR', 'HT', '1ª rodada', 'Grupo A', 'Em breve', null, 'open'),
  (3, 'Brasil', 'Escócia', 'BR', 'SCT', '1ª rodada', 'Grupo A', 'Em breve', null, 'open')
on conflict (id) do update set
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  home_flag = excluded.home_flag,
  away_flag = excluded.away_flag,
  round_label = excluded.round_label,
  group_label = excluded.group_label,
  display_date = excluded.display_date,
  starts_at = excluded.starts_at;

alter table public.participants enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
