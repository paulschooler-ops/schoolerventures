// SV-BOSS Readiness Check — secure submission bridge.
//
// The browser never talks to Make directly. It posts here; this function
// validates the payload and relays it to the Make webhook, whose URL lives
// only in the MAKE_WEBHOOK_URL environment variable (Netlify: Site
// configuration -> Environment variables), never in client-side code.

const REQUIRED_FIELDS = [
  'name',
  'email',
  'company',
  'businessDescription',
  'prompt',
  'challenge',
  'outcome',
  'importance',
  'decisionMakers',
  'timeline'
];

const OPTIONAL_FIELDS = ['phone', 'website', 'notes'];

const ALLOWED_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
const MAX_LENGTH = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('MAKE_WEBHOOK_URL is not set');
    return jsonResponse(500, { error: 'Server is not configured yet' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  // Strip anything that isn't an expected field and trim/cap every value.
  const clean = {};
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const value = String(payload[key] ?? '').trim().slice(0, MAX_LENGTH);
    clean[key] = value;
  }

  const missing = REQUIRED_FIELDS.filter((key) => !clean[key]);
  if (missing.length) {
    return jsonResponse(400, { error: `Missing required fields: ${missing.join(', ')}` });
  }

  if (!EMAIL_RE.test(clean.email)) {
    return jsonResponse(400, { error: 'Invalid email address' });
  }

  // Fill in optional fields as empty strings so Make always receives every key.
  for (const key of OPTIONAL_FIELDS) {
    if (!(key in clean)) clean[key] = '';
  }

  try {
    const makeRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean)
    });

    if (!makeRes.ok) {
      console.error('Make webhook responded with', makeRes.status);
      return jsonResponse(502, { error: 'Downstream automation failed' });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('Failed to reach Make webhook', err);
    return jsonResponse(502, { error: 'Could not reach automation service' });
  }
};
