import { createClient } from "@supabase/supabase-js";

/* ============================================================
   내몸일기 — 개인 건강 기록 웹앱
   화면은 아티팩트 프로토타입과 같고, 데이터는 Supabase에 저장한다.
   ============================================================ */

/* ---------- Supabase 연결 ----------
   anon key는 브라우저에 공개되는 값이다. 데이터는 RLS로 본인 행만 접근된다.
   service_role 키는 절대로 여기에 넣지 않는다.
------------------------------------------- */
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

/* 아이디를 Supabase 인증용 이메일로 바꿀 때 붙이는 도메인. 실제로 메일을 보내지 않는다.
   이미 만든 계정이 있으면 바꾸지 않는다. 바꾸면 기존 아이디로 로그인할 수 없다. */
const ID_DOMAIN = "naemom.app";
const BUCKET = "meal-photos";

const configured = /^https:\/\//.test(SUPABASE_URL) && !SUPABASE_ANON_KEY.startsWith("YOUR_");
const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "naemom-auth" },
    })
  : null;

/* ---------- 날짜 ---------- */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = (s) => { const [a, b, c] = s.split("-").map(Number); return new Date(a, b - 1, c); };
const add = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
let TODAY = ymd(new Date());
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const monday = (s) => { const d = pd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const md = (s) => { const d = pd(s); return `${d.getMonth() + 1}.${d.getDate()}`; };
const dlabel = (s) => { const d = pd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`; };
const lastDay = (m) => { const [a, b] = m.split("-").map(Number); return ymd(new Date(a, b, 0)); };
const uuid = () => crypto.randomUUID();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const TYPES = { scale: "단계형", choice: "선택형", number: "숫자", bool: "예/아니오", meal: "식사", text: "텍스트" };
const MEALS = [["b", "아침"], ["l", "점심"], ["d", "저녁"]];
const MEAL_DB = { b: "breakfast", l: "lunch", d: "dinner" };
const MEAL_KEY = { breakfast: "b", lunch: "l", dinner: "d" };
const ICON = {
  today: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M9 10h6M9 14h6M9 18h3"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  rep: '<svg viewBox="0 0 24 24"><path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg>',
  med: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-40 12 12)"/><path d="M10.5 7.2l6.3 7.6"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};

/* ---------- 상태 ----------
   S: DB에서 불러온 데이터를 화면용 구조로 바꾼 것
   UI: 화면 상태 (기기의 브라우저 저장소에 사용자별로 보관)
------------------------------------------- */
let PHASE = "boot"; // boot | login | loading | app | setup | error
let USER = null;
let S = emptyState();
let UI = {};
let ARM = null, LOGIN_ERR = "", SIGNUP = false, LOAD_ERR = "", lastLoad = 0;

function emptyState() { return { items: [], rec: {}, meal: {}, meds: [], sup: {}, once: {} }; }
const uiKey = () => `naemom:ui:${USER ? USER.id : "-"}`;
function loadUI() {
  let u = {};
  try { u = JSON.parse(localStorage.getItem(uiKey()) || "{}"); } catch (e) {}
  UI = Object.assign({ view: "today", date: TODAY, cal: TODAY.slice(0, 7), calF: null, rep: "week", repA: TODAY, niType: "bool", open: {}, lvItem: null, lvSel: 1 }, u);
  if (UI.date > TODAY) UI.date = TODAY;
}
function saveUI() { try { localStorage.setItem(uiKey(), JSON.stringify(UI)); } catch (e) {} }

const active = (m, d) => m.start <= d && (!m.end || d <= m.end);
const visItems = () => S.items.filter((i) => !i.hidden);
const itemById = (id) => S.items.find((i) => i.id === id);
const recOf = (d, id) => (S.rec[d] || {})[id];
function symList(it, r) {
  if (!r || !r.sx) return [];
  return (it.symptoms || []).filter((y) => y.id in r.sx).map((y) => ({ y, op: y.options.find((x) => x.id === r.sx[y.id]) }));
}
const symLabel = (e) => `${esc(e.y.name)}${e.op ? " " + esc(e.op.label) : ""}`;
function score(it, r) { if (!r || !r.o) return null; const i = it.options.findIndex((x) => x.id === r.o); return i < 0 ? null : i + 1; }

let tt;
function toast(m) {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 2800);
}

/* ---------- DB 읽기 ---------- */
async function fetchAll(table, order) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select("*");
    for (const c of order) q = q.order(c, { ascending: true });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const DEFAULT_ITEMS = [
  ["몸 상태", "scale", null, ["매우 나쁨", "나쁨", "보통", "좋음", "매우 좋음"]],
  ["체중", "number", "kg"],
  ["운동", "bool"],
  ["요가", "bool"],
  ["간식", "bool"],
  ["삼시세끼", "meal"],
  ["배변", "choice", null, ["묽음", "정상", "단단함"]],
  ["기타 메모", "text"],
];
/* 몸 상태에 딸린 주요 증상 기본값. 증상마다 선택지를 설정 화면에서 바꿀 수 있다. */
const DEFAULT_SYMPTOMS = ["복부 팽만/가스", "속쓰림", "명치뭉침", "위 쥐어짬"];
const DEFAULT_SYMPTOM_OPTIONS = ["약함", "보통", "심함"];
async function createSymptomDefaults(itemId) {
  const sy = [], so = [];
  DEFAULT_SYMPTOMS.forEach((name, i) => {
    const id = uuid();
    sy.push({ id, user_id: USER.id, item_id: itemId, name, sort_order: i, is_hidden: false });
    DEFAULT_SYMPTOM_OPTIONS.forEach((label, j) => so.push({ id: uuid(), user_id: USER.id, symptom_id: id, label, sort_order: j, is_hidden: false }));
  });
  let r = await sb.from("symptoms").insert(sy);
  if (r.error) throw r.error;
  r = await sb.from("symptom_options").insert(so);
  if (r.error) throw r.error;
}
async function createDefaults() {
  const items = [], opts = [];
  DEFAULT_ITEMS.forEach(([name, type, unit, options], i) => {
    const id = uuid();
    items.push({ id, user_id: USER.id, name, type, unit: unit || null, sort_order: i, is_hidden: false });
    (options || []).forEach((label, j) => opts.push({ id: uuid(), user_id: USER.id, item_id: id, label, sort_order: j, is_hidden: false }));
  });
  let r = await sb.from("items").insert(items);
  if (r.error) throw r.error;
  r = await sb.from("item_options").insert(opts);
  if (r.error) throw r.error;
  await createSymptomDefaults(items[0].id);
}

async function loadAll() {
  const [items, opts, recs, meals, meds, sups, onces, syms, symOpts, symRecs] = await Promise.all([
    fetchAll("items", ["sort_order", "id"]),
    fetchAll("item_options", ["sort_order", "id"]),
    fetchAll("daily_records", ["date", "item_id"]),
    fetchAll("meals", ["date", "meal_type"]),
    fetchAll("medications", ["start_date", "id"]),
    fetchAll("supplement_logs", ["date", "medication_id"]),
    fetchAll("onetime_meds", ["date", "created_at", "id"]),
    fetchAll("symptoms", ["sort_order", "id"]),
    fetchAll("symptom_options", ["sort_order", "id"]),
    fetchAll("symptom_records", ["date", "symptom_id"]),
  ]);
  if (!items.length) { await createDefaults(); return loadAll(); }
  /* v1.0에서 가입해 주요 증상이 없는 계정은 몸 상태에 기본 증상을 만들어 준다 */
  if (!syms.length) {
    const base = items.find((x) => x.type === "scale" && x.name === "몸 상태") || items.find((x) => x.type === "scale");
    if (base) { await createSymptomDefaults(base.id); return loadAll(); }
  }
  const s = emptyState();
  s.items = items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({ id: r.id, name: r.name, type: r.type, unit: r.unit || "", hidden: r.is_hidden, options: [], symptoms: [] }));
  for (const o of opts.sort((a, b) => a.sort_order - b.sort_order)) {
    const it = s.items.find((x) => x.id === o.item_id);
    if (it) it.options.push({ id: o.id, label: o.label, hidden: o.is_hidden });
  }
  const symIndex = {};
  for (const y of syms.sort((a, b) => a.sort_order - b.sort_order)) {
    const it = s.items.find((x) => x.id === y.item_id); if (!it) continue;
    const sy = { id: y.id, name: y.name, hidden: y.is_hidden, options: [] };
    it.symptoms.push(sy); symIndex[y.id] = [it, sy];
  }
  for (const o of symOpts.sort((a, b) => a.sort_order - b.sort_order)) {
    const e = symIndex[o.symptom_id]; if (e) e[1].options.push({ id: o.id, label: o.label, hidden: o.is_hidden });
  }
  for (const r of recs) {
    const it = s.items.find((x) => x.id === r.item_id); if (!it) continue;
    let v;
    if (it.type === "scale") v = r.option_id ? { o: r.option_id } : null;
    else if (it.type === "choice") v = r.value_bool == null ? null : { v: r.value_bool, o: r.value_bool ? r.option_id || undefined : undefined };
    else if (it.type === "number") v = r.value_num == null ? null : { v: Number(r.value_num) };
    else if (it.type === "bool") v = r.value_bool == null ? null : { v: r.value_bool };
    else if (it.type === "text") v = r.value_text ? { v: r.value_text } : null;
    if (v) (s.rec[r.date] = s.rec[r.date] || {})[r.item_id] = v;
  }
  for (const x of symRecs) {
    const e = symIndex[x.symptom_id]; if (!e) continue;
    const day = (s.rec[x.date] = s.rec[x.date] || {}), rec = (day[e[0].id] = day[e[0].id] || {});
    (rec.sx = rec.sx || {})[x.symptom_id] = x.option_id || null;
  }
  for (const m of meals) {
    (s.meal[m.date] = s.meal[m.date] || {})[MEAL_KEY[m.meal_type]] = { t: m.note || "", p: m.photo_path || null, th: m.thumb_path || null };
  }
  s.meds = meds.map((m) => ({ id: m.id, kind: m.kind, name: m.name, start: m.start_date, end: m.end_date || "", note: m.note || "" }));
  for (const l of sups) (s.sup[l.date] = s.sup[l.date] || {})[l.medication_id] = true;
  for (const o of onces) (s.once[o.date] = s.once[o.date] || []).push({ id: o.id, n: o.name, note: o.note || "" });
  S = s;
  lastLoad = Date.now();
  if (!Array.isArray(UI.calF)) { const c = s.items.find((x) => x.type === "scale"); UI.calF = [c ? c.id : null, "supp"].filter(Boolean); saveUI(); }
}

/* ---------- DB 쓰기 ----------
   화면을 먼저 바꾸고 저장은 뒤에서 한다. 실패하면 알림을 띄운다.
------------------------------------------- */
let pending = 0;
async function run(label, ...queries) {
  pending++;
  try {
    for (const q of queries) {
      const { error } = await q;
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.error(label, e);
    toast(`${label}을(를) 저장하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`);
    return false;
  } finally { pending--; }
}
const now = () => new Date().toISOString();

function recRow(it, d, val) {
  const row = { user_id: USER.id, date: d, item_id: it.id, value_num: null, value_bool: null, value_text: null, option_id: null, updated_at: now() };
  if (it.type === "scale") row.option_id = val.o;
  else if (it.type === "choice") { row.value_bool = val.v; row.option_id = val.v && val.o ? val.o : null; }
  else if (it.type === "number") row.value_num = val.v;
  else if (it.type === "bool") row.value_bool = val.v;
  else if (it.type === "text") row.value_text = val.v;
  return row;
}
function setRec(d, id, val) {
  S.rec[d] = S.rec[d] || {};
  if (val == null) delete S.rec[d][id]; else S.rec[d][id] = val;
  const it = itemById(id);
  if (val == null) return run("기록", sb.from("daily_records").delete().eq("date", d).eq("item_id", id));
  return run("기록", sb.from("daily_records").upsert(recRow(it, d, val), { onConflict: "user_id,date,item_id" }));
}
/* 단계형 기록: 단계(daily_records)와 주요 증상(symptom_records)을 따로 저장한다 */
function setLocal(d, id, val) { S.rec[d] = S.rec[d] || {}; if (val == null) delete S.rec[d][id]; else S.rec[d][id] = val; }
function patchScale(d, it, patch) {
  const n = Object.assign({}, recOf(d, it.id) || {}, patch);
  if (n.o == null) delete n.o;
  if (n.sx && !Object.keys(n.sx).length) delete n.sx;
  setLocal(d, it.id, Object.keys(n).length ? n : null);
}
function setScaleLevel(d, it, o) {
  patchScale(d, it, { o });
  if (!o) return run("몸 상태", sb.from("daily_records").delete().eq("date", d).eq("item_id", it.id));
  return run("몸 상태", sb.from("daily_records").upsert(recRow(it, d, { o }), { onConflict: "user_id,date,item_id" }));
}
function setSymptom(d, it, sid, val) { // val: undefined = 체크 해제, null = 정도 미기록, 문자열 = 선택지 ID
  const sx = Object.assign({}, (recOf(d, it.id) || {}).sx);
  if (val === undefined) delete sx[sid]; else sx[sid] = val;
  patchScale(d, it, { sx });
  if (val === undefined) return run("주요 증상", sb.from("symptom_records").delete().eq("date", d).eq("symptom_id", sid));
  return run("주요 증상", sb.from("symptom_records").upsert({ user_id: USER.id, date: d, symptom_id: sid, option_id: val }, { onConflict: "user_id,date,symptom_id" }));
}
function saveMeal(d, k) {
  const m = (S.meal[d] || {})[k] || {};
  if (!m.t && !m.p) {
    if (S.meal[d]) delete S.meal[d][k];
    return run("식사 기록", sb.from("meals").delete().eq("date", d).eq("meal_type", MEAL_DB[k]));
  }
  return run("식사 기록", sb.from("meals").upsert(
    { user_id: USER.id, date: d, meal_type: MEAL_DB[k], note: m.t || null, photo_path: m.p || null, thumb_path: m.th || null, updated_at: now() },
    { onConflict: "user_id,date,meal_type" }));
}
function saveItemOrder() {
  return run("항목 순서", ...S.items.map((it, i) => sb.from("items").update({ sort_order: i }).eq("id", it.id)));
}
function saveOptionOrder(it) {
  return run("선택지 순서", ...it.options.map((o, i) => sb.from("item_options").update({ sort_order: i }).eq("id", o.id)));
}

/* ---------- 사진 ----------
   비공개 버킷이라 화면에는 1시간짜리 서명 주소로 불러온다.
------------------------------------------- */
const URLS = {}; // path -> { url, at }
const wanted = new Set();
let urlTimer = null;
function photoUrl(path) {
  if (!path) return null;
  const c = URLS[path];
  if (c && Date.now() - c.at < 50 * 60 * 1000) return c.url;
  wanted.add(path);
  if (!urlTimer) urlTimer = setTimeout(fetchUrls, 0);
  return c ? c.url : null;
}
async function fetchUrls() {
  urlTimer = null;
  const paths = [...wanted]; wanted.clear();
  if (!paths.length) return;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) { console.error(error); return; }
  for (const x of data) if (x.signedUrl) URLS[x.path] = { url: x.signedUrl, at: Date.now() };
  render();
}
function toBlob(file, max, q) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("image")); };
    img.src = url;
  });
}
async function removePhotos(paths) {
  const ps = paths.filter(Boolean);
  if (ps.length) await run("사진 삭제", sb.storage.from(BUCKET).remove(ps));
}

/* ---------- 렌더 ---------- */
const app = () => document.getElementById("app");
function render() {
  TODAY = ymd(new Date());
  const el = app(); if (!el) return;
  if (PHASE === "setup") { el.innerHTML = vSetup(); return; }
  if (PHASE === "boot" || PHASE === "loading") { el.innerHTML = '<div class="boot">불러오는 중…</div>'; return; }
  if (PHASE === "error") {
    el.innerHTML = `<div class="login"><h1>내몸일기</h1><p class="err">${esc(LOAD_ERR)}</p><button class="btn" data-act="retry">다시 시도</button><button class="btn ghost" data-act="logout">로그아웃</button></div>`;
    return;
  }
  if (PHASE === "login") { el.innerHTML = vLogin(); return; }
  const v = UI.view;
  const views = { today: vToday, cal: vCal, rep: vRep, med: vMed, set: vSet, lv: vLv };
  el.innerHTML = `<header class="top"><p class="brand">내몸일기</p><button class="iconbtn${v === "set" ? " on" : ""}" data-act="nav" data-v="set" aria-label="항목 설정">${ICON.gear}</button></header>
 <main>${(views[v] || vToday)()}</main>
 <nav class="tabs"><div class="tabs-in">${[["today", "오늘 기록"], ["cal", "캘린더"], ["rep", "리포트"], ["med", "약/영양제"]].map(([k, l]) => `<button class="tab" data-act="nav" data-v="${k}" ${v === k || (v === "lv" && k === "cal") ? 'aria-current="page"' : ""}>${ICON[k]}${l}</button>`).join("")}</div></nav>`;
}
function armBtn(key, label, cls) { const on = ARM === key; return `<button class="${cls}${on ? " armed" : ""}" data-act="arm" data-k="${key}">${on ? "한 번 더 누르면 실행" : label}</button>`; }

function vSetup() {
  return `<div class="login"><h1>내몸일기</h1><p class="muted">Supabase 연결 정보가 아직 설정되지 않았습니다.</p>
  <p class="small muted">src/app.js 의 SUPABASE_URL 과 SUPABASE_ANON_KEY 를 채운 뒤 다시 빌드해 주세요.</p></div>`;
}
function vLogin() {
  return `<form class="login" id="lgform" autocomplete="on">
  <h1>내몸일기</h1>
  <p class="muted" style="margin:0">${SIGNUP ? "로그인에 쓸 아이디와 비밀번호를 정해 주세요." : "아이디와 비밀번호로 로그인해 주세요."}</p>
  <input type="text" id="lg-id" placeholder="아이디" autocomplete="username" autocapitalize="none" spellcheck="false" required>
  <input type="password" id="lg-pw" placeholder="비밀번호 (6자 이상)" autocomplete="${SIGNUP ? "new-password" : "current-password"}" required>
  ${SIGNUP ? '<input type="password" id="lg-pw2" placeholder="비밀번호 확인" autocomplete="new-password" required>' : ""}
  <div class="err">${esc(LOGIN_ERR)}</div>
  <button class="btn" type="submit">${SIGNUP ? "계정 만들고 시작하기" : "로그인"}</button>
  <button class="link" type="button" data-act="mode">${SIGNUP ? "이미 계정이 있어요" : "처음이라면 계정 만들기"}</button>
  ${SIGNUP ? '<p class="small muted" style="margin:0">아이디는 영문 소문자, 숫자, 점(.), 밑줄(_), 하이픈(-)으로 3~20자입니다.</p>' : ""}
 </form>`;
}

/* today */
function vToday() {
  const d = UI.date;
  let h = `<div class="datebar"><button class="iconbtn" data-act="dshift" data-n="-1" aria-label="이전 날">‹</button>
  <div class="mid"><div class="d">${dlabel(d)}</div>${d === TODAY ? '<span class="small muted">오늘</span>' : '<button class="link" data-act="dtoday">오늘로 이동</button>'}</div>
  <button class="iconbtn" data-act="dshift" data-n="1" aria-label="다음 날" ${d >= TODAY ? "disabled" : ""}>›</button></div><div class="stack">`;
  for (const it of visItems()) h += itemCard(it, d, recOf(d, it.id));
  return h + medCard(d) + "</div>";
}
function itemCard(it, d, r) {
  let body = "", hint = "";
  if (it.type === "scale") {
    const os = it.options.filter((x) => !x.hidden);
    body = `<div class="scale" style="--n:${os.length}">${os.map((x) => { const n = it.options.indexOf(x) + 1; return `<button class="chip${r && r.o === x.id ? " on" : ""}" data-act="pick" data-i="${it.id}" data-o="${x.id}"><b>${n}</b><span>${esc(x.label)}</span></button>`; }).join("")}</div>`;
    const sys = (it.symptoms || []).filter((y) => !y.hidden), sx = (r && r.sx) || {};
    if (sys.length) body += `<div class="sym"><div class="ttl"><span>주요 증상</span><span>${Object.keys(sx).length}개 체크</span></div>${sys.map((y) => {
      const on = y.id in sx;
      return `<div class="symrow"><button class="chip sm${on ? " on" : ""}" data-act="sym" data-i="${it.id}" data-s="${y.id}" aria-pressed="${on}">${esc(y.name)}</button>${on ? `<span class="lvl">${y.options.filter((x) => !x.hidden || x.id === sx[y.id]).map((x) => `<button class="chip sm${sx[y.id] === x.id ? " on" : ""}" data-act="symopt" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}">${esc(x.label)}</button>`).join("")}</span>` : ""}</div>`;
    }).join("")}</div>`;
  } else if (it.type === "number") {
    body = `<div class="numin"><input type="number" inputmode="decimal" step="0.1" id="n-${it.id}" data-ch="num" data-i="${it.id}" value="${r ? r.v : ""}" placeholder="0.0"><span class="muted">${esc(it.unit || "")}</span></div>`;
  } else if (it.type === "bool" || it.type === "choice") {
    const L = it.type === "bool" ? ["예", "아니오"] : ["있음", "없음"];
    body = `<div class="seg">${[[true, L[0]], [false, L[1]]].map(([v, l]) => `<button class="chip${r && r.v === v ? " on" : ""}" data-act="bool" data-i="${it.id}" data-v="${v}">${l}</button>`).join("")}</div>`;
    if (it.type === "choice" && r && r.v) body += `<div class="seg" style="margin-top:8px">${it.options.filter((x) => !x.hidden || x.id === r.o).map((x) => `<button class="chip sm${r.o === x.id ? " on" : ""}" data-act="pick" data-i="${it.id}" data-o="${x.id}">${esc(x.label)}</button>`).join("")}</div>`;
  } else if (it.type === "meal") {
    const m = S.meal[d] || {};
    body = MEALS.map(([k, l]) => {
      const x = m[k] || {};
      let ph;
      if (x.th) {
        const u = photoUrl(x.th);
        ph = `<div class="thumbwrap">${u ? `<img class="thumb" src="${esc(u)}" alt="${l} 사진" data-act="photo" data-k="${k}">` : '<span class="thumb ph"></span>'}<button class="x" data-act="photodel" data-k="${k}" aria-label="${l} 사진 삭제">×</button></div>`;
      } else ph = `<label class="photo" title="${l} 사진 첨부">${ICON.cam}<input type="file" accept="image/*" id="p-${k}" data-ch="photo" data-k="${k}" aria-label="${l} 사진 첨부"></label>`;
      return `<div class="meal"><span class="lb">${l}</span><input type="text" id="m-${k}" data-ch="meal" data-k="${k}" value="${esc(x.t || "")}" placeholder="무엇을 드셨나요?">${ph}</div>`;
    }).join("");
    hint = `${MEALS.filter(([k]) => m[k] && (m[k].t || m[k].th)).length}/3 기록`;
  } else if (it.type === "text") {
    body = `<textarea id="t-${it.id}" data-ch="text" data-i="${it.id}" placeholder="오늘 특별히 남길 내용">${esc(r ? r.v : "")}</textarea>`;
  }
  if (!hint && it.type !== "meal") hint = r == null ? "기록 전" : "";
  return `<section class="card"><h3>${esc(it.name)}<small>${hint}</small></h3>${body}</section>`;
}
function medCard(d) {
  const sup = S.meds.filter((m) => m.kind === "supplement" && active(m, d));
  const reg = S.meds.filter((m) => m.kind === "regular" && active(m, d));
  const done = S.sup[d] || {}, once = S.once[d] || [];
  let h = `<section class="card"><h3>영양제<small>${sup.filter((m) => done[m.id]).length}/${sup.length} 복용</small></h3>`;
  h += sup.length
    ? sup.map((m) => `<label class="check"><input type="checkbox" id="s-${m.id}" data-ch="sup" data-m="${m.id}" ${done[m.id] ? "checked" : ""}><span>${esc(m.name)}${m.note ? ` <span class="small muted">${esc(m.note)}</span>` : ""}</span></label>`).join("")
    : '<p class="empty">이 날짜에 복용 기간인 영양제가 없습니다. 약/영양제 탭에서 등록할 수 있습니다.</p>';
  h += `</section><section class="card"><h3>복용 약</h3><p class="small muted" style="margin:0 0 6px">정기 복용 중</p>`;
  h += reg.length ? `<div class="seg">${reg.map((m) => `<span class="pill warm">${esc(m.name)}${m.end ? ` · ~${md(m.end)}` : ""}</span>`).join("")}</div>` : '<p class="empty">없음</p>';
  h += '<p class="small muted" style="margin:12px 0 0">일회성 복용</p>';
  h += once.map((x) => `<div class="once"><span>${esc(x.n)}${x.note ? ` <span class="small muted">${esc(x.note)}</span>` : ""}</span><button class="mini" data-act="oncedel" data-id="${x.id}">삭제</button></div>`).join("");
  h += '<div class="grid2"><input type="text" id="once-n" placeholder="약 이름"><input type="text" id="once-note" placeholder="메모 (선택)"><button class="btn sm" data-act="onceadd">추가</button></div></section>';
  return h;
}

/* calendar */
const CAT = ["--c1", "--c2", "--c6", "--c7", "--c8", "--c9", "--c10"];
function colorOf(k) {
  if (k === "supp") return "var(--c3)"; if (k === "reg") return "var(--c4)"; if (k === "once") return "var(--c5)"; if (k === "sym") return "var(--lv2)";
  const it = itemById(k); if (it && it.type === "scale") return "var(--lv5)";
  const i = S.items.filter((x) => x.type !== "scale").findIndex((x) => x.id === k);
  return `var(${CAT[Math.max(0, i) % CAT.length]})`;
}
const isScale = (k) => { const it = itemById(k); return !!it && it.type === "scale"; };
function lvOf(it, s) { const n = it.options.length; return n <= 1 ? 5 : Math.round(1 + (4 * (s - 1)) / (n - 1)); }
function lvCircle(k, d) { const it = itemById(k), s = score(it, recOf(d, k)); return s ? `<span class="lvc lv${lvOf(it, s)}" title="${esc(it.name)} ${s}단계">${s}</span>` : ""; }
function filterKeys() { return [...visItems().map((i) => ({ k: i.id, n: i.name })), ...(visItems().some((i) => i.symptoms && i.symptoms.length) ? [{ k: "sym", n: "주요 증상" }] : []), { k: "supp", n: "영양제" }, { k: "reg", n: "정기 복용 약" }, { k: "once", n: "일회성 약" }]; }
function calTag(k, d) {
  const T = (txt, cls) => `<span class="tg c${cls ? " " + cls : ""}" style="--c:${colorOf(k)}">${txt}</span>`;
  if (k === "supp") { const a = S.meds.filter((m) => m.kind === "supplement" && active(m, d)); if (!a.length) return ""; const t = a.filter((m) => (S.sup[d] || {})[m.id]).length; return T(`영양 ${t}/${a.length}`, t === a.length ? "solid" : ""); }
  if (k === "reg") { const a = S.meds.filter((m) => m.kind === "regular" && active(m, d)); return a.length ? T(esc(a.map((m) => m.name).join(", ")), "line") : ""; }
  if (k === "sym") { const es = visItems().flatMap((it) => symList(it, recOf(d, it.id))); return es.length ? `<span class="tg c" style="--c:${colorOf(k)}" title="${es.map(symLabel).join(", ")}">증상 ${es.length}</span>` : ""; }
  if (k === "once") { const a = S.once[d] || []; return a.length ? T(`${esc(a[0].n)}${a.length > 1 ? ` 외 ${a.length - 1}` : ""}`) : ""; }
  const it = itemById(k); if (!it) return "";
  if (it.type === "meal") { const m = S.meal[d] || {}; const n = MEALS.filter(([x]) => m[x] && (m[x].t || m[x].th)).length; return n ? T(`식사 ${n}/3`) : ""; }
  const r = recOf(d, k); if (r == null) return "";
  const sh = esc(it.name.slice(0, 2));
  if (it.type === "number") return T(`${r.v}${esc(it.unit || "")}`);
  if (it.type === "bool") return r.v ? T(sh, "solid") : "";
  if (it.type === "choice") { if (!r.v) return ""; const op = it.options.find((x) => x.id === r.o); return T(`${sh}${op ? " " + esc(op.label) : ""}`, "solid"); }
  if (it.type === "text") return r.v ? T("메모") : "";
  return "";
}
function vCal() {
  const m = UI.cal, [y, mo] = m.split("-").map(Number);
  const keys = filterKeys(), sel = (UI.calF || []).filter((k) => keys.some((x) => x.k === k));
  let h = `<div class="datebar"><button class="iconbtn" data-act="calshift" data-n="-1" aria-label="이전 달">‹</button><div class="mid"><div class="d">${y}년 ${mo}월</div>${m !== TODAY.slice(0, 7) ? '<button class="link" data-act="caltoday">이번 달로</button>' : ""}</div><button class="iconbtn" data-act="calshift" data-n="1" aria-label="다음 달">›</button></div>`;
  h += `<div class="filters">${keys.map((x) => `<button class="chip sm f${sel.includes(x.k) ? " on" : ""}" style="--c:${colorOf(x.k)}" data-act="calf" data-k="${x.k}" aria-pressed="${sel.includes(x.k)}"><i class="dot${isScale(x.k) ? " ramp" : ""}"></i>${esc(x.n)}</button>`).join("")}</div>`;
  h += `<div class="cal">${["월", "화", "수", "목", "금", "토", "일"].map((x) => `<div class="dow">${x}</div>`).join("")}`;
  const end = lastDay(m); let d = monday(m + "-01");
  while (d <= end || pd(d).getDay() !== 1) {
    const out = d.slice(0, 7) !== m, fut = d > TODAY;
    h += `<button class="cell${out ? " out" : ""}${fut ? " fut" : ""}${d === TODAY ? " today" : ""}" data-act="calday" data-d="${d}" ${fut ? "disabled" : ""} aria-label="${dlabel(d)}"><span class="hd"><span class="n">${pd(d).getDate()}</span>${fut ? "" : sel.filter(isScale).map((k) => lvCircle(k, d)).join("")}</span>${fut ? "" : sel.filter((k) => !isScale(k)).map((k) => calTag(k, d)).join("")}</button>`;
    d = add(d, 1);
  }
  h += `</div>${sel.filter(isScale).map((k) => { const it = itemById(k); return `<div class="legend"><span class="small muted">${esc(it.name)}: 단계를 누르면 그 단계로 기록한 날을 모아 볼 수 있습니다</span><div class="lgs">${it.options.map((x, j) => `<button class="lg" data-act="lvgo" data-i="${it.id}" data-n="${j + 1}"><span class="lvc lv${lvOf(it, j + 1)}">${j + 1}</span>${esc(x.label)}</button>`).join("")}</div></div>`; }).join("")}<p class="small muted">${sel.length ? "날짜를 누르면 그날의 기록 화면으로 이동합니다." : "위에서 보고 싶은 항목을 하나 이상 선택해 주세요."}</p>`;
  return h;
}

/* level collection */
function vLv() {
  const scales = S.items.filter((x) => x.type === "scale");
  const it = itemById(UI.lvItem) || scales[0];
  if (!it) return '<p class="empty">단계형 항목이 없습니다.</p>';
  const n = it.options.length, sel = Math.min(Math.max(1, UI.lvSel || 1), n);
  const all = Object.keys(S.rec).filter((d) => d <= TODAY).sort().reverse();
  const at = (k) => all.filter((d) => score(it, S.rec[d][it.id]) === k);
  const days = at(sel);
  let h = `<div class="datebar"><button class="iconbtn" data-act="nav" data-v="cal" aria-label="캘린더로 돌아가기">‹</button><div class="mid"><div class="d">${esc(it.name)} 모아보기</div><span class="small muted">${sel}단계로 기록한 날 ${days.length}일</span></div><span style="width:38px;flex:none"></span></div>`;
  if (scales.length > 1) h += `<div class="filters">${scales.map((x) => `<button class="chip sm${x.id === it.id ? " on" : ""}" data-act="lvitem" data-i="${x.id}">${esc(x.name)}</button>`).join("")}</div>`;
  h += `<div class="lvpick" style="--n:${n}">${it.options.map((x, j) => `<button class="${j + 1 === sel ? "on" : ""}" data-act="lvsel" data-n="${j + 1}" aria-pressed="${j + 1 === sel}"><span class="lvc lv${lvOf(it, j + 1)}">${j + 1}</span><span class="lb">${esc(x.label)}</span><small>${at(j + 1).length}일</small></button>`).join("")}</div>`;
  h += days.length ? `<div class="stack">${days.map((d) => dayRow(d, it)).join("")}</div>` : `<p class="empty">${sel}단계로 기록한 날이 아직 없습니다.</p>`;
  return h;
}
function dayRow(d, base) {
  const r = S.rec[d] || {}, tags = [], notes = [];
  for (const it of visItems()) {
    if (it.id === base.id) continue;
    const x = r[it.id], T = (t, c) => `<span class="tg c${c ? " " + c : ""}" style="--c:${colorOf(it.id)}">${t}</span>`;
    if (it.type === "meal") { const m = S.meal[d] || {}; const s = MEALS.filter(([k]) => m[k] && m[k].t).map(([k, l]) => `${l} ${m[k].t}`); if (s.length) notes.push(esc(s.join(" / "))); continue; }
    if (x == null) continue;
    if (it.type === "scale") { const s = score(it, x); if (s) tags.push(`<span class="tg c" style="--c:var(--lv${lvOf(it, s)});color:var(--ink)">${esc(it.name)} ${s}</span>`); }
    else if (it.type === "number") tags.push(T(`${esc(it.name)} ${x.v}${esc(it.unit || "")}`));
    else if (it.type === "bool") { if (x.v) tags.push(T(esc(it.name), "solid")); }
    else if (it.type === "choice") { if (x.v) { const op = it.options.find((o) => o.id === x.o); tags.push(T(`${esc(it.name)} ${op ? esc(op.label) : "있음"}`, "solid")); } }
    else if (it.type === "text" && x.v) notes.push("메모: " + esc(x.v));
  }
  const a = S.meds.filter((m) => m.kind === "supplement" && active(m, d));
  if (a.length) { const t = a.filter((m) => (S.sup[d] || {})[m.id]).length; tags.push(`<span class="tg c" style="--c:${colorOf("supp")}">영양제 ${t}/${a.length}</span>`); }
  symList(base, r[base.id]).forEach((e) => tags.push(`<span class="tg c solid" style="--c:var(--lv2)">${symLabel(e)}</span>`));
  const once = S.once[d] || [];
  if (once.length) tags.push(`<span class="tg c" style="--c:${colorOf("once")}">${esc(once.map((x) => x.n).join(", "))}</span>`);
  const sc = score(base, r[base.id]);
  return `<button class="dayrow" data-act="calday" data-d="${d}"><span class="dh"><strong>${dlabel(d)}</strong><span class="lvc lv${lvOf(base, sc)}">${sc}</span></span>${tags.length ? `<span class="sum">${tags.join("")}</span>` : ""}${notes.map((t) => `<span class="note">${t}</span>`).join("")}</button>`;
}

/* report */
function repRange() {
  const A = UI.repA;
  if (UI.rep === "week") { const s = monday(A); return [s, add(s, 6), `${md(s)} (월) ~ ${md(add(s, 6))} (일)`]; }
  if (UI.rep === "year") { const y = A.slice(0, 4); return [y + "-01-01", y + "-12-31", `${y}년`]; }
  const m = A.slice(0, 7), [y, mo] = m.split("-").map(Number); return [m + "-01", lastDay(m), `${y}년 ${mo}월`];
}
function daysOf(s, e) { const a = []; for (let d = s; d <= e; d = add(d, 1)) a.push(d); return a; }
function lineChart(vals, days, lo, hi) {
  const W = 320, H = 118, L = 36, R = 10, T = 10, B = 22, n = days.length;
  const X = (i) => L + (n === 1 ? 0 : ((W - L - R) * i) / (n - 1)), Y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  let p = "", dots = "";
  vals.forEach((v, i) => { if (v == null) return; p += (p ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); dots += `<circle class="dt" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${n > 10 ? 2 : 3}"/>`; });
  const mid = (lo + hi) / 2, f = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="일별 추이">${[hi, mid, lo].map((v) => `<line class="gr" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${f(v)}</text>`).join("")}<path class="ln" d="${p}"/>${dots}<text x="${L}" y="${H - 6}">${md(days[0])}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${md(days[n - 1])}</text></svg>`;
}
function mChart(vals, lo, hi, bars) {
  const W = 320, H = 124, L = 36, R = 8, T = 10, B = 24, cw = (W - L - R) / 12, X = (i) => L + cw * i + cw / 2, Y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const mid = (lo + hi) / 2, f = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
  const grid = [hi, mid, lo].map((v) => `<line class="gr" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L - 6}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${f(v)}</text>`).join("");
  let marks = "";
  if (bars) vals.forEach((v, i) => { if (v) marks += `<rect class="bx" x="${(X(i) - cw * 0.3).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(cw * 0.6).toFixed(1)}" height="${(Y(lo) - Y(v)).toFixed(1)}" rx="2"/>`; });
  else { let p = "", dots = ""; vals.forEach((v, i) => { if (v == null) return; p += (p ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); dots += `<circle class="dt" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3"/>`; }); marks = `<path class="ln" d="${p}"/>${dots}`; }
  const xl = vals.map((_, i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${i + 1}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 추이">${grid}${marks}${xl}</svg>`;
}
const bar = (lab, num, den, txt) => `<div class="brow"><span>${esc(lab)}</span><div class="bar"><i style="width:${den ? Math.round((100 * num) / den) : 0}%"></i></div><span class="v">${txt ?? `${num}/${den}`}</span></div>`;
const avg = (a) => (a.length ? a.reduce((x, z) => x + z, 0) / a.length : null);
const signed = (d, u) => `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)}${u}`;
function hasRec(it, past) { return past.some((d) => (it.type === "meal" ? S.meal[d] : recOf(d, it.id) != null)); }

function symCard(it, past) {
  if (!it.symptoms || !it.symptoms.length) return "";
  const rs = past.map((d) => recOf(d, it.id)).filter(Boolean), n = rs.length;
  return `<section class="card"><h3><span>${esc(it.name)} 주요 증상</span><small>기록 ${n}일 중</small></h3>${it.symptoms.map((y) => {
    const hit = rs.filter((r) => r.sx && y.id in r.sx);
    if (y.hidden && !hit.length) return "";
    const br = y.options.map((x) => [x.label, hit.filter((r) => r.sx[y.id] === x.id).length]).filter((a) => a[1]), none = hit.filter((r) => !r.sx[y.id]).length;
    const parts = [...br.map(([l, c]) => `${esc(l)} ${c}`), ...(none ? [`정도 미기록 ${none}`] : [])];
    return bar(y.name, hit.length, n, `${hit.length}일`) + (parts.length ? `<div class="small muted symbr">${parts.join(" / ")}</div>` : "");
  }).join("")}</section>`;
}
function vRep() {
  const [s, e, label] = repRange(), days = daysOf(s, e), past = days.filter((d) => d <= TODAY);
  let h = `<div class="row" style="justify-content:center;margin-bottom:10px"><div class="toggle">${[["week", "주간"], ["month", "월간"], ["year", "연간"]].map(([k, l]) => `<button class="${UI.rep === k ? "on" : ""}" data-act="repmode" data-k="${k}">${l}</button>`).join("")}</div></div>`;
  h += `<div class="datebar"><button class="iconbtn" data-act="repshift" data-n="-1" aria-label="이전 기간">‹</button><div class="mid"><div class="d">${label}</div><span class="small muted">기록 대상 ${past.length}일</span></div><button class="iconbtn" data-act="repshift" data-n="1" aria-label="다음 기간" ${e >= TODAY ? "disabled" : ""}>›</button></div><div class="stack">`;
  if (!past.length) return h + '<p class="empty">아직 지나지 않은 기간입니다.</p></div>';
  if (UI.rep === "year") return h + vYear(past) + "</div>";
  for (const it of S.items) {
    if (it.hidden && !hasRec(it, past)) continue;
    const tag = it.hidden ? ' <span class="pill">숨긴 항목</span>' : "";
    if (it.type === "scale") {
      const ok = past.map((d) => score(it, recOf(d, it.id))).filter((x) => x != null), a = avg(ok);
      h += `<section class="card"><h3><span>${esc(it.name)}${tag}</span><small>기록 ${ok.length}일</small></h3><div class="big">${a == null ? "-" : a.toFixed(1)}<small> / ${it.options.length} 평균</small></div>${ok.length ? lineChart(days.map((d) => (d <= TODAY ? score(it, recOf(d, it.id)) : null)), days, 1, it.options.length) : ""}</section>` + symCard(it, past);
    } else if (it.type === "number") {
      const v = days.map((d) => { const r = recOf(d, it.id); return r ? r.v : null; }), ok = v.filter((x) => x != null), u = esc(it.unit || "");
      if (ok.length) {
        const lo = Math.floor(Math.min(...ok) * 2 - 1) / 2, hi = Math.ceil(Math.max(...ok) * 2 + 1) / 2;
        h += `<section class="card"><h3><span>${esc(it.name)}${tag}</span><small>기록 ${ok.length}일</small></h3><div class="big">${ok[ok.length - 1]}<small> ${u}</small></div><div class="small muted">기간 처음 ${ok[0]}${u} → 마지막 ${ok[ok.length - 1]}${u} (${signed(ok[ok.length - 1] - ok[0], u)})</div>${lineChart(v, days, lo, hi)}</section>`;
      } else h += `<section class="card"><h3>${esc(it.name)}${tag}</h3><p class="empty">이 기간에 기록이 없습니다.</p></section>`;
    } else if (it.type === "bool") {
      const rs = past.map((d) => recOf(d, it.id)).filter(Boolean), y = rs.filter((r) => r.v).length;
      h += `<section class="card"><h3><span>${esc(it.name)}${tag}</span><small>기록 ${rs.length}일 중</small></h3><div class="big">${y}<small>일</small></div><div style="margin-top:8px">${bar("달성률", y, rs.length, rs.length ? Math.round((100 * y) / rs.length) + "%" : "-")}</div></section>`;
    } else if (it.type === "choice") {
      const rs = past.map((d) => recOf(d, it.id)).filter(Boolean), yes = rs.filter((r) => r.v);
      h += `<section class="card"><h3><span>${esc(it.name)}${tag}</span><small>기록 ${rs.length}일 중</small></h3><div class="big">${yes.length}<small>일 있음</small></div><div style="margin-top:10px">${it.options.map((x) => { const c = yes.filter((r) => r.o === x.id).length; return x.hidden && !c ? "" : bar(x.label, c, yes.length, `${c}일`); }).join("")}</div></section>`;
    } else if (it.type === "meal") {
      h += mealCard(it, tag, past);
    }
  }
  h += medReport(past, false);
  return h + "</div>";
}
function mealCard(it, tag, past) {
  return `<section class="card"><h3><span>${esc(it.name)}${tag}</span><small>끼니별 기록률</small></h3>${MEALS.map(([k, l]) => { const c = past.filter((d) => { const m = (S.meal[d] || {})[k]; return m && (m.t || m.th); }).length; return bar(l, c, past.length); }).join("")}</section>`;
}
function medReport(past, yearly) {
  const sups = S.meds.filter((m) => m.kind === "supplement" && past.some((d) => active(m, d)));
  let h = `<section class="card"><h3>영양제<small>복용 일수 / 복용 기간 일수</small></h3>${sups.length ? sups.map((m) => { const ad = past.filter((d) => active(m, d)), t = ad.filter((d) => (S.sup[d] || {})[m.id]).length; return bar(m.name, t, ad.length); }).join("") : '<p class="empty">이 기간에 복용한 영양제가 없습니다.</p>'}</section>`;
  const regs = S.meds.filter((m) => m.kind === "regular" && past.some((d) => active(m, d)));
  let onceHtml;
  if (yearly) {
    const cnt = {}; past.forEach((d) => (S.once[d] || []).forEach((x) => (cnt[x.n] = (cnt[x.n] || 0) + 1)));
    onceHtml = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([n, c]) => `<div class="once"><span>${esc(n)} <span class="pill">일회성</span></span><span class="small muted num-t">${c}회</span></div>`);
  } else {
    onceHtml = past.flatMap((d) => (S.once[d] || []).map((x) => `<div class="once"><span>${esc(x.n)} <span class="pill">일회성</span></span><span class="small muted num-t">${md(d)}</span></div>`));
  }
  h += `<section class="card"><h3>복용한 약</h3>${regs.map((m) => `<div class="once"><span>${esc(m.name)} <span class="pill warm">정기</span></span><span class="small muted num-t">${md(m.start)} ~ ${m.end ? md(m.end) : "계속"}</span></div>`).join("")}${onceHtml.join("")}${!regs.length && !onceHtml.length ? '<p class="empty">이 기간에 복용한 약이 없습니다.</p>' : ""}</section>`;
  return h;
}
function vYear(past) {
  const y = UI.repA.slice(0, 4), M = [...Array(12)].map((_, i) => past.filter((d) => d.startsWith(`${y}-${pad(i + 1)}`)));
  let h = '<p class="small muted" style="margin:0">하루 기록을 월별로 묶어서 보여 줍니다. 가로축은 월입니다.</p>';
  for (const it of S.items) {
    if (it.hidden && !hasRec(it, past)) continue;
    const tag = it.hidden ? ' <span class="pill">숨긴 항목</span>' : "";
    if (it.type === "scale") {
      const sc = (d) => score(it, recOf(d, it.id));
      const all = past.map(sc).filter((x) => x != null), mv = M.map((ds) => avg(ds.map(sc).filter((x) => x != null))), a = avg(all);
      h += `<section class="card"><h3><span>${esc(it.name)}${tag}</span><small>기록 ${all.length}일 · 월평균</small></h3><div class="big">${a == null ? "-" : a.toFixed(1)}<small> / ${it.options.length} 연평균</small></div>${all.length ? mChart(mv, 1, it.options.length, false) : ""}</section>` + symCard(it, past);
    } else if (it.type === "number") {
      const val = (ds) => ds.map((d) => recOf(d, it.id)).filter(Boolean).map((r) => r.v);
      const seq = val(past), mv = M.map((ds) => avg(val(ds))), u = esc(it.unit || "");
      if (seq.length) {
        const ok = mv.filter((x) => x != null), lo = Math.floor(Math.min(...ok) * 2 - 1) / 2, hi = Math.ceil(Math.max(...ok) * 2 + 1) / 2;
        h += `<section class="card"><h3><span>${esc(it.name)}${tag}</span><small>기록 ${seq.length}일 · 월평균</small></h3><div class="big">${seq[seq.length - 1]}<small> ${u}</small></div><div class="small muted">올해 처음 ${seq[0]}${u} → 마지막 ${seq[seq.length - 1]}${u} (${signed(seq[seq.length - 1] - seq[0], u)})</div>${mChart(mv.map((v) => (v == null ? null : Math.round(v * 10) / 10)), lo, hi, false)}</section>`;
      } else h += `<section class="card"><h3>${esc(it.name)}${tag}</h3><p class="empty">올해 기록이 없습니다.</p></section>`;
    } else if (it.type === "bool" || it.type === "choice") {
      const rs = past.map((d) => recOf(d, it.id)).filter(Boolean), yes = rs.filter((r) => r.v);
      const mv = M.map((ds) => ds.filter((d) => { const r = recOf(d, it.id); return r && r.v; }).length), top = Math.max(4, Math.ceil(Math.max(...mv) / 4) * 4);
      h += `<section class="card"><h3><span>${esc(it.name)}${tag}</span><small>기록 ${rs.length}일 중 · 월별 일수</small></h3><div class="big">${yes.length}<small>일${it.type === "choice" ? " 있음" : ""}</small></div>${mChart(mv, 0, top, true)}`;
      if (it.type === "choice") h += `<div style="margin-top:8px">${it.options.map((x) => { const c = yes.filter((r) => r.o === x.id).length; return x.hidden && !c ? "" : bar(x.label, c, yes.length, `${c}일`); }).join("")}</div>`;
      else h += `<div style="margin-top:8px">${bar("달성률", yes.length, rs.length, rs.length ? Math.round((100 * yes.length) / rs.length) + "%" : "-")}</div>`;
      h += "</section>";
    } else if (it.type === "meal") h += mealCard(it, tag, past);
  }
  return h + medReport(past, true);
}

/* meds */
function status(m) { if (TODAY < m.start) return ["예정", ""]; if (m.end && m.end < TODAY) return ["종료", ""]; return ["복용 중", "on"]; }
function vMed() {
  let h = "";
  for (const [kind, title, desc] of [["regular", "정기 복용 약", "복용 기간 동안 캘린더에 표시되며, 매일 체크하지 않습니다."], ["supplement", "영양제", "복용 기간 동안 오늘 기록 화면에 체크리스트로 나타납니다."]]) {
    const list = S.meds.filter((m) => m.kind === kind).sort((a, b) => (status(a)[0] === "종료") - (status(b)[0] === "종료") || b.start.localeCompare(a.start));
    h += `<h2 class="sec">${title}</h2><section class="card"><p class="small muted" style="margin:0">${desc}</p>`;
    h += list.length ? list.map((m) => { const [st, c] = status(m); return `<div class="med"><div class="row" style="justify-content:space-between"><strong>${esc(m.name)}</strong><span class="pill ${c}">${st}</span></div>${m.note ? `<span class="small muted">${esc(m.note)}</span>` : ""}
   <div class="dates"><label>시작일<input type="date" id="ms-${m.id}" data-ch="mstart" data-m="${m.id}" value="${m.start}"></label><label>종료일 (비우면 계속)<input type="date" id="me-${m.id}" data-ch="mend" data-m="${m.id}" value="${m.end || ""}"></label></div>
   <div class="row">${st !== "종료" ? `<button class="btn sm ghost" data-act="medend" data-m="${m.id}">오늘로 복용 종료</button>` : ""}${armBtn("del:" + m.id, "삭제", "btn sm danger")}</div></div>`; }).join("") : '<p class="empty">등록된 항목이 없습니다.</p>';
    h += `<div class="form"><strong class="small">새 ${title} 등록</strong><input type="text" id="ma-${kind}-n" placeholder="이름"><div class="two"><label>시작일<input type="date" id="ma-${kind}-s" value="${TODAY}"></label><label>종료일 (선택)<input type="date" id="ma-${kind}-e"></label></div><input type="text" id="ma-${kind}-note" placeholder="메모 (예: 아침 식후 1정)"><button class="btn" data-act="medadd" data-k="${kind}">등록</button></div></section>`;
  }
  return h + '<p class="small muted">일회성으로 먹은 약은 오늘 기록 화면의 "복용 약" 칸에 기입합니다.</p>';
}

/* settings */
function vSet() {
  let h = '<h2 class="sec">기록 항목</h2><section class="card"><p class="small muted" style="margin:0">숨긴 항목은 기록 화면과 캘린더 필터에서 빠지지만, 지난 기록과 리포트에는 남습니다.</p>';
  S.items.forEach((it, i) => {
    const hasOpt = it.type === "scale" || it.type === "choice", open = UI.open[it.id];
    h += `<div class="item${it.hidden ? " hid" : ""}"><div class="top"><input class="nm" type="text" id="in-${it.id}" data-ch="iname" data-i="${it.id}" value="${esc(it.name)}" aria-label="항목 이름">
   <div class="row"><button class="mini" data-act="imove" data-i="${it.id}" data-n="-1" ${i === 0 ? "disabled" : ""} aria-label="위로">↑</button><button class="mini" data-act="imove" data-i="${it.id}" data-n="1" ${i === S.items.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button><button class="mini" data-act="ihide" data-i="${it.id}">${it.hidden ? "다시 표시" : "숨기기"}</button></div></div>
   <div class="row"><span class="pill">${TYPES[it.type]}${it.unit ? ` · ${esc(it.unit)}` : ""}</span>${it.hidden ? '<span class="pill warm">숨김</span>' : ""}${hasOpt ? `<button class="link" data-act="iopen" data-i="${it.id}">${open ? "선택지 접기" : `선택지 편집 (${it.options.filter((x) => !x.hidden).length}개)`}</button>` : ""}${it.symptoms && it.symptoms.length ? `<button class="link" data-act="symopen" data-i="${it.id}">${UI.open["sx" + it.id] ? "증상 선택지 접기" : "주요 증상 선택지 편집"}</button>` : ""}</div>`;
    if (it.symptoms && it.symptoms.length && UI.open["sx" + it.id]) {
      h += `<div class="opts"><p class="small muted" style="margin:0">증상마다 고를 수 있는 선택지입니다. 숨긴 선택지는 기록 화면에서 빠지고, 지난 기록에는 남습니다.</p>${it.symptoms.map((y) => `<div class="symset"><strong>${esc(y.name)}</strong>${y.options.map((x, j) => `<div class="opt${x.hidden ? " hid" : ""}"><span class="small muted">·</span><input type="text" id="sl-${x.id}" data-ch="solabel" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}" value="${esc(x.label)}" aria-label="${esc(y.name)} 선택지 이름"><div class="row"><button class="mini" data-act="somove" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}" data-n="-1" ${j === 0 ? "disabled" : ""} aria-label="위로">↑</button><button class="mini" data-act="somove" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}" data-n="1" ${j === y.options.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button><button class="mini" data-act="sohide" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}">${x.hidden ? "표시" : "숨김"}</button></div></div>`).join("")}<div class="grid2" style="grid-template-columns:minmax(0,1fr) auto;margin-top:0"><input type="text" id="so-${y.id}" placeholder="${esc(y.name)} 새 선택지"><button class="btn sm" data-act="soadd" data-i="${it.id}" data-s="${y.id}">추가</button></div></div>`).join("")}</div>`;
    }
    if (hasOpt && open) {
      h += `<div class="opts">${it.options.map((x, j) => `<div class="opt${x.hidden ? " hid" : ""}"><span class="small muted num-t">${it.type === "scale" ? j + 1 : "·"}</span><input type="text" id="ol-${x.id}" data-ch="olabel" data-i="${it.id}" data-o="${x.id}" value="${esc(x.label)}" aria-label="선택지 이름"><div class="row"><button class="mini" data-act="omove" data-i="${it.id}" data-o="${x.id}" data-n="-1" ${j === 0 ? "disabled" : ""} aria-label="위로">↑</button><button class="mini" data-act="omove" data-i="${it.id}" data-o="${x.id}" data-n="1" ${j === it.options.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button><button class="mini" data-act="ohide" data-i="${it.id}" data-o="${x.id}">${x.hidden ? "표시" : "숨김"}</button></div></div>`).join("")}
    <div class="grid2" style="grid-template-columns:minmax(0,1fr) auto"><input type="text" id="on-${it.id}" placeholder="새 선택지"><button class="btn sm" data-act="oadd" data-i="${it.id}">추가</button></div>
    ${it.type === "scale" ? '<p class="small muted" style="margin:0">단계형은 위에서부터 1단계로 계산합니다. 단계 수를 바꾸면 이전 기록과 평균을 비교하기 어려워집니다.</p>' : ""}</div>`;
    }
    h += "</div>";
  });
  const t = UI.niType;
  h += `<div class="form"><strong class="small">새 항목 추가</strong><input type="text" id="ni-name" placeholder="항목 이름 (예: 수면 시간)">
  <label class="small muted" style="display:flex;flex-direction:column;gap:3px">유형<select id="ni-type" data-ch="nitype">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${t === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
  ${t === "number" ? '<input type="text" id="ni-unit" placeholder="단위 (예: 시간, 잔)">' : ""}
  ${t === "scale" || t === "choice" ? `<input type="text" id="ni-opts" placeholder="${t === "scale" ? "낮은 단계부터 쉼표로 구분 (예: 나쁨, 보통, 좋음)" : "쉼표로 구분 (예: 적음, 보통, 많음)"}">` : ""}
  <button class="btn" data-act="iadd">항목 추가</button></div></section>`;
  const id = USER && USER.email ? USER.email.split("@")[0] : "";
  h += `<h2 class="sec">계정</h2><section class="card stack"><div class="row" style="justify-content:space-between"><span>로그인 아이디 <strong>${esc(id)}</strong></span><button class="btn sm ghost" data-act="logout">로그아웃</button></div></section>`;
  return h;
}

/* ---------- 동작 ---------- */
function symOf(t) { return itemById(t.dataset.i).symptoms.find((y) => y.id === t.dataset.s); }
function go(v) { UI.view = v; saveUI(); render(); window.scrollTo(0, 0); }
const act = {
  nav: (t) => go(t.dataset.v),
  dshift: (t) => { const d = add(UI.date, +t.dataset.n); if (d <= TODAY) { UI.date = d; saveUI(); render(); } },
  dtoday: () => { UI.date = TODAY; saveUI(); render(); },
  pick: (t) => {
    const it = itemById(t.dataset.i), d = UI.date, r = recOf(d, it.id);
    if (it.type === "scale") setScaleLevel(d, it, r && r.o === t.dataset.o ? null : t.dataset.o);
    else setRec(d, it.id, { v: true, o: r && r.o === t.dataset.o ? undefined : t.dataset.o });
    render();
  },
  sym: (t) => { const it = itemById(t.dataset.i), d = UI.date, sx = (recOf(d, it.id) || {}).sx || {}; setSymptom(d, it, t.dataset.s, t.dataset.s in sx ? undefined : null); render(); },
  symopt: (t) => { const it = itemById(t.dataset.i), d = UI.date, sx = (recOf(d, it.id) || {}).sx || {}; setSymptom(d, it, t.dataset.s, sx[t.dataset.s] === t.dataset.o ? null : t.dataset.o); render(); },
  symopen: (t) => { UI.open["sx" + t.dataset.i] = !UI.open["sx" + t.dataset.i]; saveUI(); render(); },
  somove: (t) => {
    const y = symOf(t), i = y.options.findIndex((x) => x.id === t.dataset.o), j = i + +t.dataset.n;
    [y.options[i], y.options[j]] = [y.options[j], y.options[i]]; render();
    run("증상 선택지 순서", ...y.options.map((x, k) => sb.from("symptom_options").update({ sort_order: k }).eq("id", x.id)));
  },
  sohide: (t) => { const x = symOf(t).options.find((o) => o.id === t.dataset.o); x.hidden = !x.hidden; render(); run("증상 선택지", sb.from("symptom_options").update({ is_hidden: x.hidden }).eq("id", x.id)); },
  soadd: (t) => {
    const y = symOf(t), v = document.getElementById("so-" + y.id).value.trim(); if (!v) return;
    const o = { id: uuid(), label: v, hidden: false }; y.options.push(o); render();
    run("증상 선택지", sb.from("symptom_options").insert({ id: o.id, user_id: USER.id, symptom_id: y.id, label: v, sort_order: y.options.length - 1, is_hidden: false }));
  },
  bool: (t) => { const d = UI.date, id = t.dataset.i, v = t.dataset.v === "true", r = recOf(d, id); setRec(d, id, r && r.v === v ? null : { v }); render(); },
  photo: async (t) => {
    const m = (S.meal[UI.date] || {})[t.dataset.k]; if (!m || !m.p) return;
    const ov = document.getElementById("ov");
    ov.innerHTML = '<span class="small" style="color:#fff">불러오는 중…</span>'; ov.hidden = false;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(m.p, 3600);
    if (error || !data) { ov.hidden = true; toast("사진을 불러오지 못했습니다."); return; }
    ov.innerHTML = `<img src="${esc(data.signedUrl)}" alt="식사 사진">`;
  },
  closeov: () => { document.getElementById("ov").hidden = true; },
  photodel: async (t) => {
    const d = UI.date, k = t.dataset.k, m = (S.meal[d] || {})[k]; if (!m) return;
    const old = [m.p, m.th]; m.p = null; m.th = null; render();
    await saveMeal(d, k); await removePhotos(old);
  },
  onceadd: () => {
    const n = document.getElementById("once-n").value.trim(); if (!n) { toast("약 이름을 입력해 주세요."); return; }
    const d = UI.date, x = { id: uuid(), n, note: document.getElementById("once-note").value.trim() };
    (S.once[d] = S.once[d] || []).push(x); render();
    run("일회성 약", sb.from("onetime_meds").insert({ id: x.id, user_id: USER.id, date: d, name: x.n, note: x.note || null }));
  },
  oncedel: (t) => { const d = UI.date, id = t.dataset.id; S.once[d] = (S.once[d] || []).filter((x) => x.id !== id); render(); run("일회성 약", sb.from("onetime_meds").delete().eq("id", id)); },
  calshift: (t) => { const [y, m] = UI.cal.split("-").map(Number); UI.cal = ymd(new Date(y, m - 1 + +t.dataset.n, 1)).slice(0, 7); saveUI(); render(); },
  caltoday: () => { UI.cal = TODAY.slice(0, 7); saveUI(); render(); },
  calf: (t) => { const k = t.dataset.k, f = UI.calF || []; UI.calF = f.includes(k) ? f.filter((x) => x !== k) : [...f, k]; saveUI(); render(); },
  calday: (t) => { UI.date = t.dataset.d; go("today"); },
  lvgo: (t) => { UI.lvItem = t.dataset.i; UI.lvSel = +t.dataset.n; go("lv"); },
  lvsel: (t) => { UI.lvSel = +t.dataset.n; saveUI(); render(); },
  lvitem: (t) => { UI.lvItem = t.dataset.i; UI.lvSel = 1; saveUI(); render(); },
  repmode: (t) => { UI.rep = t.dataset.k; saveUI(); render(); },
  repshift: (t) => {
    const n = +t.dataset.n;
    if (UI.rep === "week") UI.repA = add(monday(UI.repA), 7 * n);
    else if (UI.rep === "year") UI.repA = ymd(pd(`${+UI.repA.slice(0, 4) + n}${UI.repA.slice(4)}`));
    else { const [y, m] = UI.repA.split("-").map(Number); UI.repA = ymd(new Date(y, m - 1 + n, 1)); }
    saveUI(); render();
  },
  medadd: (t) => {
    const k = t.dataset.k, g = (s) => document.getElementById(`ma-${k}-${s}`).value.trim();
    const n = g("n"); if (!n) { toast("이름을 입력해 주세요."); return; }
    const s = g("s") || TODAY, e = g("e"); if (e && e < s) { toast("종료일이 시작일보다 빠릅니다."); return; }
    const m = { id: uuid(), kind: k, name: n, start: s, end: e, note: g("note") };
    S.meds.push(m); render(); toast(`${n}을(를) 등록했습니다.`);
    run("약/영양제", sb.from("medications").insert({ id: m.id, user_id: USER.id, kind: k, name: n, start_date: s, end_date: e || null, note: m.note || null }));
  },
  medend: (t) => {
    const m = S.meds.find((x) => x.id === t.dataset.m); if (!m) return;
    m.end = TODAY < m.start ? m.start : TODAY; render();
    run("약/영양제", sb.from("medications").update({ end_date: m.end }).eq("id", m.id));
  },
  imove: (t) => { const i = S.items.findIndex((x) => x.id === t.dataset.i), j = i + +t.dataset.n; [S.items[i], S.items[j]] = [S.items[j], S.items[i]]; render(); saveItemOrder(); },
  ihide: (t) => {
    const it = itemById(t.dataset.i); it.hidden = !it.hidden; render();
    toast(it.hidden ? `${it.name} 항목을 숨겼습니다. 지난 기록은 남아 있습니다.` : `${it.name} 항목을 다시 표시합니다.`);
    run("항목", sb.from("items").update({ is_hidden: it.hidden }).eq("id", it.id));
  },
  iopen: (t) => { UI.open[t.dataset.i] = !UI.open[t.dataset.i]; saveUI(); render(); },
  omove: (t) => { const it = itemById(t.dataset.i), i = it.options.findIndex((x) => x.id === t.dataset.o), j = i + +t.dataset.n; [it.options[i], it.options[j]] = [it.options[j], it.options[i]]; render(); saveOptionOrder(it); },
  ohide: (t) => { const x = itemById(t.dataset.i).options.find((o) => o.id === t.dataset.o); x.hidden = !x.hidden; render(); run("선택지", sb.from("item_options").update({ is_hidden: x.hidden }).eq("id", x.id)); },
  oadd: (t) => {
    const it = itemById(t.dataset.i), v = document.getElementById("on-" + it.id).value.trim(); if (!v) return;
    const o = { id: uuid(), label: v, hidden: false }; it.options.push(o); render();
    run("선택지", sb.from("item_options").insert({ id: o.id, user_id: USER.id, item_id: it.id, label: v, sort_order: it.options.length - 1, is_hidden: false }));
  },
  iadd: async () => {
    const n = document.getElementById("ni-name").value.trim(), t = UI.niType;
    if (!n) { toast("항목 이름을 입력해 주세요."); return; }
    const it = { id: uuid(), name: n, type: t, unit: "", hidden: false, options: [], symptoms: [] };
    if (t === "number") it.unit = (document.getElementById("ni-unit").value || "").trim();
    if (t === "scale" || t === "choice") {
      const ops = (document.getElementById("ni-opts").value || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (ops.length < 2) { toast("선택지를 2개 이상 입력해 주세요."); return; }
      it.options = ops.map((label) => ({ id: uuid(), label, hidden: false }));
    }
    S.items.push(it); render(); toast(`${n} 항목을 추가했습니다.`);
    const ok = await run("항목", sb.from("items").insert({ id: it.id, user_id: USER.id, name: n, type: t, unit: it.unit || null, sort_order: S.items.length - 1, is_hidden: false }));
    if (ok && it.options.length) run("선택지", sb.from("item_options").insert(it.options.map((o, j) => ({ id: o.id, user_id: USER.id, item_id: it.id, label: o.label, sort_order: j, is_hidden: false }))));
  },
  mode: () => { SIGNUP = !SIGNUP; LOGIN_ERR = ""; render(); },
  retry: () => boot(),
  logout: async () => {
    await sb.auth.signOut().catch(() => {});
    USER = null; S = emptyState(); PHASE = "login"; SIGNUP = false; render();
  },
  arm: (t) => {
    const k = t.dataset.k;
    if (ARM !== k) { ARM = k; render(); return; }
    ARM = null;
    if (k.startsWith("del:")) {
      const id = k.slice(4); S.meds = S.meds.filter((m) => m.id !== id); Object.values(S.sup).forEach((x) => delete x[id]); render();
      run("약/영양제", sb.from("medications").delete().eq("id", id));
    }
  },
};

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act;
  if (a !== "arm" && ARM) ARM = null;
  if (act[a]) { if (t.tagName === "BUTTON") e.preventDefault(); act[a](t); }
});

document.addEventListener("change", async (e) => {
  const t = e.target, c = t.dataset && t.dataset.ch; if (!c) return;
  const d = UI.date;
  if (c === "num") { const v = parseFloat(t.value); setRec(d, t.dataset.i, isNaN(v) ? null : { v: Math.round(v * 10) / 10 }); }
  else if (c === "text") { const v = t.value.trim(); setRec(d, t.dataset.i, v ? { v } : null); }
  else if (c === "meal") { const m = (S.meal[d] = S.meal[d] || {}), k = t.dataset.k; m[k] = m[k] || {}; m[k].t = t.value.trim(); saveMeal(d, k); }
  else if (c === "photo") {
    const f = t.files && t.files[0]; if (!f) return;
    const k = t.dataset.k;
    try {
      toast("사진을 올리는 중입니다…");
      const [big, small] = await Promise.all([toBlob(f, 1024, 0.72), toBlob(f, 160, 0.7)]);
      const base = `${USER.id}/${d}/${k}-${Date.now()}`;
      const r1 = await sb.storage.from(BUCKET).upload(`${base}.jpg`, big, { contentType: "image/jpeg" });
      const r2 = await sb.storage.from(BUCKET).upload(`${base}-t.jpg`, small, { contentType: "image/jpeg" });
      if (r1.error || r2.error) throw r1.error || r2.error;
      const m = (S.meal[d] = S.meal[d] || {});
      const old = m[k] ? [m[k].p, m[k].th] : [];
      m[k] = Object.assign(m[k] || {}, { p: `${base}.jpg`, th: `${base}-t.jpg` });
      render();
      await saveMeal(d, k);
      await removePhotos(old);
      toast(`사진을 약 ${Math.round(big.size / 1024)}KB로 압축해 저장했습니다.`);
    } catch (err) {
      console.error(err);
      toast("사진을 올리지 못했습니다. 다시 시도해 주세요.");
    }
  }
  else if (c === "sup") {
    const s = (S.sup[d] = S.sup[d] || {}), id = t.dataset.m;
    if (t.checked) s[id] = true; else delete s[id];
    render();
    run("영양제 체크", t.checked
      ? sb.from("supplement_logs").upsert({ user_id: USER.id, date: d, medication_id: id }, { onConflict: "user_id,date,medication_id" })
      : sb.from("supplement_logs").delete().eq("date", d).eq("medication_id", id));
  }
  else if (c === "mstart" || c === "mend") {
    const m = S.meds.find((x) => x.id === t.dataset.m), v = t.value;
    if (c === "mstart") { if (!v || (m.end && v > m.end)) { toast("시작일은 종료일보다 늦을 수 없습니다."); render(); return; } m.start = v; }
    else { if (v && v < m.start) { toast("종료일은 시작일보다 빠를 수 없습니다."); render(); return; } m.end = v; }
    render();
    run("약/영양제", sb.from("medications").update({ start_date: m.start, end_date: m.end || null }).eq("id", m.id));
  }
  else if (c === "iname") { const v = t.value.trim(), it = itemById(t.dataset.i); if (!v) { render(); return; } it.name = v; run("항목 이름", sb.from("items").update({ name: v }).eq("id", it.id)); }
  else if (c === "solabel") { const v = t.value.trim(), x = symOf(t).options.find((o) => o.id === t.dataset.o); if (!v) { render(); return; } x.label = v; run("증상 선택지 이름", sb.from("symptom_options").update({ label: v }).eq("id", x.id)); }
  else if (c === "olabel") { const v = t.value.trim(), x = itemById(t.dataset.i).options.find((o) => o.id === t.dataset.o); if (!v) { render(); return; } x.label = v; run("선택지 이름", sb.from("item_options").update({ label: v }).eq("id", x.id)); }
  else if (c === "nitype") { UI.niType = t.value; saveUI(); const nm = document.getElementById("ni-name").value; render(); document.getElementById("ni-name").value = nm; }
});

/* ---------- 로그인 ---------- */
const ID_RE = /^[a-z0-9._-]{3,20}$/;
const toEmail = (id) => `${id}@${ID_DOMAIN}`;
function authErr(e) {
  const m = (e && e.message) || "";
  if (/invalid login credentials/i.test(m)) return "아이디 또는 비밀번호가 맞지 않습니다.";
  if (/already registered|already exists/i.test(m)) return "이미 사용 중인 아이디입니다.";
  if (/signups? not allowed|signup.*disabled/i.test(m)) return "새 계정 만들기가 막혀 있습니다. Supabase의 가입 설정을 확인해 주세요.";
  if (/email not confirmed/i.test(m)) return "Supabase에서 이메일 확인(Confirm email)을 꺼야 로그인할 수 있습니다.";
  if (/password/i.test(m)) return "비밀번호는 6자 이상이어야 합니다.";
  if (/fetch|network/i.test(m)) return "서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.";
  return m || "알 수 없는 오류가 발생했습니다.";
}
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "lgform") return;
  e.preventDefault();
  const id = document.getElementById("lg-id").value.trim().toLowerCase(), pw = document.getElementById("lg-pw").value;
  const fail = (m) => { LOGIN_ERR = m; render(); const i = document.getElementById("lg-id"); if (i) i.value = id; };
  if (!ID_RE.test(id)) return fail("아이디는 영문 소문자, 숫자, 점(.), 밑줄(_), 하이픈(-)으로 3~20자입니다.");
  if (pw.length < 6) return fail("비밀번호는 6자 이상이어야 합니다.");
  let res;
  if (SIGNUP) {
    if (pw !== document.getElementById("lg-pw2").value) return fail("비밀번호 확인이 일치하지 않습니다.");
    res = await sb.auth.signUp({ email: toEmail(id), password: pw });
    if (!res.error && !res.data.session) return fail("계정은 만들어졌지만 로그인되지 않았습니다. Supabase에서 이메일 확인(Confirm email)을 끈 뒤 로그인해 주세요.");
  } else {
    res = await sb.auth.signInWithPassword({ email: toEmail(id), password: pw });
  }
  if (res.error) return fail(authErr(res.error));
  LOGIN_ERR = ""; SIGNUP = false;
  await enter(res.data.session.user);
});

async function enter(user) {
  USER = user; loadUI(); PHASE = "loading"; render();
  try { await loadAll(); PHASE = "app"; }
  catch (e) { console.error(e); LOAD_ERR = "기록을 불러오지 못했습니다. " + ((e && e.message) || ""); PHASE = "error"; }
  render();
}

async function boot() {
  if (!configured) { PHASE = "setup"; render(); return; }
  PHASE = "boot"; render();
  const { data } = await sb.auth.getSession();
  if (data && data.session) await enter(data.session.user);
  else { PHASE = "login"; render(); }
}

/* 다른 기기에서 기록했을 수 있으므로, 앱으로 돌아오면 1분이 지났을 때 다시 불러온다 */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || PHASE !== "app" || pending) return;
  if (Date.now() - lastLoad < 60 * 1000) return;
  const el = document.activeElement;
  if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
  try { await loadAll(); render(); } catch (e) { console.error(e); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const o = document.getElementById("ov"); if (o) o.hidden = true; } });

window.__naemom = { get S() { return S; }, get UI() { return UI; }, get PHASE() { return PHASE; } };
boot();
