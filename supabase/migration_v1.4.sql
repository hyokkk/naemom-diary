-- ============================================================
-- 내몸일기 v1.4 — 정기 약 복용 체크, 몸 상태 단계 방향 (5가 가장 나쁨)
--
-- 이미 setup.sql 을 실행해 쓰고 있는 DB에 실행한다. 기존 기록은 그대로 남는다.
-- 이전 버전 DB라면 migration_v1.1 ~ v1.3 을 먼저 순서대로 실행한다.
-- setup.sql 을 아직 실행하지 않았다면 이 파일은 필요 없다 (setup.sql 에 포함됨).
--
-- Supabase 대시보드 > SQL Editor > New query 에 붙여넣고 Run
-- ============================================================

-- 1) 정기 복용 약의 날짜별 복용 체크와 차도
create table if not exists regular_med_logs (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null,
  medication_id  uuid not null references medications(id) on delete cascade,
  effect         text,
  updated_at     timestamptz not null default now(),
  primary key (user_id, date, medication_id)
);

alter table regular_med_logs enable row level security;
drop policy if exists own_rows on regular_med_logs;
create policy own_rows on regular_med_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on regular_med_logs from anon;
grant select, insert, update, delete on regular_med_logs to authenticated;

-- 2) 단계형 항목의 방향 (true = 숫자가 높을수록 나쁨)
alter table items add column if not exists high_is_bad boolean not null default false;

-- 3) '몸 상태' 선택지 순서를 뒤집는다: 매우 나쁨(1) → 매우 나쁨(5)
--    기록은 단계 숫자가 아니라 선택지 ID로 저장되어 있어서, 순서만 바꾸면
--    "매우 나쁨"으로 기록한 날은 그대로 "매우 나쁨"이고 단계 숫자만 1 → 5로 바뀐다.
--    high_is_bad 가 false 인 항목만 바꾸므로, 이 파일을 두 번 실행해도 다시 뒤집히지 않는다.
begin;
with target as (
  select id from items where type = 'scale' and name = '몸 상태' and high_is_bad = false
), reordered as (
  select io.id, row_number() over (partition by io.item_id order by io.sort_order desc, io.id desc) - 1 as new_order
  from item_options io where io.item_id in (select id from target)
)
update item_options io set sort_order = r.new_order from reordered r where io.id = r.id;
update items set high_is_bad = true where type = 'scale' and name = '몸 상태' and high_is_bad = false;
commit;
