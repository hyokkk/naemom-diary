import { createClient } from "@supabase/supabase-js";

/* ============================================================
   내몸일기 — 개인 건강 기록 웹앱
   화면은 아티팩트 프로토타입과 같고, 데이터는 Supabase에 저장한다.
   ============================================================ */

/* ---------- Supabase 연결 ----------
   anon key는 브라우저에 공개되는 값이다. 데이터는 RLS로 본인 행만 접근된다.
   service_role 키는 절대로 여기에 넣지 않는다.
------------------------------------------- */
const SUPABASE_URL = "https://leuobolisgxhlccmdnvd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldW9ib2xpc2d4aGxjY21kbnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMTMwNzQsImV4cCI6MjEwNzc4OTA3NH0.oGbMXkdYyv8givyWb9Z9o5MOdtv2MsasnZYlXd-LGkQ";

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
const sunday = (s) => { const d = pd(s); d.setDate(d.getDate() - d.getDay()); return ymd(d); };
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
  visit: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  rep: '<svg viewBox="0 0 24 24"><path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg>',
  med: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-40 12 12)"/><path d="M10.5 7.2l6.3 7.6"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  diary: '<svg viewBox="0 0 24 24"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 8h6"/></svg>',
  medlog: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 19h4"/><circle cx="9" cy="7" r="1"/></svg>',
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

function emptyState() { return { items: [], rec: {}, meal: {}, meds: [], sup: {}, rl: {}, once: {}, visit: {}, calDef: null, calHide: [], diary: [] }; }
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
  ["몸 상태", "scale", null, ["매우 좋음", "좋음", "보통", "나쁨", "매우 나쁨"], false, true], // 마지막 true: 숫자가 높을수록 나쁜 상태
  ["체중", "number", "kg"],
  ["운동", "bool", null, null, true], // 무엇을 했는지 적는 칸 (v1.6)
  ["요가", "bool", null, null, true],
  ["간식", "bool", null, null, true], // 마지막 true: '예'를 고르면 어떤 간식인지 적는 칸을 보여 준다
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
  DEFAULT_ITEMS.forEach(([name, type, unit, options, hasNote, highBad], i) => {
    const id = uuid();
    items.push({ id, user_id: USER.id, name, type, unit: unit || null, sort_order: i, is_hidden: false, has_note: !!hasNote, high_is_bad: !!highBad });
    (options || []).forEach((label, j) => opts.push({ id: uuid(), user_id: USER.id, item_id: id, label, sort_order: j, is_hidden: false }));
  });
  let r = await sb.from("items").insert(items);
  if (r.error) throw r.error;
  r = await sb.from("item_options").insert(opts);
  if (r.error) throw r.error;
  await createSymptomDefaults(items[0].id);
}

async function loadAll() {
  const [items, opts, recs, meals, meds, sups, onces, syms, symOpts, symRecs, visits, regLogs, vphotos, settings, diary] = await Promise.all([
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
    fetchAll("hospital_visits", ["date"]),
    fetchAll("regular_med_logs", ["date", "medication_id"]),
    fetchAll("visit_photos", ["visit_date", "created_at", "id"]),
    fetchAll("user_settings", ["user_id"]),
    fetchAll("diary_entries", ["date", "created_at", "id"]),
  ]);
  if (!items.length) { await createDefaults(); return loadAll(); }
  /* v1.0에서 가입해 주요 증상이 없는 계정은 몸 상태에 기본 증상을 만들어 준다.
     증상을 모두 지운 계정은 설정 행(user_settings)이 있으므로 다시 만들지 않는다 (v1.6) */
  if (!syms.length && !settings.length) {
    const base = items.find((x) => x.type === "scale" && x.name === "몸 상태") || items.find((x) => x.type === "scale");
    if (base) { await createSymptomDefaults(base.id); return loadAll(); }
  }
  const s = emptyState();
  s.items = items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({ id: r.id, name: r.name, type: r.type, unit: r.unit || "", hidden: r.is_hidden, note: !!r.has_note, bad: !!r.high_is_bad, options: [], symptoms: [] }));
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
    else if (it.type === "bool") v = r.value_bool == null ? null : r.value_bool && r.value_text ? { v: true, t: r.value_text } : { v: r.value_bool };
    else if (it.type === "text") v = r.value_text ? { v: r.value_text } : null;
    if (v) (s.rec[r.date] = s.rec[r.date] || {})[r.item_id] = v;
  }
  for (const x of symRecs) {
    const e = symIndex[x.symptom_id]; if (!e) continue;
    const day = (s.rec[x.date] = s.rec[x.date] || {}), rec = (day[e[0].id] = day[e[0].id] || {});
    (rec.sx = rec.sx || {})[x.symptom_id] = x.option_id || null;
  }
  for (const m of meals) {
    (s.meal[m.date] = s.meal[m.date] || {})[MEAL_KEY[m.meal_type]] = { t: m.note || "", s: m.symptom || "", p: m.photo_path || null, th: m.thumb_path || null };
  }
  s.meds = meds.map((m) => ({ id: m.id, kind: m.kind, name: m.name, start: m.start_date, end: m.end_date || "", note: m.note || "" }));
  for (const l of sups) (s.sup[l.date] = s.sup[l.date] || {})[l.medication_id] = true;
  for (const l of regLogs) (s.rl[l.date] = s.rl[l.date] || {})[l.medication_id] = { eff: l.effect || "" };
  for (const o of onces) (s.once[o.date] = s.once[o.date] || []).push({ id: o.id, n: o.name, sym: o.symptom || o.note || "", eff: o.effect || "" });
  for (const v of visits) s.visit[v.date] = { hosp: v.hospital || "", treat: v.treatment || "", note: v.note || "", next: v.next_date || "", ph: [] };
  for (const q of vphotos) if (s.visit[q.visit_date]) s.visit[q.visit_date].ph.push({ id: q.id, p: q.photo_path, th: q.thumb_path });
  const st = settings[0];
  if (st && Array.isArray(st.cal_defaults)) s.calDef = st.cal_defaults;
  else { const c = s.items.find((x) => x.type === "scale"); s.calDef = ["visit", c ? c.id : null, "supp"].filter(Boolean); }
  s.calHide = st && Array.isArray(st.cal_hidden) ? st.cal_hidden : [];
  s.diary = diary.map((x) => ({ id: x.id, d: x.date, title: x.title || "", body: x.body || "", at: Date.parse(x.updated_at || x.created_at) || 0 }));
  S = s;
  lastLoad = Date.now();
  if (!Array.isArray(UI.calF)) { UI.calF = [...s.calDef]; saveUI(); }
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
const settingsRow = () => ({ user_id: USER.id, cal_defaults: S.calDef, cal_hidden: S.calHide || [], updated_at: now() });
const saveSettings = (label) => run(label, sb.from("user_settings").upsert(settingsRow(), { onConflict: "user_id" }));

