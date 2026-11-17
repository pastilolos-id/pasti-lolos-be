import type { CookieOptions, Response } from 'express';

export const AUTH_TOKEN_COOKIE = 'token';

/** Parent domain so the student site can read a cookie set on the API host. */
export const AUTH_COOKIE_DOMAIN = '.pastilolos.id';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Email/password login. Host-only, so localhost and the proxied site both work. */
function passwordCookieAttributes(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * Google callback runs on the API host, then redirects to the frontend.
 * Domain + SameSite=None makes that cookie visible on pastilolos.id.
 */
function googleCookieAttributes(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    domain: AUTH_COOKIE_DOMAIN,
  };
}

export function passwordSessionCookieOptions(): CookieOptions {
  return { ...passwordCookieAttributes(), maxAge: WEEK_MS };
}

export function googleSessionCookieOptions(): CookieOptions {
  return { ...googleCookieAttributes(), maxAge: WEEK_MS };
}

/**
 * Browsers delete a cookie only when name, domain, path, Secure, and SameSite
 * match the Set-Cookie that created it. Password and Google logins use
 * different attributes, so both variants must be expired.
 * The Domain=.pastilolos.id header is ignored on localhost.
 */
export function clearSessionCookies(res: Response): void {
  res.clearCookie(AUTH_TOKEN_COOKIE, passwordCookieAttributes());
  res.clearCookie(AUTH_TOKEN_COOKIE, googleCookieAttributes());
}
