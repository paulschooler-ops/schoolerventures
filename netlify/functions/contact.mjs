// Schooler Ventures website "Let's talk" form (the one site form) -> Baserow (Schooler Ventures CRM > Contacts).
// Netlify Function (v2). The Baserow token lives ONLY in Netlify env vars; nothing secret is in the page.
// Env vars (set in Netlify > Site configuration > Environment variables):
//   BASEROW_TOKEN     required. A Baserow *database token* with "create" permission on the Contacts table only.
//   BASEROW_TABLE_ID  optional, default 1279234 (Contacts).
//   BASEROW_URL       optional, default https://api.baserow.io
//   ALLOWED_ORIGINS   optional, comma list, default https://schoolerventures.com,https://www.schoolerventures.com
const MAX_FILE = 4 * 1024 * 1024;
const FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]);
// Baserow option ids (Contacts table, read Oct 31 2026). Site form label -> "Interested in" option id.
// null = no matching option in Baserow yet; the choice is still saved, written into Notes.
const SOURCE_WEBSITE = 8535727;
const INTERESTS = {
  "Compass Check Assessment info": null,                                   // no Baserow option yet
  "Basic Training: Building My Brains": 8661004,                          // "Basic Training"
  "Launch Academy: Building My Business Operating System": 8661005,       // "Launch Academy"
  "What is my home\u2019s potential?": 8661006,
  "Exploring the business (Zoom)": 8661007,                               // "Explore the business platform"
  "Ask me how to get the Living Compass for free": 8661008,
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v, n = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const cleanLong = (v, n = 4000) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method" });
  const allowed = (process.env.ALLOWED_ORIGINS || "https://schoolerventures.com,https://www.schoolerventures.com").split(",").map((s) => s.trim());
  const origin = req.headers.get("origin");
  if (origin && !allowed.includes(origin)) return json(403, { ok: false, error: "origin" });
  const token = process.env.BASEROW_TOKEN;
  if (!token) return json(503, { ok: false, error: "not configured" });
  const base = (process.env.BASEROW_URL || "https://api.baserow.io").replace(/\/+$/, "");
  const table = process.env.BASEROW_TABLE_ID || "1279234";

  let fd;
  try { fd = await req.formData(); } catch { return json(400, { ok: false, error: "form" }); }
  if (clean(fd.get("company_site"))) return json(200, { ok: true }); // honeypot: quietly drop bots
  if (clean(fd.get("form")) !== "contact") return json(400, { ok: false, error: "form" });
  const first = clean(fd.get("first_name")), email = clean(fd.get("email")).toLowerCase();
  const phone = clean(fd.get("phone"), 40).replace(/[^0-9+()\-. x]/g, "");
  if (!first || !EMAIL.test(email) || phone.replace(/\D/g, "").length < 7) return json(400, { ok: false, error: "fields" });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const picked = [...new Set(fd.getAll("interested_in").map((v) => clean(v)).filter((v) => Object.prototype.hasOwnProperty.call(INTERESTS, v)))];
  const unmatched = picked.filter((v) => INTERESTS[v] == null);
  const row = {
    "First name": first,
    "Last name": clean(fd.get("last_name")),
    "Email": email,
    "Phone": phone,
    "Source": SOURCE_WEBSITE,
    "Last contact date": today,
    "Interested in": picked.map((v) => INTERESTS[v]).filter((v) => v != null),
    "Their note": cleanLong(fd.get("note")),
    "Notes": `Website: Let's talk form, ${today}` + (picked.length ? `\nInterested in: ${picked.join("; ")}` : "") + (unmatched.length ? `\n(not a Baserow option yet: ${unmatched.join("; ")})` : ""),
  };
  const file = fd.get("upload");
  if (file && typeof file !== "string" && file.size) {
    if (file.size > MAX_FILE || !FILE_TYPES.has(file.type)) return json(400, { ok: false, error: "file" });
    const up = new FormData();
    const safeName = clean(file.name || "upload", 80).replace(/[^A-Za-z0-9._-]+/g, "_") || "upload";
    up.append("file", file, safeName);
    const ur = await fetch(`${base}/api/user-files/upload-file/`, { method: "POST", headers: { Authorization: `Token ${token}` }, body: up });
    if (!ur.ok) { console.error("baserow upload failed", ur.status); return json(502, { ok: false, error: "upload" }); }
    const uf = await ur.json();
    row["Uploads"] = [{ name: uf.name, visible_name: `Upload - ${first} ${row["Last name"]}`.trim() }];
  }
  const r = await fetch(`${base}/api/database/rows/table/${encodeURIComponent(table)}/?user_field_names=true`, {
    method: "POST",
    headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!r.ok) { console.error("baserow row failed", r.status, (await r.text()).slice(0, 300)); return json(502, { ok: false, error: "save" }); }
  return json(200, { ok: true });
};