function recRow(it, d, val) {
  const row = { user_id: USER.id, date: d, item_id: it.id, value_num: null, value_bool: null, value_text: null, option_id: null, updated_at: now() };
  if (it.type === "scale") row.option_id = val.o;
  else if (it.type === "choice") { row.value_bool = val.v; row.option_id = val.v && val.o ? val.o : null; }
  else if (it.type === "number") row.value_num = val.v;
  else if (it.type === "bool") { row.value_bool = val.v; row.value_text = val.v && val.t ? val.t : null; }
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
  if (!m.t && !m.p && !m.s) {
    if (S.meal[d]) delete S.meal[d][k];
    return run("식사 기록", sb.from("meals").delete().eq("date", d).eq("meal_type", MEAL_DB[k]));
  }
  return run("식사 기록", sb.from("meals").upsert(
    { user_id: USER.id, date: d, meal_type: MEAL_DB[k], note: m.t || null, symptom: m.s || null, photo_path: m.p || null, thumb_path: m.th || null, updated_at: now() },
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
  const views = { today: vToday, cal: vCal, rep: vRep, med: vMed, set: vSet, lv: vLv, visit: vVisit, day: vDay, medlog: vMedLog, diary: vDiary };
  el.innerHTML = `<header class="top"><p class="brand">내몸일기</p><button class="iconbtn${v === "set" ? " on" : ""}" data-act="nav" data-v="set" aria-label="항목 설정">${ICON.gear}</button></header>
 <main>${(views[v] || vToday)()}</main>
 <nav class="tabs"><div class="tabs-in">${[["today", "오늘 기록"], ["cal", "캘린더"], ["rep", "리포트"], ["med", "약/영양제"], ["medlog", "약 기록"], ["visit", "치료 일지"], ["diary", "일기"]].map(([k, l]) => `<button class="tab" data-act="nav" data-v="${k}" ${v === k || ((v === "lv" || v === "day") && k === "cal") ? 'aria-current="page"' : ""}>${ICON[k]}${l}</button>`).join("")}</div></nav>`;
}
function armBtn(key, label, cls, armed) { const on = ARM === key; return `<button class="${cls}${on ? " armed" : ""}" data-act="arm" data-k="${key}">${on ? armed || "한 번 더 누르면 실행" : label}</button>`; }

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
  h += copyPanel(d);
  for (const it of visItems()) h += itemCard(it, d, recOf(d, it.id));
  return h + medCard(d) + visitCard(d) + "</div>";
}
/* 기록 복사 (v1.6): 다른 날의 기록을 이 날짜로 가져온다. 이미 적은 칸은 덮어쓰지 않고 빈 칸만 채운다.
   사진, 약 차도, 기타 메모(텍스트 항목), 치료 일지는 가져오지 않는다 */
const CP_GROUPS = [["scale", "몸 상태/주요 증상"], ["etc", "그 밖의 항목 (체중, 운동/요가/간식 메모, 배변 등)"], ["meal", "식사 (메뉴, 증상)"], ["meds", "영양제/정기 약 복용 체크"], ["once", "일회성 약 (이름, 증상)"]];
const cpGroups = () => UI.cpG || CP_GROUPS.map((x) => x[0]);
function recDays() {
  return [...new Set([...Object.keys(S.rec).filter((d) => Object.keys(S.rec[d]).length), ...Object.keys(S.meal).filter((d) => Object.values(S.meal[d]).some((m) => m && (m.t || m.s))), ...Object.keys(S.once).filter((d) => S.once[d].length)])].sort();
}
function copyPanel(d) {
  if (!UI.cpOpen) return '<div class="cpbar"><button class="link" data-act="cpopen">다른 날 기록 복사해 오기</button></div>';
  const prev = recDays().filter((x) => x < d).pop() || "", src = UI.cpFrom && UI.cpFrom !== d ? UI.cpFrom : prev, g = cpGroups();
  return `<section class="card cpbox"><div class="row" style="justify-content:space-between"><strong class="small">다른 날 기록 복사해 오기</strong><button class="link" data-act="cpopen">닫기</button></div>
  <label class="small muted cpd">어느 날 기록을 가져올까요?<input type="date" id="cp-from" data-ch="cpfrom" value="${src}" max="${TODAY}"></label>
  ${src ? `<div class="cpsum small">${cpSummary(src)}</div>` : ""}
  <div class="cpg">${CP_GROUPS.map(([k, l]) => `<label class="check"><input type="checkbox" id="cpg-${k}" data-ch="cpg" data-k="${k}" ${g.includes(k) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
  <p class="small muted" style="margin:0">${dlabel(d)}에 이미 적은 칸은 그대로 두고, 비어 있는 칸만 채웁니다. 사진, 약 차도, 기타 메모, 치료 일지는 가져오지 않습니다.</p>
  <button class="btn sm" data-act="cpdo" ${src ? "" : "disabled"}>${src ? `${md(src)} 기록 복사해 오기` : "가져올 날짜를 골라 주세요"}</button></section>`;
}
function cpSummary(src) {
  const r = S.rec[src] || {}, parts = [];
  visItems().forEach((it) => {
    const x = r[it.id]; if (!x) return;
    if (it.type === "scale" && x.o) { const op = it.options.find((o) => o.id === x.o); if (op) parts.push(`${it.name} ${op.label}`); }
    else if (it.type === "bool" && x.v) parts.push(x.t ? `${it.name} ${x.t}` : it.name);
    else if (it.type === "number") parts.push(`${it.name} ${x.v}${it.unit || ""}`);
    else if (it.type === "choice") { const op = it.options.find((o) => o.id === x.o); parts.push(`${it.name} ${x.v ? (op ? op.label : "있음") : "없음"}`); }
  });
  const m = S.meal[src] || {}, mn = MEALS.filter(([k]) => m[k] && (m[k].t || m[k].s)).length; if (mn) parts.push(`식사 ${mn}끼`);
  const on = (S.once[src] || []).map((x) => x.n); if (on.length) parts.push(on.join(", "));
  return parts.length ? `<span class="muted">${md(src)} 기록:</span> ${esc(parts.join(" · "))}` : '<span class="muted">이 날짜에는 기록이 없습니다.</span>';
}
function copyDay(from, to, g) {
  let n = 0; const qs = [], meals = [], src = S.rec[from] || {};
  for (const it of visItems()) {
    const x = src[it.id]; if (!x || it.type === "text" || it.type === "meal") continue;
    if (!g.includes(it.type === "scale" ? "scale" : "etc")) continue;
    const y = recOf(to, it.id);
    if (it.type === "scale") {
      const vis = (sid) => (it.symptoms || []).some((q) => q.id === sid && !q.hidden);
      if (x.o && !(y && y.o)) { patchScale(to, it, { o: x.o }); qs.push(sb.from("daily_records").upsert(recRow(it, to, { o: x.o }), { onConflict: "user_id,date,item_id" })); n++; }
      if (x.sx) {
        const sx = Object.assign({}, (recOf(to, it.id) || {}).sx); let add = 0;
        for (const [sid, v] of Object.entries(x.sx)) if (!(sid in sx) && vis(sid)) { sx[sid] = v; add++; qs.push(sb.from("symptom_records").upsert({ user_id: USER.id, date: to, symptom_id: sid, option_id: v }, { onConflict: "user_id,date,symptom_id" })); }
        if (add) { patchScale(to, it, { sx }); n += add; }
      }
    } else if (!y) {
      const v = JSON.parse(JSON.stringify(x)); setLocal(to, it.id, v);
      qs.push(sb.from("daily_records").upsert(recRow(it, to, v), { onConflict: "user_id,date,item_id" })); n++;
    }
  }
  if (g.includes("meal")) {
    const a = S.meal[from] || {}, b = (S.meal[to] = S.meal[to] || {});
    for (const [k] of MEALS) { const x = a[k]; if (!x || !(x.t || x.s)) continue; const y = (b[k] = b[k] || {}); let c = 0; if (!y.t && x.t) { y.t = x.t; c++; } if (!y.s && x.s) { y.s = x.s; c++; } if (c) { n += c; meals.push(k); } else if (!y.t && !y.s && !y.p) delete b[k]; }
  }
  if (g.includes("meds")) {
    for (const id of Object.keys(S.sup[from] || {})) { const m = S.meds.find((q) => q.id === id); if (!m || !active(m, to)) continue; const q = (S.sup[to] = S.sup[to] || {}); if (!q[id]) { q[id] = true; n++; qs.push(sb.from("supplement_logs").upsert({ user_id: USER.id, date: to, medication_id: id }, { onConflict: "user_id,date,medication_id" })); } }
    for (const id of Object.keys(S.rl[from] || {})) { const m = S.meds.find((q) => q.id === id); if (!m || !active(m, to)) continue; const q = (S.rl[to] = S.rl[to] || {}); if (!q[id]) { q[id] = { eff: "" }; n++; qs.push(sb.from("regular_med_logs").upsert({ user_id: USER.id, date: to, medication_id: id, effect: null }, { onConflict: "user_id,date,medication_id" })); } }
  }
  if (g.includes("once")) {
    const a = S.once[from] || [], b = (S.once[to] = S.once[to] || []), key = (v) => v.replace(/\s+/g, "");
    for (const x of a) if (!b.some((y) => key(y.n) === key(x.n))) { const z = { id: uuid(), n: x.n, sym: x.sym || "", eff: "" }; b.push(z); n++; qs.push(sb.from("onetime_meds").insert({ id: z.id, user_id: USER.id, date: to, name: z.n, symptom: z.sym || null, effect: null })); }
  }
  if (qs.length) run("기록 복사", ...qs);
  meals.forEach((k) => saveMeal(to, k));
  return n;
}
function notePh(n) {
  if (n === "운동") return "어떤 운동을 했나요? (예: 걷기 30분)";
  if (n === "요가") return "어떤 요가를 했나요? (예: 하타 요가 50분)";
  const c = n.charCodeAt(n.length - 1), jong = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28;
  return `어떤 ${n}${jong ? "이었" : "였"}나요?`;
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
    const withNote = it.type === "bool" && it.note && r && r.v;
    body = `<div class="seg boolrow">${[[true, L[0]], [false, L[1]]].map(([v, l]) => `<button class="chip${r && r.v === v ? " on" : ""}" data-act="bool" data-i="${it.id}" data-v="${v}">${l}</button>`).join("")}${withNote ? `<input type="text" class="bnote" id="bn-${it.id}" data-ch="bnote" data-i="${it.id}" value="${esc(r.t || "")}" placeholder="${esc(notePh(it.name))}">` : ""}</div>`;
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
      return `<div class="meal"><span class="lb">${l}</span><input type="text" id="m-${k}" data-ch="meal" data-k="${k}" value="${esc(x.t || "")}" placeholder="메뉴" aria-label="${l} 메뉴"><input type="text" id="ms-${k}" data-ch="mealsym" data-k="${k}" value="${esc(x.s || "")}" placeholder="증상" aria-label="${l} 먹고 난 뒤 증상">${ph}</div>`;
    }).join("");
    hint = `${MEALS.filter(([k]) => m[k] && (m[k].t || m[k].th || m[k].s)).length}/3 기록`;
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
  const rl = S.rl[d] || {};
  h += `</section><section class="card"><h3>복용 약<small>${reg.length ? `정기 ${reg.filter((m) => rl[m.id]).length}/${reg.length} 복용` : ""}</small></h3><p class="small muted" style="margin:0 0 2px">정기 복용 약</p>`;
  h += reg.length ? reg.map((m) => {
    const x = rl[m.id];
    return `<div class="regx"><label class="check"><input type="checkbox" id="r-${m.id}" data-ch="reg" data-m="${m.id}" ${x ? "checked" : ""}><span>${esc(m.name)}${m.end ? ` <span class="small muted">~${md(m.end)}</span>` : ""}</span></label>${x ? `<label class="eff"><span>차도</span><input type="text" id="re-${m.id}" data-ch="regeff" data-m="${m.id}" value="${esc(x.eff || "")}" placeholder="먹고 나서 어땠나요? (나중에 적어도 됩니다)"></label>` : ""}</div>`;
  }).join("") : '<p class="empty">없음</p>';
  h += '<p class="small muted" style="margin:12px 0 0">일회성 복용</p>';
  h += once.map((x) => `<div class="oncex"><div class="onm"><input type="text" class="nm" id="on-n-${x.id}" data-ch="oncename" data-id="${x.id}" value="${esc(x.n)}" aria-label="약 이름"><button class="mini" data-act="oncedel" data-id="${x.id}">삭제</button></div><label class="eff"><span>증상</span><input type="text" id="os-${x.id}" data-ch="oncesym" data-id="${x.id}" value="${esc(x.sym || "")}" placeholder="왜 드셨나요? (예: 두통)"></label><label class="eff"><span>차도</span><input type="text" id="oe-${x.id}" data-ch="onceeff" data-id="${x.id}" value="${esc(x.eff || "")}" placeholder="먹고 나서 어땠나요? (나중에 적어도 됩니다)"></label></div>`).join("");
  h += '<div class="onceform"><input type="text" id="once-n" placeholder="약 이름"><div class="two"><input type="text" id="once-sym" placeholder="증상 (예: 두통)"><input type="text" id="once-eff" placeholder="차도 (선택)"></div><button class="btn sm" data-act="onceadd">일회성 약 추가</button></div></section>';
  return h;
}

/* hospital visit */
const vTitle = (v) => v.hosp || "병원 치료";
function nextVisit() { let best = null; for (const [d, v] of Object.entries(S.visit)) if (v.next && v.next >= TODAY && (!best || v.next < best.next)) best = { d, next: v.next, hosp: v.hosp }; return best; }
function visitCard(d) {
  const v = S.visit[d], filled = v && (v.hosp || v.treat || v.note || v.next);
  let h = `<section class="card"><h3>병원 치료<small>${v ? "치료 받은 날" : "기록 전"}</small></h3><div class="seg">`;
  h += v && filled ? armBtn("vdel:" + d, "치료 받은 날", "chip on", "한 번 더 누르면 치료 일지까지 삭제") : `<button class="chip${v ? " on" : ""}" data-act="vtoggle" aria-pressed="${!!v}">치료 받은 날</button>`;
  h += "</div>";
  if (v) h += `<div class="vsum">${filled ? `<strong class="small">${esc(vTitle(v))}</strong>${v.treat ? `<span class="small muted">${esc(v.treat)}</span>` : ""}${v.next ? `<span><span class="pill red">다음 예약 ${dlabel(v.next)}</span></span>` : ""}` : '<span class="small muted">치료 내용은 치료 일지에 적을 수 있습니다.</span>'}<div><button class="btn sm ghost" data-act="vopen" data-d="${d}">${filled ? "치료 일지 보기" : "치료 일지 쓰기"}</button></div></div>`;
  if (!v) { const n = Object.values(S.visit).find((x) => x.next === d); if (n) h += `<p class="small muted" style="margin:8px 0 0">오늘은 ${esc(vTitle(n))} 예약일입니다.</p>`; }
  return h + "</section>";
}
function vVisit() {
  const ds = Object.keys(S.visit).sort().reverse(), nx = nextVisit();
  let h = `<div class="datebar"><span style="width:38px;flex:none"></span><div class="mid"><div class="d">병원 치료 일지</div><span class="small muted">치료 받은 날 ${ds.length}일</span></div><span style="width:38px;flex:none"></span></div><div class="stack">`;
  if (nx) h += `<div class="nextbox"><div><div class="small muted">다음 예약</div><strong>${dlabel(nx.next)}</strong> <span class="small">${esc(nx.hosp || "")}</span></div><span class="pill red">${nx.next === TODAY ? "오늘" : `D-${Math.round((pd(nx.next) - pd(TODAY)) / 864e5)}`}</span></div>`;
  h += `<section class="card"><h3>새 치료 일지</h3><div class="row" style="flex-wrap:nowrap"><input type="date" id="vn-date" value="${TODAY}" max="${TODAY}"><button class="btn" data-act="vnew">쓰기</button></div>${ds.length ? `<button class="btn sm ghost" style="margin-top:8px" data-act="vcopylast">가장 최근 일지(${md(ds[0])}) 복사해서 쓰기</button>` : ""}<p class="small muted" style="margin:8px 0 0">오늘 기록 화면에서 "치료 받은 날"을 체크해도 이 목록에 추가됩니다.</p></section>`;
  if (!ds.length) h += '<p class="empty">아직 치료 일지가 없습니다.</p>';
  for (const d of ds) {
    const v = S.visit[d];
    if (UI.vOpen === d) {
      h += `<section class="card"><h3>${dlabel(d)}<small>치료 일지</small></h3><div class="vedit">
    <div class="two"><label>날짜<input type="date" id="ve-date" data-ch="vdate" data-d="${d}" value="${d}" max="${TODAY}"></label><label>다음 예약일<input type="date" id="ve-next" data-ch="vf" data-f="next" data-d="${d}" value="${v.next || ""}"></label></div>
    <label>병원 / 진료과<input type="text" id="ve-hosp" data-ch="vf" data-f="hosp" data-d="${d}" value="${esc(v.hosp)}" placeholder="예: 우리내과 소화기내과"></label>
    <label>치료 내용<textarea id="ve-treat" data-ch="vf" data-f="treat" data-d="${d}" placeholder="검사, 시술, 상담 내용">${esc(v.treat)}</textarea></label>
    <label>의사 소견 / 처방<textarea id="ve-note" data-ch="vf" data-f="note" data-d="${d}" placeholder="진단, 처방약, 생활 지침">${esc(v.note)}</textarea></label>
    <div class="vph"><span class="lbl">처방전/소견서 등</span><div class="vthumbs">${(v.ph || []).map((q, i) => { const u = photoUrl(q.th); return `<div class="thumbwrap">${u ? `<img class="thumb" src="${esc(u)}" alt="처방전/소견서 사진 ${i + 1}" data-act="vphview" data-d="${d}" data-id="${q.id}">` : '<span class="thumb ph"></span>'}<button class="x" data-act="vphdel" data-d="${d}" data-id="${q.id}" aria-label="사진 ${i + 1} 삭제">×</button></div>`; }).join("")}<label class="photo" title="처방전/소견서 사진 첨부">${ICON.cam}<input type="file" accept="image/*" multiple id="vp-${d}" data-ch="vphoto" data-d="${d}" aria-label="처방전/소견서 사진 첨부"></label></div></div>
    <div class="vcopy"><span class="small muted">이 일지를 다른 날짜로 복사 (다음 예약일과 사진은 옮기지 않습니다)</span><div class="row" style="flex-wrap:nowrap"><input type="date" id="vc-date" value="${TODAY}" max="${TODAY}"><button class="btn sm ghost" data-act="vcopy" data-d="${d}">복사</button></div></div>
    <div class="row" style="justify-content:space-between"><div class="row"><button class="btn sm ghost" data-act="calday" data-d="${d}">그날 기록 보기</button><button class="btn sm ghost" data-act="vopen" data-d="${d}">접기</button></div>${armBtn("vdel:" + d, "삭제", "btn sm danger", "한 번 더 누르면 삭제")}</div></div></section>`;
    } else {
      h += `<button class="vcard" data-act="vopen" data-d="${d}"><span class="dh"><strong>${dlabel(d)}</strong>${v.next ? `<span class="pill red">다음 ${md(v.next)}</span>` : ""}</span><span class="small">${esc(vTitle(v))}</span>${v.treat ? `<span class="t">${esc(v.treat)}</span>` : ""}${v.note ? `<span class="t">${esc(v.note)}</span>` : ""}${v.ph && v.ph.length ? `<span class="small muted">처방전/소견서 사진 ${v.ph.length}장</span>` : ""}${!v.hosp && !v.treat && !v.note ? '<span class="t">내용을 아직 적지 않았습니다. 눌러서 작성하세요.</span>' : ""}</button>`;
    }
  }
  return h + "</div>";
}
function visitRow(d) { const v = S.visit[d]; return { user_id: USER.id, date: d, hospital: v.hosp || null, treatment: v.treat || null, note: v.note || null, next_date: v.next || null, updated_at: now() }; }
function saveVisit(d) { return run("치료 일지", sb.from("hospital_visits").upsert(visitRow(d), { onConflict: "user_id,date" })); }
function visitIcon(d) {
  const v = S.visit[d], cross = '<svg viewBox="0 0 10 10"><path d="M5 2v6M2 5h6"/></svg>';
  if (v) return `<span class="vic" title="병원 치료: ${esc(vTitle(v))}">${cross}</span>`;
  const n = Object.values(S.visit).find((x) => x.next === d);
  return n ? `<span class="vic res" title="병원 예약: ${esc(vTitle(n))}">${cross}</span>` : "";
}
/* calendar */
const CAT = ["--c1", "--c2", "--c6", "--c7", "--c8", "--c9", "--c10"];
function colorOf(k) {
  if (k === "supp") return "var(--c3)"; if (k === "reg") return "var(--c4)"; if (k === "once") return "var(--c5)"; if (k === "sym") return "var(--lv2)"; if (k === "visit") return "var(--danger)";
  const it = itemById(k); if (it && it.type === "scale") return "var(--lv5)";
  const i = S.items.filter((x) => x.type !== "scale").findIndex((x) => x.id === k);
  return `var(${CAT[Math.max(0, i) % CAT.length]})`;
}
const isScale = (k) => { const it = itemById(k); return !!it && it.type === "scale"; };
/* 단계를 1(빨강)~5(초록) 색 칸으로 환산. 높을수록 나쁜 항목은 색 방향을 뒤집는다 */
function lvOf(it, s) { const n = it.options.length, v = n <= 1 ? 5 : Math.round(1 + (4 * (s - 1)) / (n - 1)); return it.bad ? 6 - v : v; }
function lvCircle(k, d) { const it = itemById(k), s = score(it, recOf(d, k)); return s ? `<span class="lvc lv${lvOf(it, s)}" title="${esc(it.name)} ${s}단계">${s}</span>` : ""; }
function calKeys() { const h = S.calHide || []; return filterKeys().filter((x) => !h.includes(x.k)); }
function filterKeys() {
  const symAt = visItems().findIndex((i) => (i.symptoms || []).some((y) => !y.hidden));
  return [{ k: "visit", n: "병원 치료" }, ...visItems().flatMap((i, j) => (j === symAt ? [{ k: i.id, n: i.name }, { k: "sym", n: "주요 증상" }] : [{ k: i.id, n: i.name }])), { k: "supp", n: "영양제" }, { k: "reg", n: "정기 복용 약" }, { k: "once", n: "일회성 약" }]; }
function calTag(k, d) {
  const T = (txt, cls) => `<span class="tg c${cls ? " " + cls : ""}" style="--c:${colorOf(k)}">${txt}</span>`;
  if (k === "supp") { const a = S.meds.filter((m) => m.kind === "supplement" && active(m, d)); if (!a.length) return ""; const t = a.filter((m) => (S.sup[d] || {})[m.id]).length; return `<span class="tg c${t === a.length ? " solid" : ""}" style="--c:${colorOf(k)}" title="영양제 ${t}/${a.length}">${t}/${a.length}</span>`; }
  if (k === "reg") { const a = S.meds.filter((m) => m.kind === "regular" && active(m, d)); if (!a.length) return ""; const t = a.filter((m) => (S.rl[d] || {})[m.id]).length; return `<span class="tg c ${t === a.length ? "solid" : "line"}" style="--c:${colorOf(k)}" title="정기 복용 약 ${t}/${a.length}">${t}/${a.length}</span>`; }
  if (k === "sym") { const es = visItems().flatMap((it) => symList(it, recOf(d, it.id))); return es.length ? `<span class="tg c" style="--c:${colorOf(k)}" title="${es.map(symLabel).join(", ")}">증상 ${es.length}</span>` : ""; }
  if (k === "once") { const a = S.once[d] || []; return a.length ? T(`${esc(a[0].n)}${a.length > 1 ? ` 외 ${a.length - 1}` : ""}`) : ""; }
  const it = itemById(k); if (!it) return "";
  if (it.type === "meal") { const m = S.meal[d] || {}; const n = MEALS.filter(([x]) => m[x] && (m[x].t || m[x].th)).length; return n ? T(`식사 ${n}/3`) : ""; }
  const r = recOf(d, k); if (r == null) return "";
  /* 칸이 좁아(아이폰 기준 한 칸 약 45px) 항목 이름은 빼고 값만 보여 준다. 항목은 색으로 구분하고, 전체 내용은 title로 남긴다 */
  const sh = esc(it.name.slice(0, 2)), T2 = (txt, full, cls) => `<span class="tg c${cls ? " " + cls : ""}" style="--c:${colorOf(k)}" title="${esc(it.name)} ${full}">${txt}</span>`;
  if (it.type === "number") return T(`${r.v}${esc(it.unit || "")}`);
  if (it.type === "bool") return r.v ? T2(it.note && r.t ? esc(r.t) : sh, it.note && r.t ? esc(r.t) : "", "solid") : "";
  if (it.type === "choice") { if (!r.v) return T2("없음", "없음"); const op = it.options.find((x) => x.id === r.o); return T2(op ? esc(op.label) : sh, op ? esc(op.label) : "있음", "solid"); }
  if (it.type === "text") return r.v ? T("메모") : "";
  return "";
}
function vCal() {
  const m = UI.cal, [y, mo] = m.split("-").map(Number);
  const keys = calKeys(), sel = (UI.calF || []).filter((k) => keys.some((x) => x.k === k));
  let h = `<div class="datebar"><button class="iconbtn" data-act="calshift" data-n="-1" aria-label="이전 달">‹</button><div class="mid"><div class="d">${y}년 ${mo}월</div>${m !== TODAY.slice(0, 7) ? '<button class="link" data-act="caltoday">이번 달로</button>' : ""}</div><button class="iconbtn" data-act="calshift" data-n="1" aria-label="다음 달">›</button></div>`;
  h += `<div class="filters">${keys.map((x) => `<button class="chip sm f${sel.includes(x.k) ? " on" : ""}" style="--c:${colorOf(x.k)}" data-act="calf" data-k="${x.k}" aria-pressed="${sel.includes(x.k)}"><i class="dot${isScale(x.k) ? " ramp" : ""}"></i>${esc(x.n)}</button>`).join("")}</div>`;
  h += `<div class="cal">${["일", "월", "화", "수", "목", "금", "토"].map((x) => `<div class="dow">${x}</div>`).join("")}`;
  const end = lastDay(m); let d = sunday(m + "-01");
  while (d <= end || pd(d).getDay() !== 0) {
    const out = d.slice(0, 7) !== m, fut = d > TODAY;
    h += `<button class="cell${out ? " out" : ""}${fut ? " fut" : ""}${d === TODAY ? " today" : ""}${sel.includes("visit") && S.visit[d] ? " hv" : ""}" data-act="calday" data-d="${d}" ${fut ? "disabled" : ""} aria-label="${dlabel(d)}${S.visit[d] ? ", 병원 치료" : ""}"><span class="hd"><span class="dn"><span class="n">${pd(d).getDate()}</span>${sel.includes("visit") ? visitIcon(d) : ""}</span>${fut ? "" : sel.filter(isScale).map((k) => lvCircle(k, d)).join("")}</span>${fut ? "" : sel.filter((k) => !isScale(k) && k !== "visit").map((k) => calTag(k, d)).join("")}</button>`;
    d = add(d, 1);
  }
  h += `</div>${sel.filter(isScale).map((k) => { const it = itemById(k); return `<div class="legend"><span class="small muted">${esc(it.name)}: 단계를 누르면 그 단계로 기록한 날을 모아 볼 수 있습니다</span><div class="lgs">${it.options.map((x, j) => `<button class="lg" data-act="lvgo" data-i="${it.id}" data-n="${j + 1}"><span class="lvc lv${lvOf(it, j + 1)}">${j + 1}</span>${esc(x.label)}</button>`).join("")}</div></div>`; }).join("")}<p class="small muted">${sel.length ? "칸 안의 글자는 위쪽 항목과 같은 색으로 구분하며, 값만 짧게 표시합니다 (예: 배변 \"정상\", 영양제 \"2/3\"). 날짜를 누르면 그날의 기록을 볼 수 있습니다. 위쪽 항목은 설정의 \"캘린더 항목\"에서 바꿀 수 있습니다." : "위에서 보고 싶은 항목을 하나 이상 선택해 주세요."}</p>`;
  return h;
}

/* 조회 모드: 하루 기록을 한 줄씩 요약해서 보여 준다 (수정은 "기록 수정"으로 편집 화면에서) */
function vDay() {
  const d = UI.date, r = S.rec[d] || {}, rows = [], miss = [];
  const row = (l, v) => rows.push(`<div class="dr"><span class="dl">${l}</span><div class="dv">${v}</div></div>`);
  for (const it of visItems()) {
    const x = r[it.id], nm = esc(it.name);
    if (it.type === "meal") {
      const m = S.meal[d] || {};
      const ls = MEALS.filter(([k]) => m[k] && (m[k].t || m[k].th || m[k].s)).map(([k, l]) => { const u = m[k].th ? photoUrl(m[k].th) : null; return `<div><span class="muted small">${l}</span> ${esc(m[k].t || "")}${m[k].s ? ` <span class="muted">· 증상: ${esc(m[k].s)}</span>` : ""}${u ? `<img class="mth" src="${esc(u)}" alt="${l} 사진" data-act="photo" data-k="${k}">` : ""}</div>`; });
      ls.length ? row(nm, ls.join("")) : miss.push(nm); continue;
    }
    if (x == null) { miss.push(nm); continue; }
    if (it.type === "scale") { const sc = score(it, x), es = symList(it, x); row(nm, `${sc ? `<span class="lvc lv${lvOf(it, sc)}">${sc}</span>${esc(it.options[sc - 1].label)}` : '<span class="muted">단계 미기록</span>'}${es.length ? `<div class="small">증상: ${es.map(symLabel).join(", ")}</div>` : ""}`); }
    else if (it.type === "number") row(nm, `${x.v}${esc(it.unit || "")}`);
    else if (it.type === "bool") row(nm, x.v ? `예${x.t ? " · " + esc(x.t) : ""}` : '<span class="muted">아니오</span>');
    else if (it.type === "choice") { const op = it.options.find((q) => q.id === x.o); row(nm, x.v ? `있음${op ? " · " + esc(op.label) : ""}` : '<span class="muted">없음</span>'); }
    else if (it.type === "text") row(nm, esc(x.v));
  }
  const sp = S.meds.filter((m) => m.kind === "supplement" && active(m, d));
  if (sp.length) row("영양제", sp.map((m) => ((S.sup[d] || {})[m.id] ? `<span class="ok">✓ ${esc(m.name)}</span>` : `<span class="muted">✗ ${esc(m.name)}</span>`)).join(" &nbsp;"));
  const rg = S.meds.filter((m) => m.kind === "regular" && active(m, d));
  if (rg.length) row("정기 약", rg.map((m) => { const q = (S.rl[d] || {})[m.id]; return `<div>${q ? `<span class="ok">✓ ${esc(m.name)}</span>${q.eff ? ` <span class="muted">· ${esc(q.eff)}</span>` : ""}` : `<span class="muted">✗ ${esc(m.name)}</span>`}</div>`; }).join(""));
  const on = S.once[d] || [];
  if (on.length) row("일회성 약", on.map((q) => `<div>${esc(q.n)}${q.sym || q.eff ? ` <span class="muted">· ${esc(q.sym || "-")} → ${esc(q.eff || "차도 미기록")}</span>` : ""}</div>`).join(""));
  const vv = S.visit[d];
  if (vv) row('<span style="color:var(--danger)">병원</span>', `<strong>${esc(vTitle(vv))}</strong>${vv.treat ? ` <span class="muted">· ${esc(vv.treat)}</span>` : ""}${vv.ph && vv.ph.length ? ` <span class="muted">· 사진 ${vv.ph.length}장</span>` : ""} <button class="link" data-act="vopen" data-d="${d}">일지 보기</button>`);
  let h = `<div class="datebar"><button class="iconbtn" data-act="dvshift" data-n="-1" aria-label="이전 날">‹</button><div class="mid"><div class="d">${dlabel(d)}</div><span class="small muted">${d === TODAY ? "오늘 · " : ""}기록 보기</span></div><button class="iconbtn" data-act="dvshift" data-n="1" aria-label="다음 날" ${d >= TODAY ? "disabled" : ""}>›</button></div>`;
  h += '<div class="row dact"><button class="btn sm ghost" data-act="nav" data-v="cal">‹ 캘린더</button><button class="btn sm" data-act="dedit">기록 수정</button></div>';
  h += `<section class="card dview">${rows.join("") || '<p class="empty">이 날짜에는 기록이 없습니다.</p>'}${miss.length && rows.length ? `<p class="small muted dmiss">기록 안 함: ${miss.join(", ")}</p>` : ""}</section>`;
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
    if (it.type === "meal") { const m = S.meal[d] || {}; const s = MEALS.filter(([k]) => m[k] && (m[k].t || m[k].s)).map(([k, l]) => `${l} ${m[k].t || ""}${m[k].s ? ` (증상: ${m[k].s})` : ""}`); if (s.length) notes.push(esc(s.join(" / "))); continue; }
    if (x == null) continue;
    if (it.type === "scale") { const s = score(it, x); if (s) tags.push(`<span class="tg c" style="--c:var(--lv${lvOf(it, s)});color:var(--ink)">${esc(it.name)} ${s}</span>`); }
    else if (it.type === "number") tags.push(T(`${esc(it.name)} ${x.v}${esc(it.unit || "")}`));
    else if (it.type === "bool") { if (x.v) tags.push(T(`${esc(it.name)}${x.t ? " " + esc(x.t) : ""}`, "solid")); }
    else if (it.type === "choice") { if (x.v) { const op = it.options.find((o) => o.id === x.o); tags.push(T(`${esc(it.name)} ${op ? esc(op.label) : "있음"}`, "solid")); } }
    else if (it.type === "text" && x.v) notes.push("메모: " + esc(x.v));
  }
  const a = S.meds.filter((m) => m.kind === "supplement" && active(m, d));
  if (a.length) { const t = a.filter((m) => (S.sup[d] || {})[m.id]).length; tags.push(`<span class="tg c" style="--c:${colorOf("supp")}">영양제 ${t}/${a.length}</span>`); }
  const ra = S.meds.filter((m) => m.kind === "regular" && active(m, d));
  if (ra.length) { const t = ra.filter((m) => (S.rl[d] || {})[m.id]).length; tags.push(`<span class="tg c" style="--c:${colorOf("reg")}">정기 약 ${t}/${ra.length}</span>`); }
  if (S.visit[d]) tags.push(`<span class="tg c solid" style="--c:var(--danger)">${esc(vTitle(S.visit[d]))}</span>`);
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
  const W = 320, H = 92, L = 34, R = 10, T = 8, B = 18, n = days.length;
  const X = (i) => L + (n === 1 ? 0 : ((W - L - R) * i) / (n - 1)), Y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  let p = "", dots = "";
  vals.forEach((v, i) => { if (v == null) return; p += (p ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); dots += `<circle class="dt" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${n > 10 ? 2 : 3}"/>`; });
  const mid = (lo + hi) / 2, f = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="일별 추이">${[hi, mid, lo].map((v) => `<line class="gr" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${f(v)}</text>`).join("")}<path class="ln" d="${p}"/>${dots}<text x="${L}" y="${H - 4}">${md(days[0])}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${md(days[n - 1])}</text></svg>`;
}
function mChart(vals, lo, hi, bars) {
  const W = 320, H = 100, L = 34, R = 8, T = 8, B = 20, cw = (W - L - R) / 12, X = (i) => L + cw * i + cw / 2, Y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const mid = (lo + hi) / 2, f = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
  const grid = [hi, mid, lo].map((v) => `<line class="gr" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L - 6}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${f(v)}</text>`).join("");
  let marks = "";
  if (bars) vals.forEach((v, i) => { if (v) marks += `<rect class="bx" x="${(X(i) - cw * 0.3).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(cw * 0.6).toFixed(1)}" height="${(Y(lo) - Y(v)).toFixed(1)}" rx="2"/>`; });
  else { let p = "", dots = ""; vals.forEach((v, i) => { if (v == null) return; p += (p ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); dots += `<circle class="dt" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3"/>`; }); marks = `<path class="ln" d="${p}"/>${dots}`; }
  const xl = vals.map((_, i) => `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${i + 1}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 추이">${grid}${marks}${xl}</svg>`;
}
/* 리포트 한 줄: 이름 | 막대 | 값, 아래에 작은 설명 */
function crow(nm, num, den, v, sub) {
  return `<div class="crow"><span class="nm">${nm}</span><div class="bar"><i style="width:${den ? Math.round((100 * num) / den) : 0}%"></i></div><span class="v">${v}</span></div>${sub ? `<div class="sub">${sub}</div>` : ""}`;
}
/* 연간 리포트 한 줄: 막대 자리에 1~12월 작은 막대 */
function micro(vals, nm, v, sub) {
  const mx = Math.max(1, ...vals);
  const bars = vals.map((x, i) => { const hh = x ? Math.max(2, (16 * x) / mx) : 0; return `<rect x="${i * 10 + 1}" y="${(18 - hh).toFixed(1)}" width="8" height="${hh.toFixed(1)}" rx="1"/>`; }).join("");
  return `<div class="crow"><span class="nm">${nm}</span><svg class="micro" viewBox="0 0 120 18" preserveAspectRatio="none" role="img" aria-label="월별 일수"><line x1="0" x2="120" y1="17.5" y2="17.5"/>${bars}</svg><span class="v">${v}</span></div>${sub ? `<div class="sub">${sub}</div>` : ""}`;
}
const avg = (a) => (a.length ? a.reduce((x, z) => x + z, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const sgn = (v) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}`;

function vRep() {
  const [s, e, label] = repRange(), days = daysOf(s, e), past = days.filter((d) => d <= TODAY), yr = UI.rep === "year";
  let h = `<div class="row" style="justify-content:center;margin-bottom:10px"><div class="toggle">${[["week", "주간"], ["month", "월간"], ["year", "연간"]].map(([k, l]) => `<button class="${UI.rep === k ? "on" : ""}" data-act="repmode" data-k="${k}">${l}</button>`).join("")}</div></div>`;
  h += `<div class="datebar"><button class="iconbtn" data-act="repshift" data-n="-1" aria-label="이전 기간">‹</button><div class="mid"><div class="d">${label}</div><span class="small muted">기록 대상 ${past.length}일${yr ? " · 그래프는 월별" : ""}</span></div><button class="iconbtn" data-act="repshift" data-n="1" aria-label="다음 기간" ${e >= TODAY ? "disabled" : ""}>›</button></div><div class="stack">`;
  if (!past.length) return h + '<p class="empty">아직 지나지 않은 기간입니다.</p></div>';
  const Y = UI.repA.slice(0, 4), M = yr ? [...Array(12)].map((_, i) => past.filter((d) => d.startsWith(`${Y}-${pad(i + 1)}`))) : null;
  const has = (it) => past.some((d) => (it.type === "meal" ? S.meal[d] : recOf(d, it.id) != null));
  const shown = S.items.filter((it) => !it.hidden || has(it));
  const nmOf = (it) => `${esc(it.name)}${it.hidden ? ' <span class="muted">(숨김)</span>' : ""}`;
  const yesDays = (it, ds) => ds.filter((d) => { const r = recOf(d, it.id); return r && r.v; }).length;

  for (const it of shown.filter((i) => i.type === "scale")) {
    const sc = (d) => score(it, recOf(d, it.id)), ok = past.map(sc).filter((x) => x != null), a = avg(ok);
    h += `<section class="card"><h3><span>${nmOf(it)}</span><small>${yr ? "연평균" : "평균"} <b class="num-t">${a == null ? "-" : a.toFixed(1)}</b> / ${it.options.length}${it.bad ? " · 높을수록 나쁨" : ""} · ${ok.length}일</small></h3>`;
    if (ok.length) h += yr ? mChart(M.map((ds) => r1(avg(ds.map(sc).filter((x) => x != null)))), 1, it.options.length, false) : lineChart(days.map((d) => (d <= TODAY ? sc(d) : null)), days, 1, it.options.length);
    if (it.symptoms && it.symptoms.length) {
      const rs = past.map((d) => recOf(d, it.id)).filter(Boolean), n = rs.length;
      h += `<div class="ctl">주요 증상 <span style="font-weight:400">(기록 ${n}일 중)</span></div>` + it.symptoms.map((yy) => {
        const hit = rs.filter((r) => r.sx && yy.id in r.sx); if (yy.hidden && !hit.length) return "";
        const br = yy.options.map((x) => [x.label, hit.filter((r) => r.sx[yy.id] === x.id).length]).filter((q) => q[1]), none = hit.filter((r) => !r.sx[yy.id]).length;
        const sub = [...br.map(([l, c]) => `${esc(l)} ${c}`), ...(none ? [`정도 미기록 ${none}`] : [])].join(" · ");
        return yr ? micro(M.map((ds) => ds.filter((d) => { const r = recOf(d, it.id); return r && r.sx && yy.id in r.sx; }).length), esc(yy.name), `${hit.length}일`, sub) : crow(esc(yy.name), hit.length, n, `${hit.length}일`, sub);
      }).join("");
    }
    h += "</section>";
  }
  for (const it of shown.filter((i) => i.type === "number")) {
    const u = esc(it.unit || ""), seq = past.map((d) => recOf(d, it.id)).filter(Boolean).map((r) => r.v);
    if (!seq.length) { h += `<section class="card"><h3><span>${nmOf(it)}</span><small>기록 없음</small></h3></section>`; continue; }
    const vals = yr ? M.map((ds) => r1(avg(ds.map((d) => recOf(d, it.id)).filter(Boolean).map((r) => r.v)))) : days.map((d) => { const r = recOf(d, it.id); return r ? r.v : null; });
    const ok = vals.filter((x) => x != null), lo = Math.floor(Math.min(...ok) * 2 - 1) / 2, hi = Math.ceil(Math.max(...ok) * 2 + 1) / 2;
    h += `<section class="card"><h3><span>${nmOf(it)}</span><small>최근 <b class="num-t">${seq[seq.length - 1]}${u}</b> · 처음보다 ${sgn(seq[seq.length - 1] - seq[0])}${u} · ${seq.length}일</small></h3>${yr ? mChart(vals, lo, hi, false) : lineChart(vals, days, lo, hi)}</section>`;
  }
  let lr = "";
  for (const it of shown) {
    if (it.type === "bool" || it.type === "choice") {
      const rs = past.map((d) => recOf(d, it.id)).filter(Boolean), ys = rs.filter((r) => r.v);
      let sub;
      if (it.type === "bool") { const c = {}; ys.forEach((r) => { if (r.t) c[r.t] = (c[r.t] || 0) + 1; }); sub = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${esc(k)} ${n}`).join(" · "); }
      else sub = it.options.map((x) => [x.label, ys.filter((r) => r.o === x.id).length]).filter((q) => q[1]).map(([l, c]) => `${esc(l)} ${c}`).join(" · ");
      const v = `${ys.length}/${rs.length}일`;
      lr += yr ? micro(M.map((ds) => yesDays(it, ds)), nmOf(it), v, sub) : crow(nmOf(it), ys.length, rs.length, v, sub);
    } else if (it.type === "meal") {
      const cnt = MEALS.map(([k, l]) => [l, past.filter((d) => { const m = (S.meal[d] || {})[k]; return m && (m.t || m.th); }).length]), tot = cnt.reduce((a, b) => a + b[1], 0);
      lr += crow(nmOf(it), tot, past.length * 3, `${tot}/${past.length * 3}끼`, cnt.map(([l, c]) => `${l} ${c}`).join(" · "));
    }
  }
  if (lr) h += `<section class="card"><h3>생활 기록<small>${yr ? "막대는 월별 일수" : '"예"인 날 / 기록한 날'}</small></h3>${lr}</section>`;
  let mr = "";
  S.meds.filter((m) => m.kind === "regular" && past.some((d) => active(m, d))).forEach((m) => {
    const ad = past.filter((d) => active(m, d)), tk = ad.filter((d) => (S.rl[d] || {})[m.id]);
    const ef = tk.filter((d) => S.rl[d][m.id].eff).slice(-3).reverse().map((d) => `${md(d)} ${esc(S.rl[d][m.id].eff)}`).join(" · ");
    mr += crow(`${esc(m.name)} <span class="small muted">정기</span>`, tk.length, ad.length, `${tk.length}/${ad.length}일`, ef);
  });
  S.meds.filter((m) => m.kind === "supplement" && past.some((d) => active(m, d))).forEach((m) => {
    const ad = past.filter((d) => active(m, d)), t = ad.filter((d) => (S.sup[d] || {})[m.id]).length;
    mr += crow(esc(m.name), t, ad.length, `${t}/${ad.length}일`);
  });
  let ol = "";
  if (yr) { const c = {}; past.forEach((d) => (S.once[d] || []).forEach((x) => (c[x.n] = (c[x.n] || 0) + 1))); ol = Object.entries(c).sort((a, b) => b[1] - a[1]).map(([n, k]) => `<div class="cl">${esc(n)} <span class="muted">· ${k}회</span></div>`).join(""); }
  else ol = past.flatMap((d) => (S.once[d] || []).map((x) => `<div class="cl"><span class="num-t muted">${md(d)}</span> ${esc(x.n)}${x.sym || x.eff ? ` <span class="muted">· ${esc(x.sym || "-")} → ${esc(x.eff || "차도 미기록")}</span>` : ""}</div>`)).join("");
  h += `<section class="card"><h3>약/영양제<small>복용한 날 / 복용 기간</small></h3>${mr}${ol ? `<div class="ctl">일회성 약</div>${ol}` : ""}${!mr && !ol ? '<p class="empty">이 기간에 복용 기록이 없습니다.</p>' : ""}</section>`;
  const vs = past.filter((d) => S.visit[d]);
  h += `<section class="card"><h3>병원 치료<small>${vs.length}일</small></h3>${vs.length ? vs.slice().reverse().map((d) => `<div class="cl"><span class="num-t muted">${md(d)}</span> ${esc(vTitle(S.visit[d]))}${S.visit[d].treat ? ` <span class="muted">· ${esc(S.visit[d].treat)}</span>` : ""}</div>`).join("") : '<p class="empty" style="padding:0">치료 기록 없음</p>'}</section>`;
  return h + "</div>";
}

