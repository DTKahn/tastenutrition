// Worker entry: a small JSON API in front of tastenutrition.com.
//
//   POST /api/auth/login   { email, password } -> { token, students }
//   GET  /api/students                          -> { students }
//   GET  /api/calendar?student=<id>             -> { studentName, days }
//
// Auth: clients send the opaque app token from /api/auth/login as
// `Authorization: Bearer <token>`. The token encrypts the Taste session cookie
// (see session.ts); the Worker is stateless and stores nothing.

import { createToken, readToken } from './session.ts';
import { getCalendar, getStudents, login, TasteError } from './taste.ts';

interface Env {
  APP_SECRET: string;
  ALLOWED_ORIGIN: string;
  SESSION_TTL_SECONDS: string;
}

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(env: Env, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  });
}

function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

/** Resolve the request's app token to a live Taste cookie, or throw 401. */
async function requireCookie(req: Request, env: Env): Promise<string> {
  const token = bearer(req);
  const cookie = token ? await readToken(env.APP_SECRET, token) : null;
  if (!cookie) throw new TasteError('Not authenticated. Please log in.', 401);
  return cookie;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env) });
    }
    if (!env.APP_SECRET) {
      return json(env, { error: 'Worker missing APP_SECRET secret.' }, 500);
    }

    const ttl = parseInt(env.SESSION_TTL_SECONDS || '1800', 10);

    try {
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const { email, password } = (await req.json()) as {
          email?: string;
          password?: string;
        };
        if (!email || !password) {
          return json(env, { error: 'Email and password are required.' }, 400);
        }
        const cookie = await login(email, password); // password not retained
        const [token, students] = await Promise.all([
          createToken(env.APP_SECRET, cookie, ttl),
          getStudents(cookie),
        ]);
        return json(env, { token, students });
      }

      if (url.pathname === '/api/students' && req.method === 'GET') {
        const cookie = await requireCookie(req, env);
        return json(env, { students: await getStudents(cookie) });
      }

      if (url.pathname === '/api/calendar' && req.method === 'GET') {
        const cookie = await requireCookie(req, env);
        const student = url.searchParams.get('student');
        if (!student) {
          return json(env, { error: 'Missing ?student=<id>.' }, 400);
        }
        return json(env, await getCalendar(cookie, student));
      }

      return json(env, { error: 'Not found.' }, 404);
    } catch (err) {
      if (err instanceof TasteError) {
        return json(env, { error: err.message }, err.status);
      }
      console.error('Unhandled error:', err);
      return json(env, { error: 'Upstream error talking to Taste.' }, 502);
    }
  },
};
