# Supabase

Placeholder. Quando integrar:

- `client.ts` — `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)`
- `auth-middleware.ts` — proteção de server functions
- Tabelas: `stores`, `users`, `user_roles`, `assets`, `generations`, `token_transactions`
- RLS por tenant via `store_id` + `auth.uid()`