/* 일기 (v1.6): 기록/캘린더와 상관없이 자유롭게 쓰는 글 */
function vDiary() {
  const ds = (S.diary || []).slice().sort((a, b) => b.d.localeCompare(a.d) || b.at - a.at), ed = UI.dEdit;
  let h = '<div class="datebar"><span style="width:38px;flex:none"></span><div class="mid"><div class="d">일기</div><span class="small muted">기록과 상관없이 자유롭게 씁니다</span></div><span style="width:38px;flex:none"></span></div>';
  if (ed === "new") h += diaryForm({ id: "new", d: TODAY, title: "", body: "" });
  else h += '<button class="btn" style="width:100%;margin-bottom:12px" data-act="dnew">새 일기 쓰기</button>';
  if (!ds.length && ed !== "new") return h + '<p class="empty">아직 쓴 일기가 없습니다.</p>';
  h += '<div class="stack">';
  for (const x of ds) {
    if (ed === x.id) { h += diaryForm(x); continue; }
    const open = (UI.dOpen || {})[x.id];
    h += `<section class="card dy"><button class="dyhd" data-act="dopen" data-id="${x.id}"><span class="dd">${md(x.d)} <span class="muted">${"일월화수목금토"[pd(x.d).getDay()]}요일</span></span>${x.title ? `<strong>${esc(x.title)}</strong>` : ""}</button><p class="dybody${open ? " open" : ""}" data-act="dopen" data-id="${x.id}">${esc(x.body)}</p><div class="row" style="justify-content:flex-end"><button class="link" data-act="dedit2" data-id="${x.id}">수정</button></div></section>`;
  }
  return h + "</div>";
}
function diaryForm(x) {
  return `<section class="card dyform"><div class="row" style="justify-content:space-between"><strong class="small">${x.id === "new" ? "새 일기" : "일기 수정"}</strong><button class="link" data-act="dcancel">닫기</button></div><label class="small muted">날짜<input type="date" id="dy-d" value="${x.d}" max="${TODAY}"></label><input type="text" id="dy-t" value="${esc(x.title || "")}" placeholder="제목 (선택)" aria-label="제목"><textarea id="dy-b" rows="8" placeholder="오늘 있었던 일, 드는 생각을 자유롭게 적어 보세요." aria-label="일기 내용">${esc(x.body || "")}</textarea><div class="row" style="justify-content:space-between">${x.id === "new" ? "<span></span>" : armBtn("ddel:" + x.id, "삭제", "btn sm danger", "한 번 더 누르면 삭제")}<button class="btn sm" data-act="dsave" data-id="${x.id}">저장</button></div></section>`;
}

