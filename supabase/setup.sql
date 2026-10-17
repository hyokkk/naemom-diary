-- ============================================================
-- 내몸일기 — Supabase 설정 (처음 설치용)
--
-- ⚠ 이 스크립트는 기존 테이블을 모두 지우고 새로 만든다.
--   이미 쓰고 있는 DB에는 실행하지 말 것. 데이터가 전부 삭제된다.
--   이미 설치된 DB를 올릴 때는 migration_*.sql 을 쓴다.
--
-- Supabase 대시보드 > SQL Editor > New query 에 붙여넣고 Run
-- ============================================================

drop table if exists regular_med_logs cascade;
drop table if exists hospital_visits  cascade;
drop table if exists symptom_records  cascade;
drop table if exists symptom_options  cascade;
drop table if exists symptoms         cascade;
drop table if exists onetime_meds     cascade;
drop table if exists supplement_logs  cascade;
drop table if exists medications      cascade;
drop table if exists meals            cascade;
drop table if exists daily_records    cascade;
drop table if exists item_options     cascade;
drop table if exists items            cascade;


-- 1) 기록 항목 ---------------------------------------------
-- type: scale(단계형) / choice(선택형) / number(숫자) / bool(예/아니오) / meal(식사) / text(텍스트)
-- 삭제 대신 is_hidden 으로 숨긴다. 지난 기록은 남는다.
create table items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('scale','choice','number','bool','meal','text')),
  unit        text,
  sort_order  int  not null default 0,
  is_hidden   boolean not null default false,
  has_note    boolean not null default false,  -- 예/아니오 항목: '예'일 때 내용 칸 표시 (내용은 daily_records.value_text)
  high_is_bad boolean not null default false,  -- 단계형 항목: 숫자가 높을수록 나쁜 상태 (몸 상태는 true)
  created_at  timestamptz not null default now()
);
create index items_user_idx on items (user_id);

-- 2) 단계형/선택형 선택지 ------------------------------------
-- 단계형의 단계 값은 sort_order 순서(위에서부터 1, 2, 3…)로 계산한다.
create table item_options (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  label       text not null,
  sort_order  int  not null default 0,
  is_hidden   boolean not null default false
);
create index item_options_user_idx on item_options (user_id);

-- 3) 날짜별 기록 (항목당 하루 1건) ----------------------------
create table daily_records (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  item_id     uuid not null references items(id) on delete cascade,
  value_num   numeric,
  value_bool  boolean,
  value_text  text,
  option_id   uuid references item_options(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date, item_id)
);

-- 4) 끼니 기록 ----------------------------------------------
-- 사진은 Storage 버킷 meal-photos 에 두고 경로만 저장한다.
create table meals (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  meal_type   text not null check (meal_type in ('breakfast','lunch','dinner')),
  note        text,
  photo_path  text,
  thumb_path  text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date, meal_type)
);

-- 5) 정기 복용 약 / 영양제 -----------------------------------
-- end_date 가 비어 있으면 계속 복용 중
create table medications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('regular','supplement')),
  name        text not null,
  start_date  date not null,
  end_date    date,
  note        text,
  created_at  timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index medications_user_idx on medications (user_id);

-- 6) 영양제 복용 체크 (행이 있으면 복용) ------------------------
create table supplement_logs (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null,
  medication_id  uuid not null references medications(id) on delete cascade,
  primary key (user_id, date, medication_id)
);

-- 7) 일회성 복용 약 (symptom: 먹은 이유, effect: 차도) ------------
create table onetime_meds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  name        text not null,
  symptom     text,
  effect      text,
  created_at  timestamptz not null default now()
);
create index onetime_meds_user_idx on onetime_meds (user_id, date);


-- 8) 몸 상태 주요 증상 (v1.1) -----------------------------
-- 단계형 항목(몸 상태)에 딸린 증상 목록과 증상별 선택지
create table symptoms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  is_hidden   boolean not null default false
);
create index symptoms_user_idx on symptoms (user_id);

create table symptom_options (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symptom_id  uuid not null references symptoms(id) on delete cascade,
  label       text not null,
  sort_order  int  not null default 0,
  is_hidden   boolean not null default false
);
create index symptom_options_user_idx on symptom_options (user_id);

-- 날짜별 증상 체크. 행이 있으면 체크, option_id 가 비어 있으면 정도 미기록
create table symptom_records (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  symptom_id  uuid not null references symptoms(id) on delete cascade,
  option_id   uuid references symptom_options(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date, symptom_id)
);


-- 9) 병원 치료 일지 (v1.2) — 하루 1건, 행이 있으면 "치료 받은 날" ----
create table hospital_visits (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  hospital    text,
  treatment   text,
  note        text,
  next_date   date,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);


-- 10) 정기 복용 약의 날짜별 복용 체크 (v1.4) — 행이 있으면 복용, effect 는 차도 ----
create table regular_med_logs (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null,
  medication_id  uuid not null references medications(id) on delete cascade,
  effect         text,
  updated_at     timestamptz not null default now(),
  primary key (user_id, date, medication_id)
);


-- 11) 권한: 로그인한 본인 행만 읽고 쓴다
-- (Supabase 검사기가 반복문 안을 읽지 못해 RLS 경고를 띄우므로, 켜는 문장은 따로 적어 둔다)
alter table items enable row level security;
alter table item_options enable row level security;
alter table daily_records enable row level security;
alter table meals enable row level security;
alter table medications enable row level security;
alter table supplement_logs enable row level security;
alter table onetime_meds enable row level security;
alter table symptoms enable row level security;
alter table symptom_options enable row level security;
alter table symptom_records enable row level security;
alter table hospital_visits enable row level security;
alter table regular_med_logs enable row level security;
 ------------------------
do $$
declare t text;
begin
  foreach t in array array['items','item_options','daily_records','meals','medications','supplement_logs','onetime_meds','symptoms','symptom_options','symptom_records','hospital_visits','regular_med_logs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;


-- 12) 사진 버킷 (비공개) ---------------------------------------
-- 경로 규칙: <사용자 ID>/<날짜>/<끼니>-<시각>.jpg
-- 첫 폴더 이름이 본인 ID인 파일만 읽고 쓸 수 있다.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists meal_photos_select on storage.objects;
drop policy if exists meal_photos_insert on storage.objects;
drop policy if exists meal_photos_update on storage.objects;
drop policy if exists meal_photos_delete on storage.objects;

create policy meal_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy meal_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy meal_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy meal_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
