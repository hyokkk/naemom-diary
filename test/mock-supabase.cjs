// Supabase(인증 + PostgREST + Storage)를 흉내 내는 최소 인메모리 서버 (fetch 대체)
// 권한 규칙은 setup.sql 과 같다: 로그인한 사용자는 user_id 가 자기 것인 행만 읽고 쓴다.
// 사진은 첫 폴더 이름이 자기 ID인 경로만 올리고 읽고 지울 수 있다.
const crypto = require("crypto");

const TABLES = {
  items: (r) => r.id,
  item_options: (r) => r.id,
  daily_records: (r) => `${r.user_id}|${r.date}|${r.item_id}`,
  meals: (r) => `${r.user_id}|${r.date}|${r.meal_type}`,
  medications: (r) => r.id,
  supplement_logs: (r) => `${r.user_id}|${r.date}|${r.medication_id}`,
  onetime_meds: (r) => r.id,
  symptoms: (r) => r.id,
  symptom_options: (r) => r.id,
  symptom_records: (r) => `${r.user_id}|${r.date}|${r.symptom_id}`,
  hospital_visits: (r) => `${r.user_id}|${r.date}`,
  regular_med_logs: (r) => `${r.user_id}|${r.date}|${r.medication_id}`,
  visit_photos: (r) => r.id,
  user_settings: (r) => r.user_id,
  diary_entries: (r) => r.id,
};
const NOT_NULL = {
  items: ["name", "type"], item_options: ["item_id", "label"], daily_records: ["date", "item_id"],
  meals: ["date", "meal_type"], medications: ["kind", "name", "start_date"], supplement_logs: ["date", "medication_id"], onetime_meds: ["date", "name"],
  symptoms: ["item_id", "name"], symptom_options: ["symptom_id", "label"], symptom_records: ["date", "symptom_id"], hospital_visits: ["date"], regular_med_logs: ["date", "medication_id"], visit_photos: ["visit_date", "photo_path"], user_settings: [], diary_entries: ["date", "body"],
};