/* 약 기록 모음: 차도를 적은 날을 약 이름별로 모은다. 띄어쓰기/대소문자만 다른 이름은 같은 약으로 본다 */
function medGroups() {
  const key = (n) => String(n || "").replace(/\s+/g, "").toLowerCase(), G = {};
  const put = (name, row) => { const k = key(name); if (!k) return; const g = (G[k] = G[k] || { k, name: String(name).trim(), rows: [], kinds: new Set() }); g.rows.push(row); g.kinds.add(row.kind); };
  for (const [d, o] of Object.entries(S.rl || {})) for (const [id, q] of Object.entries(o)) { if (!q || !q.eff) continue; const m = S.meds.find((x) => x.id === id); if (m) put(m.name, { d, kind: "정기", eff: q.eff }); }
  for (const [d, a] of Object.entries(S.once || {})) for (const x of a) if (x.eff) put(x.n, { d, kind: "일회성", sym: x.sym, eff: x.eff });
  const gs = Object.values(G);
  gs.forEach((g) => { g.rows.sort((a, b) => b.d.localeCompare(a.d)); const m = S.meds.find((x) => key(x.name) === g.k && x.note); g.memo = m ? m.note : ""; });
  return gs.sort((a, b) => b.rows[0].d.localeCompare(a.rows[0].d));
}
function vMedLog() {
  const gs = medGroups();
  let h = '<div class="datebar"><span style="width:38px;flex:none"></span><div class="mid"><div class="d">약 기록 모음</div><span class="small muted">차도를 적은 날만 약별로 모았습니다</span></div><span style="width:38px;flex:none"></span></div>';
  if (!gs.length) return h + '<p class="empty">아직 차도를 적은 약 기록이 없습니다. 오늘 기록 화면에서 정기 약이나 일회성 약의 차도를 적으면 여기에 모입니다.</p>';
  h += '<div class="stack">';
  for (const g of gs) {
    const open = (UI.mlOpen || {})[g.k], rows = open ? g.rows : g.rows.slice(0, 3), both = g.kinds.size > 1;
    h += `<section class="card mlg"><h3><span>${esc(g.name)} ${[...g.kinds].map((k) => `<span class="pill${k === "정기" ? " warm" : ""}">${k}</span>`).join(" ")}</span><small>${g.rows.length}건 · 최근 ${md(g.rows[0].d)}</small></h3>${g.memo ? `<p class="mlmemo">메모: ${esc(g.memo)}</p>` : ""}`;
    h += rows.map((r) => `<button class="mlr" data-act="calday" data-d="${r.d}"><span class="dd">${md(r.d)}</span><span class="tx">${r.sym ? `<span class="sy">${esc(r.sym)} → </span>` : ""}${esc(r.eff)}</span>${both ? `<span class="small muted">${r.kind}</span>` : "<span></span>"}</button>`).join("");
    if (g.rows.length > 3) h += `<button class="link" style="margin-top:6px" data-act="mlmore" data-k="${esc(g.k)}">${open ? "접기" : `${g.rows.length - 3}건 더 보기`}</button>`;
    h += "</section>";
  }
  return h + '</div><p class="small muted">띄어쓰기와 영문 대소문자만 다른 이름은 같은 약으로 묶습니다 (예: 케이캡정25mg = 케이캡정 25mg). 기록을 누르면 그날 기록을 볼 수 있습니다.</p>';
}

