// Shared CORS helper for Supabase Edge Functions.
// -----------------------------------------------------------------------------
// Restricts Access-Control-Allow-Origin to a known allowlist instead of "*".
// Reflects the request's Origin back only when it's on the allowlist; falls
// back to the primary app origin otherwise (browsers on a disallowed origin
// will still be blocked client-side since the header won't match them).
// -----------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "https://www.vestaiapp.com",
  "https://vestaiapp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Vary": "Origin",
  };
}