function createMock() {
  const db = Object.fromEntries(Object.keys(TABLES).map((t) => [t, []]));
  const users = []; // { id, email, password }
  const objects = {}; // path -> { size, owner }
  const log = [];
  let seq = 0;
  const signupOpen = { value: true };

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = (u) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  const userObj = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() });
  const session = (u) => ({ access_token: jwt(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-" + u.id, user: userObj(u) });
  const uidFrom = (headers) => {
    const a = headers["authorization"] || "";
    const tok = a.replace(/^Bearer\s+/i, "").split(".");
    if (tok.length !== 3) return null;
    try { const p = JSON.parse(Buffer.from(tok[1], "base64url").toString()); return p.role === "authenticated" ? p.sub : null; } catch (e) { return null; }
  };

  const json = (status, data) =>
    new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

  function parseFilters(sp) {
    const f = [];
    for (const [k, v] of sp.entries()) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      const m = v.match(/^eq\.(.*)$/);
      if (!m) throw { status: 400, body: { message: "unsupported filter " + k + "=" + v } };
      f.push((r) => String(r[k]) === m[1]);
    }
    return (r) => f.every((fn) => fn(r));
  }

  function auth(path, method, sp, body) {
    if (path === "signup" && method === "POST") {
      if (!signupOpen.value) return json(422, { code: "signup_disabled", msg: "Signups not allowed for this instance" });
      if (users.some((u) => u.email === body.email)) return json(422, { code: "user_already_exists", msg: "User already registered" });
      if (!body.password || body.password.length < 6) return json(422, { code: "weak_password", msg: "Password should be at least 6 characters." });
      const u = { id: crypto.randomUUID(), email: body.email, password: body.password };
      users.push(u);
      return json(200, session(u));
    }
    if (path === "token" && method === "POST") {
      const g = sp.get("grant_type");
      if (g === "password") {
        const u = users.find((x) => x.email === body.email && x.password === body.password);
        if (!u) return json(400, { code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
        return json(200, session(u));
      }
      if (g === "refresh_token") {
        const u = users.find((x) => "r-" + x.id === body.refresh_token);
        return u ? json(200, session(u)) : json(400, { msg: "Invalid Refresh Token" });
      }
    }
    if (path === "logout") return new Response(null, { status: 204 });
    if (path === "user") return json(200, null);
    return json(404, { msg: "no auth route " + path });
  }

  function rest(table, method, sp, headers, body, uid) {
    if (!TABLES[table]) return json(404, { message: "no table " + table });
    if (!uid) return json(401, { code: "42501", message: "permission denied for table " + table });
    const match = parseFilters(sp);
    const mine = (r) => r.user_id === uid;
    if (method === "GET") {
      let rows = db[table].filter((r) => mine(r) && match(r));
      const ord = sp.get("order");
      if (ord) {
        const cols = ord.split(",").map((c) => c.split(".")[0]);
        rows = rows.slice().sort((a, b) => { for (const c of cols) { const x = String(a[c] ?? ""), y = String(b[c] ?? ""); if (x !== y) return x < y ? -1 : 1; } return 0; });
      }
      const off = +(sp.get("offset") || 0), lim = sp.get("limit");
      rows = rows.slice(off, lim ? off + +lim : undefined);
      return json(200, rows.map((r) => ({ ...r })));
    }
    if (method === "POST") {
      const rows = Array.isArray(body) ? body : [body];
      const upsert = (headers["prefer"] || "").includes("resolution=merge-duplicates");
      for (const r of rows) {
        const row = { ...r, user_id: r.user_id || uid };
        if (row.user_id !== uid) return json(403, { code: "42501", message: "new row violates row-level security policy" });
        if (NOT_NULL[table].some((c) => row[c] == null)) return json(400, { code: "23502", message: "null value violates not-null constraint" });
        if (TABLES[table](row) == null) row.id = crypto.randomUUID();
        if (["items", "medications", "onetime_meds"].includes(table) && !row.created_at) row.created_at = new Date(Date.now() + seq++).toISOString();
        const k = TABLES[table](row), i = db[table].findIndex((x) => TABLES[table](x) === k);
        if (i >= 0) {
          if (!upsert) return json(409, { code: "23505", message: "duplicate key value violates unique constraint" });
          db[table][i] = { ...db[table][i], ...row };
        } else db[table].push(row);
      }
      return json(201, undefined);
    }
    if (method === "PATCH") {
      db[table].forEach((r, i) => { if (mine(r) && match(r)) db[table][i] = { ...r, ...body }; });
      return json(204, undefined);
    }
    if (method === "DELETE") {
      const before = db[table].length;
      const del = db[table].filter((r) => mine(r) && match(r));
      db[table] = db[table].filter((r) => !(mine(r) && match(r)));
      // on delete cascade
      if (table === "hospital_visits") for (const v of del) db.visit_photos = db.visit_photos.filter((q) => !(q.user_id === v.user_id && q.visit_date === v.date));
      if (table === "symptoms") for (const y of del) { db.symptom_options = db.symptom_options.filter((o) => o.symptom_id !== y.id); db.symptom_records = db.symptom_records.filter((o) => o.symptom_id !== y.id); }
      if (table === "medications") for (const m of del) { db.supplement_logs = db.supplement_logs.filter((l) => l.medication_id !== m.id); db.regular_med_logs = db.regular_med_logs.filter((l) => l.medication_id !== m.id); }
      void before;
      return json(204, undefined);
    }
    return json(400, { message: "unsupported" });
  }

  function storage(path, method, body, uid) {
    if (!uid) return json(400, { statusCode: "403", error: "Unauthorized", message: "Invalid JWT" });
    const own = (p) => p.split("/")[0] === uid;
    let m;
    if ((m = path.match(/^object\/sign\/meal-photos$/)) && method === "POST") {
      return json(200, body.paths.map((p) => (objects[p] && own(p)
        ? { path: p, signedURL: `/object/sign/meal-photos/${p}?token=t`, error: null }
        : { path: p, signedURL: null, error: "Either the object does not exist or you do not have access to it" })));
    }
    if ((m = path.match(/^object\/sign\/meal-photos\/(.+)$/)) && method === "POST") {
      const p = decodeURIComponent(m[1]);
      return objects[p] && own(p) ? json(200, { signedURL: `/object/sign/meal-photos/${p}?token=t` }) : json(400, { statusCode: "404", error: "not_found", message: "Object not found" });
    }
    if ((m = path.match(/^object\/meal-photos\/(.+)$/)) && method === "POST") {
      const p = decodeURIComponent(m[1]);
      if (!own(p)) return json(400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      if (objects[p]) return json(400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      let size = 0;
      try { const f = body && body.get && body.get(""); size = f && f.size ? f.size : 0; } catch (e) {}
      objects[p] = { size, owner: uid };
      return json(200, { Id: crypto.randomUUID(), Key: "meal-photos/" + p });
    }
    if (path === "object/meal-photos" && method === "DELETE") {
      const out = [];
      for (const p of body.prefixes) if (objects[p] && own(p)) { delete objects[p]; out.push({ name: p }); }
      return json(200, out);
    }
    return json(404, { message: "no storage route " + path });
  }

  async function fetchImpl(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = (init.method || "GET").toUpperCase();
    const h = init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers || {};
    const headers = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
    let body = init.body;
    if (typeof body === "string" && body) body = JSON.parse(body);
    const p = url.pathname;
    log.push(method + " " + p + url.search);
    try {
      if (p.startsWith("/auth/v1/")) return auth(p.slice(9), method, url.searchParams, body || {});
      const uid = uidFrom(headers);
      if (p.startsWith("/rest/v1/")) return rest(p.slice(9), method, url.searchParams, headers, body, uid);
      if (p.startsWith("/storage/v1/")) return storage(p.slice(12), method, body, uid);
    } catch (e) {
      if (e && e.status) return json(e.status, e.body);
      throw e;
    }
    return json(404, { message: "unknown route " + p });
  }
  return { db, users, objects, log, signupOpen, fetch: fetchImpl };
}
module.exports = { createMock };
