-- ============================================================
-- 내몸일기 v1.5 → v1.6 (기존 데이터 유지)
-- 일기 탭, 캘린더 항목 숨김 설정, 운동/요가 메모 칸
-- 여러 번 실행해도 안전하다.
-- Supabase 대시보드 > SQL Editor > New query 에 붙여넣고 Run
-- ============================================================

begin;

-- 1) 일기
create table if not exists diary_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  title       text,
  body        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists diary_entries_user_idx on diary_entries (user_id, date);

alter table diary_entries enable row level security;
drop policy if exists own_rows on diary_entries;
create policy own_rows on diary_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on diary_entries from anon;
grant select, insert, update, delete on diary_entries to authenticated;

-- 2) 캘린더 위쪽 목록에서 뺀 항목
alter table user_settings add column if not exists cal_hidden jsonb;

-- 3) 운동/요가에 "무엇을 했는지" 적는 칸 켜기
--    (다시 실행하면 설정 화면에서 끈 것도 다시 켜진다)
update items set has_note = true where type = 'bool' and name in ('운동', '요가') and has_note = false;

commit;
