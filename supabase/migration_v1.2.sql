-- ============================================================
-- 내몸일기 v1.2 — 일회성 약의 증상/차도, 병원 치료 일지
--
-- 이미 setup.sql 을 실행해 쓰고 있는 DB에 실행한다. 기존 데이터는 그대로 남는다.
-- v1.0 DB라면 migration_v1.1.sql 을 먼저 실행한다.
-- setup.sql 을 아직 실행하지 않았다면 이 파일은 필요 없다 (setup.sql 에 포함됨).
--
-- Supabase 대시보드 > SQL Editor > New query 에 붙여넣고 Run
-- ============================================================

-- 1) 일회성 약: 증상(먹은 이유)과 차도. 예전 메모(note)는 증상으로 옮긴다.
alter table onetime_meds add column if not exists symptom text;
alter table onetime_meds add column if not exists effect  text;
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'onetime_meds' and column_name = 'note') then
    execute 'update onetime_meds set symptom = note where symptom is null and note is not null';
  end if;
end $$;

-- 2) 병원 치료 일지
create table if not exists hospital_visits (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  hospital    text,
  treatment   text,
  note        text,
  next_date   date,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

alter table hospital_visits enable row level security;
drop policy if exists own_rows on hospital_visits;
create policy own_rows on hospital_visits for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on hospital_visits from anon;
grant select, insert, update, delete on hospital_visits to authenticated;
