// Client for tastenutrition.com. Speaks the legacy ASP site's language
// (session cookie + form POSTs) and hands back raw HTML for parse.ts.
// Endpoint contract: ../../m0/FINDINGS.md.

import { parseCalendar, parseStudents, looksLoggedIn, type Calendar, type Student } from './parse.ts';

const BASE = 'https://www.tastenutrition.com';

// A polite, browser-like UA. We are a low-volume personal client.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export class TasteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Pull the `ASPSESSIONIDxxxx=value` pair out of Set-Cookie headers. */
function extractAspSession(res: Response): string | null {
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const c of cookies) {
    const m = /^(ASPSESSIONID\w+=[^;]+)/.exec(c);
    if (m) return m[1];
  }
  return null;
}

/**
 * Log in. Returns the authenticated Taste session cookie. The password is used
 * only for this request and never stored or returned.
 */
export async function login(email: string, password: string): Promise<string> {
  // 1. GET the sign-in page to obtain a fresh ASP session cookie.
  const seed = await fetch(`${BASE}/user_sign_in.asp`, {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  });
  let cookie = extractAspSession(seed);
  if (!cookie) throw new TasteError('Could not start a Taste session.', 502);

  // 2. POST credentials to authenticate that session.
  const body = new URLSearchParams({ email, password, B1: ' Continue ' });
  const auth = await fetch(`${BASE}/user_sign_indb.asp`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      Referer: `${BASE}/user_sign_in.asp`,
    },
    body,
    redirect: 'manual',
  });
  // The site may rotate the session cookie on login; keep the newest.
  cookie = extractAspSession(auth) ?? cookie;

  // 3. Verify by loading the dashboard with the cookie.
  const profile = await getProfileHtml(cookie);
  if (!looksLoggedIn(profile)) {
    throw new TasteError('Invalid email or password.', 401);
  }
  return cookie;
}

async function getProfileHtml(cookie: string): Promise<string> {
  const res = await fetch(`${BASE}/user_profile.asp`, {
    headers: { 'User-Agent': UA, Cookie: cookie },
    redirect: 'manual',
  });
  if (res.status === 302) {
    // Redirected away from the dashboard => session no longer valid.
    throw new TasteError('Taste session expired. Please log in again.', 401);
  }
  return res.text();
}

export async function getStudents(cookie: string): Promise<Student[]> {
  return parseStudents(await getProfileHtml(cookie));
}

export async function getCalendar(
  cookie: string,
  studentId: string,
): Promise<Calendar> {
  const body = new URLSearchParams({
    mode: '',
    studentid: '',
    student_id: studentId,
  });
  const res = await fetch(`${BASE}/school_menu.asp`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      Referer: `${BASE}/user_profile.asp`,
    },
    body,
    redirect: 'manual',
  });
  if (res.status === 302) {
    throw new TasteError('Taste session expired. Please log in again.', 401);
  }
  return parseCalendar(await res.text());
}
