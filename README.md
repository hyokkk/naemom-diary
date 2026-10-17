# 내몸일기

매일의 몸 상태와 식사, 운동, 약을 기록하고 캘린더와 리포트로 확인하는 개인 건강 기록 웹앱.

## 폴더 구조

| 경로 | 내용 | 직접 수정 |
|---|---|---|
| `src/app.js` | 앱 원본 코드 | ✅ 여기를 고친다 |
| `template.html` | HTML 껍데기 (메타 태그, 화면 스타일) | 가끔 |
| `supabase/setup.sql` | 처음 설치용 SQL (기존 테이블을 지운다) | 구조 변경 시 |
| `supabase/migration_*.sql` | 쓰고 있는 DB를 올리는 SQL (데이터 유지) | 구조 변경 시 |
| `docs/설계서.md` | 설계서 | ✅ |
| `site/` | 아이콘/매니페스트 등 정적 파일 | 아이콘 교체 시 |
| `dist/` | **배포용 폴더** | ❌ 빌드로만 생성 |
| `test/` | 자동 테스트 | |
| `build.mjs`, `package.json` | 빌드 설정 | 거의 안 함 |

`dist/` 안의 파일은 압축된 결과물이라 사람이 고칠 수 없다. 항상 `src/app.js`를 고친 뒤 빌드한다.

## 처음 설치

### 1. Supabase 프로젝트

1. Supabase에서 새 프로젝트를 만든다 (Region: Seoul). 무료 플랜은 활성 프로젝트가 2개까지라 dayshare와 이 앱으로 자리가 찬다.
2. SQL Editor → New query에 `supabase/setup.sql`을 붙여넣고 Run.
3. Authentication 설정에서 **이메일 확인(Confirm email)을 끈다.** 아이디를 내부적으로 `아이디@naemom.app` 이메일로 바꿔 쓰기 때문에, 확인 메일을 받을 수 없다.
4. Project Settings → API에서 Project URL과 anon public key(또는 publishable key)를 복사해 `src/app.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`에 넣고 빌드한다.

> service_role 키는 절대로 코드에 넣지 않는다.

### 2. 계정 만들기와 가입 막기

1. 배포한 사이트에서 "처음이라면 계정 만들기"로 아이디와 비밀번호를 만든다.
2. 계정을 만든 뒤 Supabase Authentication 설정에서 **새 가입 허용(Allow new users to sign up)을 끈다.** 이렇게 하면 주소를 아는 다른 사람이 계정을 만들 수 없다.

Supabase 대시보드의 메뉴 이름과 위치는 개편에 따라 달라질 수 있다.

## 테스트

```bash
npm test
```

`src/app.js`를 테스트용으로 묶은 뒤, 가짜 Supabase(인증/DB/사진 저장소)와 가상 브라우저로 가입부터 기록, 사진, 약/영양제, 항목 설정, 캘린더, 리포트, 로그아웃, 사용자 간 권한 분리까지 확인한다.

## 빌드

Node.js 18 이상 필요.

```bash
npm install
npm run build
```

## 배포

1. Netlify → Add new site → Deploy manually (이후에는 사이트 → Deploys)
2. **`dist` 폴더를 통째로** 끌어다 놓기 (폴더 안의 파일들이 아니라 폴더 자체)
3. `dist` 안의 파일 이름은 바꾸지 않는다. 아이콘은 사이트 루트(`/apple-touch-icon.png`)에서 찾으므로 위치가 바뀌면 안 된다

테이블 구조가 바뀌는 수정이면 **Supabase SQL을 먼저 실행한 뒤** 배포한다.

> ⚠ `supabase/setup.sql`은 기존 테이블을 모두 지우고 새로 만든다. 이미 쓰고 있는 DB에는 실행하지 말고, `migration_*.sql`을 쓴다.
> 구조를 바꿀 때는 setup.sql(새 설치용)과 migration 파일(기존 DB용)을 함께 갱신한다.

## 외부 서비스

- DB/인증/사진: Supabase (Region: Seoul), 사진 버킷 `meal-photos` (비공개)
- 호스팅: Netlify

## 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 1.0.0 | 2026-10-16 | 첫 버전. 설계서 v1 기준으로 프로토타입을 Supabase 연결 웹앱으로 구현 |
| 1.1.0 | 2026-10-16 | 몸 상태 주요 증상 체크(증상별 선택지 편집), 캘린더/모아보기/리포트 반영. 이미 setup.sql을 실행한 DB는 **`migration_v1.1.sql` 실행 필요 (데이터 유지)** |
| 1.2.0 | 2026-10-16 | 일회성 약의 증상/차도, 병원 치료 체크와 치료 일지 탭, 캘린더 병원 표시와 필터 순서 변경. 이미 setup.sql을 실행한 DB는 **`migration_v1.2.sql` 실행 필요 (데이터 유지)** |
| 1.3.0 | 2026-10-17 | 간식 '예' 옆에 어떤 간식이었는지 적는 칸, 예/아니오 항목별 내용 칸 켜기/끄기, 캘린더/모아보기/리포트에 내용 표시. 이미 setup.sql을 실행한 DB는 **`migration_v1.3.sql` 실행 필요 (데이터 유지)** |
