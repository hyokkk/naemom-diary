-- ============================================================
-- 내몸일기 v1.1 — 몸 상태 주요 증상 테이블 추가
--
-- 이미 setup.sql 을 실행해 쓰고 있는 DB에 실행한다. 기존 데이터는 그대로 남는다.
-- setup.sql 을 아직 실행하지 않았다면 이 파일은 필요 없다 (setup.sql 에 포함됨).
--
-- Supabase 대시보드 > SQL Editor > New query 에 붙여넣고 Run
-- 기본 증상 4가지와 선택지는 앱에 다시 로그인하면 자동으로 만들어진다.
-- ============================================================

-- 8) 몸 상태 주요 증상 (v1.1) -----------------------------
-- 단계형 항목(몸 상태)에 딸린 증상 목록과 증상별 선택지
create table if not exists symptoms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  is_hidden   boolean not null default false
);
create index if not exists symptoms_user_idx on symptoms (user_id);

create table if not exists symptom_options (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symptom_id  uuid not null references symptoms(id) on delete cascade,
  label       text not null,
  sort_order  int  not null default 0,
  is_hidden   boolean not null default false
);
create index if not exists symptom_options_user_idx on symptom_options (user_id);

-- 날짜별 증상 체크. 행이 있으면 체크, option_id 가 비어 있으면 정도 미기록
create table if not exists symptom_records (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  symptom_id  uuid not null references symptoms(id) on delete cascade,
  option_id   uuid references symptom_options(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date, symptom_id)
);

do $$
declare t text;
begin
  foreach t in array array['symptoms','symptom_options','symptom_records'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