/* meds */
function status(m) { if (TODAY < m.start) return ["예정", ""]; if (m.end && m.end < TODAY) return ["종료", ""]; return ["복용 중", "on"]; }
function vMed() {
  let h = "";
  for (const [kind, title, desc] of [["regular", "정기 복용 약", "복용 기간 동안 오늘 기록 화면에 나타나며, 그날 복용 여부와 차도를 체크합니다."], ["supplement", "영양제", "복용 기간 동안 오늘 기록 화면에 체크리스트로 나타납니다."]]) {
    const all = S.meds.filter((m) => m.kind === kind).sort((a, b) => b.start.localeCompare(a.start));
    /* 정기 복용 약은 복용이 끝난 약을 접어 둔다 (수정 중인 약은 펼친 목록에 남긴다) */
    const ended = kind === "regular" ? all.filter((m) => status(m)[0] === "종료" && UI.medEdit !== m.id) : [];
    const list = all.filter((m) => !ended.includes(m));
    h += `<h2 class="sec">${title}</h2><section class="card"><p class="small muted" style="margin:0">${desc}</p>`;
    h += list.length ? list.map((m) => {
      const [st, c] = status(m), ed = UI.medEdit === m.id;
      return `<div class="med"><div class="row" style="justify-content:space-between;flex-wrap:nowrap">${ed ? `<input type="text" id="mn-${m.id}" data-ch="mname" data-m="${m.id}" value="${esc(m.name)}" aria-label="이름">` : `<strong>${esc(m.name)}</strong>`}<span class="row" style="flex-wrap:nowrap"><span class="pill ${c}">${st}</span><button class="mini" data-act="medit" data-m="${m.id}">${ed ? "완료" : "수정"}</button></span></div>
   ${ed ? `<div class="dates"><label>시작일<input type="date" id="ms-${m.id}" data-ch="mstart" data-m="${m.id}" value="${m.start}"></label><label>종료일 (비우면 계속)<input type="date" id="me-${m.id}" data-ch="mend" data-m="${m.id}" value="${m.end || ""}"></label></div>
   <div class="row">${st !== "종료" ? `<button class="btn sm ghost" data-act="medend" data-m="${m.id}">오늘로 복용 종료</button>` : ""}${armBtn("del:" + m.id, "삭제", "btn sm danger")}</div>` : `<span class="small muted num-t">${md(m.start)} ~ ${m.end ? md(m.end) : "계속"}</span>`}
   <label class="mnote"><span class="small muted">${kind === "regular" ? "메모 · 차도" : "메모"}</span><textarea id="mo-${m.id}" data-ch="mnote" data-m="${m.id}" rows="2" placeholder="${kind === "regular" ? "복용법, 차도, 부작용 등" : "복용법 등"}">${esc(m.note || "")}</textarea></label></div>`;
    }).join("") : `<p class="empty">${ended.length ? "지금 복용 중인 약이 없습니다." : "등록된 항목이 없습니다."}</p>`;
    if (ended.length) {
      const op = UI.showEnded;
      h += `<button class="link endtg" data-act="endtg" aria-expanded="${!!op}">${op ? "복용 종료된 약 접기" : `복용 종료된 약 ${ended.length}개 보기`}</button>`;
      if (op) h += `<div class="endl">${ended.map((m) => `<div class="endr"><span><strong>${esc(m.name)}</strong> <span class="num-t">${md(m.start)} ~ ${md(m.end)}</span></span><button class="mini" data-act="medit" data-m="${m.id}">수정</button>${m.note ? `<span class="nt">${esc(m.note)}</span>` : ""}</div>`).join("")}</div>`;
    }
    h += UI.madd !== kind ? `<button class="btn ghost sm addbtn" data-act="maddopen" data-k="${kind}">+ 새 ${title} 등록</button></section>` : `<div class="form"><div class="row" style="justify-content:space-between"><strong class="small">새 ${title} 등록</strong><button class="link" data-act="maddopen" data-k="">닫기</button></div><input type="text" id="ma-${kind}-n" placeholder="이름"><div class="two"><label>시작일<input type="date" id="ma-${kind}-s" value="${TODAY}"></label><label>종료일 (선택)<input type="date" id="ma-${kind}-e"></label></div><input type="text" id="ma-${kind}-note" placeholder="메모 (예: 아침 식후 1정)"><button class="btn" data-act="medadd" data-k="${kind}">등록</button></div></section>`;
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
   <div class="row"><span class="pill">${TYPES[it.type]}${it.unit ? ` · ${esc(it.unit)}` : ""}${it.type === "bool" && it.note ? " · 내용 칸" : ""}</span>${it.type === "scale" ? `<button class="link" data-act="ibad" data-i="${it.id}">${it.bad ? "높을수록 나쁨 (바꾸기)" : "높을수록 좋음 (바꾸기)"}</button>` : ""}${it.type === "bool" ? `<button class="link" data-act="inote" data-i="${it.id}">${it.note ? "내용 칸 끄기" : "내용 칸 켜기"}</button>` : ""}${it.hidden ? '<span class="pill warm">숨김</span>' : ""}${hasOpt ? `<button class="link" data-act="iopen" data-i="${it.id}">${open ? "선택지 접기" : `선택지 편집 (${it.options.filter((x) => !x.hidden).length}개)`}</button>` : ""}${it.type === "scale" ? `<button class="link" data-act="symopen" data-i="${it.id}">${UI.open["sx" + it.id] ? "주요 증상 접기" : `주요 증상 편집 (${(it.symptoms || []).filter((y) => !y.hidden).length}개)`}</button>` : ""}</div>`;
    if (it.type === "scale" && UI.open["sx" + it.id]) {
      const ys = it.symptoms || [];
      const optEd = (y) => y.options.map((x, j) => `<div class="opt${x.hidden ? " hid" : ""}"><span class="small muted">·</span><input type="text" id="sl-${x.id}" data-ch="solabel" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}" value="${esc(x.label)}" aria-label="${esc(y.name)} 선택지 이름"><div class="row"><button class="mini" data-act="somove" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}" data-n="-1" ${j === 0 ? "disabled" : ""} aria-label="위로">↑</button><button class="mini" data-act="somove" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}" data-n="1" ${j === y.options.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button><button class="mini" data-act="sohide" data-i="${it.id}" data-s="${y.id}" data-o="${x.id}">${x.hidden ? "표시" : "숨김"}</button></div></div>`).join("") + `<div class="grid2" style="grid-template-columns:minmax(0,1fr) auto;margin-top:0"><input type="text" id="so-${y.id}" placeholder="${esc(y.name)} 새 선택지"><button class="btn sm" data-act="soadd" data-i="${it.id}" data-s="${y.id}">추가</button></div>`;
      h += `<div class="opts"><p class="small muted" style="margin:0">기록 화면에서 ${esc(it.name)}와 함께 체크할 증상입니다. 증상 이름을 바꾸면 지난 기록에도 바뀐 이름이 보입니다. 기록이 있는 증상을 삭제하면 기록 화면에서만 빠지고, 지난 기록과 리포트에는 남습니다.</p>${ys.map((y, k) => {
        const dk = `symdel:${it.id}:${y.id}`;
        return `<div class="symset${y.hidden ? " hid" : ""}"><div class="symhd"><input type="text" class="nm" id="sn-${y.id}" data-ch="symname" data-i="${it.id}" data-s="${y.id}" value="${esc(y.name)}" aria-label="증상 이름"><div class="row"><button class="mini" data-act="symmove" data-i="${it.id}" data-s="${y.id}" data-n="-1" ${k === 0 ? "disabled" : ""} aria-label="위로">↑</button><button class="mini" data-act="symmove" data-i="${it.id}" data-s="${y.id}" data-n="1" ${k === ys.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button>${y.hidden ? `<button class="mini" data-act="symshow" data-i="${it.id}" data-s="${y.id}">다시 표시</button>` : `<button class="mini${ARM === dk ? " armed" : ""}" data-act="arm" data-k="${dk}">${ARM === dk ? "정말 삭제" : "삭제"}</button>`}</div></div>${y.hidden ? '<span class="small muted">숨긴 증상 (지난 기록에만 남아 있음)</span>' : UI.open["so" + y.id] ? `<button class="link sm" data-act="soopen" data-s="${y.id}">선택지 접기</button>${optEd(y)}` : `<button class="link sm" data-act="soopen" data-s="${y.id}">선택지 편집 · ${esc(y.options.filter((x) => !x.hidden).map((x) => x.label).join("/"))}</button>`}</div>`;
      }).join("")}<div class="symadd"><input type="text" id="sa-${it.id}" placeholder="새 증상 이름 (예: 메스꺼움)"><button class="btn sm" data-act="symadd" data-i="${it.id}">증상 추가</button></div><p class="small muted" style="margin:0">새 증상은 약함/보통/심함 선택지로 시작합니다.</p></div>`;
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
  ${t === "scale" || t === "choice" ? `<input type="text" id="ni-opts" placeholder="${t === "scale" ? "1단계부터 쉼표로 구분 (예: 나쁨, 보통, 좋음)" : "쉼표로 구분 (예: 적음, 보통, 많음)"}">` : ""}
  <button class="btn" data-act="iadd">항목 추가</button></div></section>`;
  h += `<h2 class="sec">캘린더 항목</h2><section class="card"><p class="small muted" style="margin:0 0 4px">캘린더 위쪽에 깔리는 항목을 정합니다.</p><ul class="cvlegend small muted"><li><b>숨김</b> 캘린더 위쪽 목록에서 뺍니다 (기록은 그대로)</li><li><b>표시</b> 목록에는 있고, 눌러야 켜집니다</li><li><b>처음부터 켜기</b> 캘린더 탭을 열 때마다 켜진 상태로 시작합니다</li></ul>${filterKeys().map((x) => { const st = (S.calHide || []).includes(x.k) ? "hide" : (S.calDef || []).includes(x.k) ? "def" : "show"; return `<div class="cvrow"><span class="cvn"><i class="dot${isScale(x.k) ? " ramp" : ""}" style="--c:${colorOf(x.k)}"></i>${esc(x.n)}</span><div class="seg cvseg" role="group" aria-label="${esc(x.n)} 캘린더 표시">${[["hide", "숨김"], ["show", "표시"], ["def", "처음부터 켜기"]].map(([v, l]) => `<button class="chip sm${st === v ? " on" : ""}" data-act="calvis" data-k="${x.k}" data-v="${v}" aria-pressed="${st === v}">${l}</button>`).join("")}</div></div>`; }).join("")}</section>`;
  const id = USER && USER.email ? USER.email.split("@")[0] : "";
  h += `<h2 class="sec">계정</h2><section class="card stack"><div class="row" style="justify-content:space-between"><span>로그인 아이디 <strong>${esc(id)}</strong></span><button class="btn sm ghost" data-act="logout">로그아웃</button></div></section>`;
  return h;
}

/* ---------- 동작 ---------- */
function symOf(t) { return itemById(t.dataset.i).symptoms.find((y) => y.id === t.dataset.s); }
function copyVisit(from, to) {
  if (!from || !S.visit[from]) return;
  if (!to || to > TODAY) { toast("오늘 이후 날짜로는 복사할 수 없습니다."); return; }
  if (to === from) { toast("같은 날짜입니다. 다른 날짜를 골라 주세요."); return; }
  if (S.visit[to]) { toast("그 날짜에는 이미 치료 일지가 있습니다."); return; }
  const v = S.visit[from];
  S.visit[to] = { hosp: v.hosp, treat: v.treat, note: v.note, next: "", ph: [] }; UI.vOpen = to; go("visit");
  toast(`${md(from)} 일지를 ${md(to)}로 복사했습니다. 다음 예약일은 비워 두었습니다.`);
  saveVisit(to);
}
function go(v) { UI.view = v; saveUI(); render(); window.scrollTo(0, 0); }
const act = {
  nav: (t) => { const v = t.dataset.v; if (v === "cal" && !["cal", "day", "lv"].includes(UI.view)) UI.calF = [...(S.calDef || [])]; go(v); },
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
  soopen: (t) => { UI.open["so" + t.dataset.s] = !UI.open["so" + t.dataset.s]; saveUI(); render(); },
  symadd: (t) => {
    const it = itemById(t.dataset.i), v = document.getElementById("sa-" + it.id).value.trim();
    if (!v) { toast("증상 이름을 입력해 주세요."); return; }
    it.symptoms = it.symptoms || [];
    if (it.symptoms.some((y) => !y.hidden && y.name === v)) { toast("이미 있는 증상입니다."); return; }
    const y = { id: uuid(), name: v, hidden: false, options: DEFAULT_SYMPTOM_OPTIONS.map((label) => ({ id: uuid(), label, hidden: false })) };
    it.symptoms.push(y); render(); toast(`'${v}' 증상을 추가했습니다.`);
    run("증상 추가", sb.from("symptoms").insert({ id: y.id, user_id: USER.id, item_id: it.id, name: v, sort_order: it.symptoms.length - 1, is_hidden: false }),
      sb.from("symptom_options").insert(y.options.map((o, j) => ({ id: o.id, user_id: USER.id, symptom_id: y.id, label: o.label, sort_order: j, is_hidden: false }))));
  },
  symmove: (t) => {
    const a = itemById(t.dataset.i).symptoms, i = a.findIndex((y) => y.id === t.dataset.s), j = i + +t.dataset.n;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; render();
    run("증상 순서", ...a.map((y, k) => sb.from("symptoms").update({ sort_order: k }).eq("id", y.id)));
  },
  symshow: (t) => { const y = symOf(t); y.hidden = false; render(); run("증상", sb.from("symptoms").update({ is_hidden: false }).eq("id", y.id)); },
  calvis: (t) => {
    const k = t.dataset.k, v = t.dataset.v;
    S.calHide = (S.calHide || []).filter((x) => x !== k); S.calDef = (S.calDef || []).filter((x) => x !== k);
    if (v === "hide") { S.calHide.push(k); UI.calF = (UI.calF || []).filter((x) => x !== k); saveUI(); }
    if (v === "def") S.calDef.push(k);
    render(); saveSettings("캘린더 항목");
  },
  cpopen: () => { UI.cpOpen = !UI.cpOpen; UI.cpFrom = null; saveUI(); render(); },
  cpdo: () => {
    const d = UI.date, from = document.getElementById("cp-from").value, g = cpGroups();
    if (!from) { toast("가져올 날짜를 골라 주세요."); return; }
    if (from === d) { toast("같은 날짜입니다. 다른 날을 골라 주세요."); return; }
    if (!g.length) { toast("가져올 기록을 하나 이상 골라 주세요."); return; }
    const n = copyDay(from, d, g); UI.cpOpen = false; saveUI(); render();
    toast(n ? `${md(from)} 기록에서 ${n}칸을 채웠습니다.` : "채울 빈 칸이 없습니다. 이미 적은 칸은 덮어쓰지 않습니다.");
  },
  dnew: () => { UI.dEdit = "new"; render(); const b = document.getElementById("dy-b"); if (b) b.focus(); },
  dedit2: (t) => { UI.dEdit = t.dataset.id; render(); },
  dcancel: () => { UI.dEdit = null; render(); },
  dopen: (t) => { UI.dOpen = UI.dOpen || {}; UI.dOpen[t.dataset.id] = !UI.dOpen[t.dataset.id]; saveUI(); render(); },
  dsave: (t) => {
    const g = (i) => document.getElementById(i).value, b = g("dy-b").trim(), ti = g("dy-t").trim(), d = g("dy-d") || TODAY;
    if (!b && !ti) { toast("내용을 입력해 주세요."); return; }
    if (d > TODAY) { toast("오늘 이후 날짜에는 쓸 수 없습니다."); return; }
    let x;
    if (t.dataset.id === "new") { x = { id: uuid(), d, title: ti, body: b, at: Date.now() }; S.diary.push(x); }
    else { x = S.diary.find((q) => q.id === t.dataset.id); if (!x) return; Object.assign(x, { d, title: ti, body: b, at: Date.now() }); }
    UI.dEdit = null; render(); toast("일기를 저장했습니다.");
    run("일기", sb.from("diary_entries").upsert({ id: x.id, user_id: USER.id, date: d, title: ti || null, body: b, updated_at: now() }, { onConflict: "id" }));
  },
  maddopen: (t) => { UI.madd = t.dataset.k || null; render(); if (UI.madd) { const el = document.getElementById(`ma-${UI.madd}-n`); if (el) el.focus(); } },
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
  bool: (t) => {
    const d = UI.date, id = t.dataset.i, v = t.dataset.v === "true", r = recOf(d, id);
    setRec(d, id, r && r.v === v ? null : v && r && r.t ? { v, t: r.t } : { v }); render();
    if (v && !(r && r.v)) { const i = document.getElementById("bn-" + id); if (i) i.focus(); }
  },
  inote: (t) => {
    const it = itemById(t.dataset.i); it.note = !it.note; render();
    toast(it.note ? `${it.name}: '예'를 고르면 내용 칸이 나타납니다.` : `${it.name}: 내용 칸을 숨겼습니다. 적어 둔 내용은 남아 있습니다.`);
    run("항목", sb.from("items").update({ has_note: it.note }).eq("id", it.id));
  },
  vphview: async (t) => {
    const v = S.visit[t.dataset.d], q = v && (v.ph || []).find((x) => x.id === t.dataset.id); if (!q) return;
    const ov = document.getElementById("ov");
    ov.innerHTML = '<span class="small" style="color:#fff">불러오는 중…</span>'; ov.hidden = false;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(q.p, 3600);
    if (error || !data) { ov.hidden = true; toast("사진을 불러오지 못했습니다."); return; }
    ov.innerHTML = `<img src="${esc(data.signedUrl)}" alt="처방전/소견서 사진">`;
  },
  vphdel: async (t) => {
    const v = S.visit[t.dataset.d]; if (!v) return;
    const q = (v.ph || []).find((x) => x.id === t.dataset.id); if (!q) return;
    v.ph = v.ph.filter((x) => x.id !== q.id); render();
    if (await run("사진 삭제", sb.from("visit_photos").delete().eq("id", q.id))) await removePhotos([q.p, q.th]);
  },
  mlmore: (t) => { UI.mlOpen = UI.mlOpen || {}; UI.mlOpen[t.dataset.k] = !UI.mlOpen[t.dataset.k]; saveUI(); render(); },
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
    const g = (i) => document.getElementById(i).value.trim();
    const d = UI.date, x = { id: uuid(), n, sym: g("once-sym"), eff: g("once-eff") };
    (S.once[d] = S.once[d] || []).push(x); render();
    run("일회성 약", sb.from("onetime_meds").insert({ id: x.id, user_id: USER.id, date: d, name: x.n, symptom: x.sym || null, effect: x.eff || null }));
  },
  vtoggle: () => {
    const d = UI.date;
    if (S.visit[d]) { delete S.visit[d]; render(); run("치료 기록", sb.from("hospital_visits").delete().eq("date", d)); }
    else { S.visit[d] = { hosp: "", treat: "", note: "", next: "", ph: [] }; render(); saveVisit(d); }
  },
  vopen: (t) => { const d = t.dataset.d; UI.vOpen = UI.vOpen === d && UI.view === "visit" ? null : d; go("visit"); },
  vnew: () => {
    const d = document.getElementById("vn-date").value || TODAY;
    if (d > TODAY) { toast('오늘 이후 날짜에는 치료 일지를 쓸 수 없습니다. 예약은 "다음 예약일"에 적어 주세요.'); return; }
    UI.vOpen = d; saveUI();
    if (!S.visit[d]) { S.visit[d] = { hosp: "", treat: "", note: "", next: "", ph: [] }; render(); saveVisit(d); } else render();
  },
  vcopy: (t) => copyVisit(t.dataset.d, document.getElementById("vc-date").value),
  vcopylast: () => copyVisit(Object.keys(S.visit).sort().pop(), document.getElementById("vn-date").value || TODAY),
  oncedel: (t) => { const d = UI.date, id = t.dataset.id; S.once[d] = (S.once[d] || []).filter((x) => x.id !== id); render(); run("일회성 약", sb.from("onetime_meds").delete().eq("id", id)); },
  calshift: (t) => { const [y, m] = UI.cal.split("-").map(Number); UI.cal = ymd(new Date(y, m - 1 + +t.dataset.n, 1)).slice(0, 7); saveUI(); render(); },
  caltoday: () => { UI.cal = TODAY.slice(0, 7); saveUI(); render(); },
  calf: (t) => { const k = t.dataset.k, f = UI.calF || []; UI.calF = f.includes(k) ? f.filter((x) => x !== k) : [...f, k]; saveUI(); render(); },
  calday: (t) => { UI.date = t.dataset.d; go("day"); },
  dvshift: (t) => { const d = add(UI.date, +t.dataset.n); if (d <= TODAY) { UI.date = d; saveUI(); render(); } },
  dedit: () => go("today"),
  medit: (t) => { UI.medEdit = UI.medEdit === t.dataset.m ? null : t.dataset.m; saveUI(); render(); },
  endtg: () => { UI.showEnded = !UI.showEnded; saveUI(); render(); },
  ibad: (t) => {
    const it = itemById(t.dataset.i); it.bad = !it.bad; render();
    toast(it.bad ? `${it.name}: 숫자가 높을수록 나쁜 상태로 표시합니다.` : `${it.name}: 숫자가 높을수록 좋은 상태로 표시합니다.`);
    run("항목", sb.from("items").update({ high_is_bad: it.bad }).eq("id", it.id));
  },
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
    S.meds.push(m); UI.madd = null; render(); toast(`${n}을(를) 등록했습니다.`);
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
    const it = { id: uuid(), name: n, type: t, unit: "", hidden: false, note: false, bad: false, options: [], symptoms: [] };
    if (t === "number") it.unit = (document.getElementById("ni-unit").value || "").trim();
    if (t === "scale" || t === "choice") {
      const ops = (document.getElementById("ni-opts").value || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (ops.length < 2) { toast("선택지를 2개 이상 입력해 주세요."); return; }
      it.options = ops.map((label) => ({ id: uuid(), label, hidden: false }));
    }
    S.items.push(it); render(); toast(`${n} 항목을 추가했습니다.`);
    const ok = await run("항목", sb.from("items").insert({ id: it.id, user_id: USER.id, name: n, type: t, unit: it.unit || null, sort_order: S.items.length - 1, is_hidden: false, has_note: false, high_is_bad: false }));
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
    if (k.startsWith("vdel:")) {
      const d = k.slice(5), old = ((S.visit[d] || {}).ph || []).flatMap((q) => [q.p, q.th]);
      delete S.visit[d]; if (UI.vOpen === d) UI.vOpen = null; render(); toast("치료 기록을 지웠습니다.");
      run("치료 기록", sb.from("hospital_visits").delete().eq("date", d)).then(() => removePhotos(old)); // 사진 행은 DB에서 함께 지워진다 (on delete cascade)
      return;
    }
    if (k.startsWith("ddel:")) {
      const id = k.slice(5); S.diary = S.diary.filter((x) => x.id !== id); UI.dEdit = null; render(); toast("일기를 지웠습니다.");
      run("일기", sb.from("diary_entries").delete().eq("id", id));
      return;
    }
    if (k.startsWith("symdel:")) {
      const [, iid, sid] = k.split(":"), it = itemById(iid), y = it && (it.symptoms || []).find((q) => q.id === sid); if (!y) return;
      const used = Object.values(S.rec).some((r) => r[iid] && r[iid].sx && sid in r[iid].sx);
      if (used) {
        y.hidden = true; render(); toast(`기록이 있어서 '${y.name}'은 기록 화면에서만 뺐습니다. 지난 기록과 리포트에는 남습니다.`);
        run("증상", sb.from("symptoms").update({ is_hidden: true }).eq("id", sid));
      } else {
        it.symptoms = it.symptoms.filter((q) => q.id !== sid); render(); toast(`'${y.name}' 증상을 삭제했습니다.`);
        /* 설정 행이 있어야 증상을 모두 지워도 기본 증상이 다시 생기지 않는다 */
        run("증상 삭제", sb.from("symptoms").delete().eq("id", sid), sb.from("user_settings").upsert(settingsRow(), { onConflict: "user_id" }));
      }
      return;
    }
    if (k.startsWith("del:")) {
      const id = k.slice(4); S.meds = S.meds.filter((m) => m.id !== id); Object.values(S.sup).forEach((x) => delete x[id]); Object.values(S.rl).forEach((x) => delete x[id]); UI.medEdit = null; render();
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
  else if (c === "bnote") { const r = recOf(d, t.dataset.i); if (r && r.v) { const v = t.value.trim(); setRec(d, t.dataset.i, v ? { v: true, t: v } : { v: true }); } }
  else if (c === "text") { const v = t.value.trim(); setRec(d, t.dataset.i, v ? { v } : null); }
  else if (c === "meal") { const m = (S.meal[d] = S.meal[d] || {}), k = t.dataset.k; m[k] = m[k] || {}; m[k].t = t.value.trim(); saveMeal(d, k); }
  else if (c === "mealsym") { const m = (S.meal[d] = S.meal[d] || {}), k = t.dataset.k; m[k] = m[k] || {}; m[k].s = t.value.trim(); saveMeal(d, k); }
  else if (c === "vphoto") {
    const fs = [...(t.files || [])], vd = t.dataset.d, v = S.visit[vd]; if (!fs.length || !v) return;
    toast("사진을 올리는 중입니다…");
    let n = 0;
    for (const f of fs) {
      try {
        const [big, small] = await Promise.all([toBlob(f, 1280, 0.75), toBlob(f, 200, 0.7)]);
        const base = `${USER.id}/visits/${vd}/${Date.now()}-${n}`;
        const r1 = await sb.storage.from(BUCKET).upload(`${base}.jpg`, big, { contentType: "image/jpeg" });
        const r2 = await sb.storage.from(BUCKET).upload(`${base}-t.jpg`, small, { contentType: "image/jpeg" });
        if (r1.error || r2.error) throw r1.error || r2.error;
        const q = { id: uuid(), p: `${base}.jpg`, th: `${base}-t.jpg` };
        if (await run("처방전/소견서 사진", sb.from("visit_photos").insert({ id: q.id, user_id: USER.id, visit_date: vd, photo_path: q.p, thumb_path: q.th }))) { (v.ph = v.ph || []).push(q); n++; }
        else await removePhotos([q.p, q.th]);
      } catch (err) { console.error(err); }
    }
    render();
    toast(n === fs.length ? `사진 ${n}장을 첨부했습니다.` : `사진 ${fs.length}장 중 ${n}장만 첨부했습니다. 다시 시도해 주세요.`);
  }
  else if (c === "caldef") {
    const k = t.dataset.k; S.calDef = t.checked ? [...new Set([...(S.calDef || []), k])] : (S.calDef || []).filter((x) => x !== k);
    saveSettings("캘린더 기본 표시");
  }
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
  else if (c === "reg") {
    const q = (S.rl[d] = S.rl[d] || {}), id = t.dataset.m;
    if (t.checked) q[id] = { eff: "" }; else delete q[id];
    render();
    if (t.checked) { const i = document.getElementById("re-" + id); if (i) i.focus(); }
    run("정기 약 체크", t.checked
      ? sb.from("regular_med_logs").upsert({ user_id: USER.id, date: d, medication_id: id, effect: null }, { onConflict: "user_id,date,medication_id" })
      : sb.from("regular_med_logs").delete().eq("date", d).eq("medication_id", id));
  }
  else if (c === "regeff") { const q = (S.rl[d] || {})[t.dataset.m]; if (q) { q.eff = t.value.trim(); run("차도", sb.from("regular_med_logs").update({ effect: q.eff || null }).eq("date", d).eq("medication_id", t.dataset.m)); } }
  else if (c === "mname") { const m = S.meds.find((x) => x.id === t.dataset.m), v = t.value.trim(); if (!m || !v) { render(); return; } m.name = v; run("약/영양제 이름", sb.from("medications").update({ name: v }).eq("id", m.id)); }
  else if (c === "mnote") { const m = S.meds.find((x) => x.id === t.dataset.m); if (m) { m.note = t.value.trim(); run("메모", sb.from("medications").update({ note: m.note || null }).eq("id", m.id)); } }
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
  else if (c === "oncename") {
    const x = (S.once[d] || []).find((o) => o.id === t.dataset.id); if (!x) return;
    const v = t.value.trim(); if (!v) { t.value = x.n; toast("약 이름은 비울 수 없습니다. 지우려면 삭제를 눌러 주세요."); return; }
    x.n = v; run("약 이름", sb.from("onetime_meds").update({ name: v }).eq("id", x.id));
  }
  else if (c === "oncesym") { const x = (S.once[d] || []).find((o) => o.id === t.dataset.id); if (x) { x.sym = t.value.trim(); run("증상", sb.from("onetime_meds").update({ symptom: x.sym || null }).eq("id", x.id)); } }
  else if (c === "onceeff") { const x = (S.once[d] || []).find((o) => o.id === t.dataset.id); if (x) { x.eff = t.value.trim(); run("차도", sb.from("onetime_meds").update({ effect: x.eff || null }).eq("id", x.id)); } }
  else if (c === "vf") { const vd = t.dataset.d, v = S.visit[vd]; if (v) { v[t.dataset.f] = t.value.trim(); saveVisit(vd); if (t.dataset.f === "next") render(); } }
  else if (c === "vdate") {
    const from = t.dataset.d, to = t.value;
    if (!to || to === from) return;
    if (to > TODAY) { toast("오늘 이후 날짜로는 옮길 수 없습니다."); render(); return; }
    if (S.visit[to]) { toast("그 날짜에는 이미 치료 일지가 있습니다."); render(); return; }
    S.visit[to] = S.visit[from]; delete S.visit[from]; UI.vOpen = to; saveUI(); render();
    run("치료 일지", sb.from("hospital_visits").upsert(visitRow(to), { onConflict: "user_id,date" }), sb.from("visit_photos").update({ visit_date: to }).eq("visit_date", from), sb.from("hospital_visits").delete().eq("date", from));
  }
  else if (c === "symname") { const y = symOf(t), v = t.value.trim(); if (!v) { t.value = y.name; toast("증상 이름은 비울 수 없습니다."); return; } y.name = v; run("증상 이름", sb.from("symptoms").update({ name: v }).eq("id", y.id)); }
  else if (c === "cpfrom") { UI.cpFrom = t.value; saveUI(); render(); }
  else if (c === "cpg") { const k = t.dataset.k, g = cpGroups(); UI.cpG = t.checked ? [...new Set([...g, k])] : g.filter((x) => x !== k); saveUI(); }
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
