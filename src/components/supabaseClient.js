// Supabase client. Uses Vite's env var convention (VITE_ prefix) — note this
// is different from Next.js's NEXT_PUBLIC_ prefix. Vite only exposes
// variables prefixed with VITE_ to the browser bundle; anything else is
// silently undefined. See .env.example.
//
// The URL and anon/publishable key are SAFE to ship in the browser bundle —
// that's how Supabase is designed to work. Access control is enforced on the
// server side by Row Level Security (RLS) policies (see supabase/schema.sql),
// not by hiding this key. Never put the "service_role" key here — that one
// bypasses RLS entirely and must only ever be used in a trusted backend
// (e.g. inside the Edge Function, as a server-side secret).

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

if (!supabaseEnabled && import.meta.env.DEV) {
  console.warn(
    "[VistorIA] Supabase não configurado — defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env para ativar a sincronização na nuvem. O app continua funcionando 100% offline sem isso."
  );
}
