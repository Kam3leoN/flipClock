/**
 * Birthdays CRUD — Vercel Node serverless function (also mounted by Vite in dev).
 *
 *   GET    /api/birthdays            → list
 *   POST   /api/birthdays            → create   { name, day, month, year?, note? }
 *   PUT    /api/birthdays?id=<id>    → update   (same body, partial allowed)
 *   DELETE /api/birthdays?id=<id>    → delete
 *
 * Env: MONGODB_URI (required), MONGODB_DB (default "flipflap"),
 *      BIRTHDAYS_WRITE_KEY (optional — protects POST/PUT/DELETE via header x-birthday-key).
 */
import { MongoClient, ObjectId } from 'mongodb';

const COLLECTION = 'birthdays';

/** Reuse the client across warm invocations. */
let clientPromise = globalThis.__flipflapMongo;

/** Ensure Atlas SRV URI has the usual query flags. */
function normalizeUri(raw) {
  let uri = String(raw).trim();
  if (!uri.includes('?')) uri += '/?retryWrites=true&w=majority';
  else if (!/[?&]retryWrites=/.test(uri)) uri += '&retryWrites=true&w=majority';
  return uri;
}

function getCollection() {
  const raw = process.env.MONGODB_URI;
  if (!raw) throw Object.assign(new Error('MONGODB_URI is not configured'), { status: 500 });
  const uri = normalizeUri(raw);
  if (!clientPromise) {
    // autoSelectFamily:false — Node/driver 6.9+ prefers IPv6 first; Atlas often
    // answers with TLS alert 80 on that path (ReplicaSetNoPrimary on Vercel).
    clientPromise = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      family: 4,
      autoSelectFamily: false,
    }).connect();
    globalThis.__flipflapMongo = clientPromise;
  }
  return clientPromise.then((c) => c.db(process.env.MONGODB_DB || 'flipflap').collection(COLLECTION));
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function daysInMonth(month, year) {
  return new Date(year ?? 2024, month, 0).getDate(); // 2024 = leap → 29 Feb allowed
}

/** Validate & normalise a payload. `partial` for PUT. */
function sanitize(input, partial = false) {
  const out = {};
  const errors = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);

  if (!partial || has('name')) {
    const name = String(input.name ?? '').trim().slice(0, 80);
    if (!name) errors.push('name is required');
    out.name = name;
  }
  if (!partial || has('month')) {
    const month = Number(input.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) errors.push('month must be 1–12');
    out.month = month;
  }
  if (has('year')) {
    const y = input.year === '' || input.year === null ? null : Number(input.year);
    const max = new Date().getFullYear();
    if (y !== null && (!Number.isInteger(y) || y < 1900 || y > max)) errors.push(`year must be 1900–${max}`);
    out.year = y;
  }
  if (!partial || has('day')) {
    const day = Number(input.day);
    const month = out.month ?? Number(input.month) ?? 1;
    const max = Number.isInteger(month) && month >= 1 && month <= 12 ? daysInMonth(month, out.year ?? undefined) : 31;
    if (!Number.isInteger(day) || day < 1 || day > max) errors.push(`day must be 1–${max}`);
    out.day = day;
  }
  if (has('note')) out.note = String(input.note ?? '').trim().slice(0, 200);
  return { data: out, errors };
}

function toJson(doc) {
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

function parseId(url) {
  const id = new URL(url, 'http://local').searchParams.get('id');
  if (!id || !ObjectId.isValid(id)) throw Object.assign(new Error('valid ?id= is required'), { status: 400 });
  return new ObjectId(id);
}

export default async function handler(req, res) {
  try {
    const method = req.method ?? 'GET';
    if (method !== 'GET') {
      const key = process.env.BIRTHDAYS_WRITE_KEY;
      if (key && req.headers['x-birthday-key'] !== key) return send(res, 401, { error: 'unauthorized' });
    }
    const col = await getCollection();

    if (method === 'GET') {
      const docs = await col.find({}).sort({ month: 1, day: 1, name: 1 }).limit(1000).toArray();
      return send(res, 200, docs.map(toJson));
    }

    if (method === 'POST') {
      const { data, errors } = sanitize(await readBody(req));
      if (errors.length) return send(res, 400, { error: errors.join(', ') });
      const now = new Date();
      const doc = { year: null, note: '', ...data, createdAt: now, updatedAt: now };
      const { insertedId } = await col.insertOne(doc);
      return send(res, 201, toJson({ _id: insertedId, ...doc }));
    }

    if (method === 'PUT' || method === 'PATCH') {
      const _id = parseId(req.url);
      const { data, errors } = sanitize(await readBody(req), true);
      if (errors.length) return send(res, 400, { error: errors.join(', ') });
      const updated = await col.findOneAndUpdate(
        { _id },
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      if (!updated) return send(res, 404, { error: 'not found' });
      return send(res, 200, toJson(updated));
    }

    if (method === 'DELETE') {
      const _id = parseId(req.url);
      const { deletedCount } = await col.deleteOne({ _id });
      if (!deletedCount) return send(res, 404, { error: 'not found' });
      return send(res, 204);
    }

    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
    return send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    const status = err?.status ?? (err instanceof SyntaxError ? 400 : 500);
    if (status >= 500) console.error('[api/birthdays]', err);
    return send(res, status, { error: status >= 500 ? 'server error' : err.message });
  }
}
