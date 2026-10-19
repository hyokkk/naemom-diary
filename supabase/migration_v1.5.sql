-- ============================================================
-- 내몸일기 v1.4 → v1.5 (기존 데이터 유지)
-- 식사 증상 칸, 치료 일지 사진(처방전/소견서 등), 캘린더 기본 표시 설정
-- 여러 번 실행해도 안전하다.
-- Supabase 대시보드 > SQL Editor > New query 에 붙여넣고 Run
-- ============================================================

begin;

-- 1) 끼니별 증상
alter table meals add column if not exists symptom text;

-- 2) 치료 일지 사진
create table if not exists visit_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  visit_date  date not null,
  photo_path  text not null,
  thumb_path  text,
  created_at  timestamptz not null default now(),
  foreign key (user_id, visit_date) references hospital_visits(user_id, date) on delete cascade on update cascade
);
create index if not exists visit_photos_user_idx on visit_photos (user_id, visit_date);

-- 3) 사용자 설정
create table if not exists user_settings (
  user_id       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cal_defaults  jsonb,
  updated_at    timestamptz not null default now()
);

-- 4) 권한: 본인 행만
alter table visit_photos enable row level security;
alter table user_settings enable row level security;
drop policy if exists own_rows on visit_photos;
create policy own_rows on visit_photos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_rows on user_settings;
create policy own_rows on user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on visit_photos from anon;
revoke all on user_settings from anon;
grant select, insert, update, delete on visit_photos to authenticated;
grant select, insert, update, delete on user_settings to authenticated;

commit;
