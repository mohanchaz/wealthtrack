/**
 * Cloudflare Pages Function: /config.js
 *
 * Serves the Supabase client configuration at runtime, reading credentials
 * from Cloudflare Pages environment variables instead of hardcoding them.
 *
 * Required environment variables (set in Cloudflare Pages dashboard):
 *   SUPABASE_URL       — e.g. https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY  — your project's anon/public key
 */
export async function onRequestGet({ env }) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        return new Response(
            '/* ERROR: SUPABASE_URL or SUPABASE_ANON_KEY env var is missing — set them in Cloudflare Pages dashboard */',
            { status: 500, headers: { 'Content-Type': 'application/javascript' } }
        );
    }

    const js = `const SUPABASE_URL = '${url}';
const SUPABASE_ANON_KEY = '${key}';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
`;

    return new Response(js, {
        headers: {
            'Content-Type': 'application/javascript',
            // Short cache — don't bake stale keys into browser caches
            'Cache-Control': 'no-store',
        },
    });
}
