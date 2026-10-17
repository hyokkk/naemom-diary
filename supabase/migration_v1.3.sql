-- ============================================================
-- 내몸일기 v1.3 — 예/아니오 항목의 내용 칸 (예: 어떤 간식이었는지)
--
-- 이미 setup.sql 을 실행해 쓰고 있는 DB에 실행한다. 기존 데이터는 그대로 남는다.
-- 이전 버전 DB라면 migration_v1.1.sql, migration_v1.2.sql 을 먼저 순서대로 실행한다.
-- setup.sql 을 아직 실행하지 않았다면 이 파일은 필요 없다 (setup.sql 에 포함됨).
--
-- Supabase 대시보드 > SQL Editor > New query 에 붙여넣고 Run
-- ============================================================

-- 내용 자체는 기존 daily_records.value_text 칸에 저장하므로 기록 테이블은 바꾸지 않는다.
alter table items add column if not exists has_note boolean not null default false;

-- 기본 항목 '간식'은 내용 칸을 켠다
update items set has_note = true where type = 'bool' and name = '간식';
