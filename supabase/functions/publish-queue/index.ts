import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ error: "GET required" }, 405);
  const secret = Deno.env.get("NEWSROOM_PUBLISH_SECRET");
  const supplied = req.headers.get("x-newsroom-publish-secret") || "";
  if (!secret || supplied.length !== secret.length || !crypto.subtle || !(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(supplied))).every((b, i, a) => b === (await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)))[i])) {
    return json({ error: "Unauthorized." }, 401);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Server is not configured." }, 500);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const [articles, elections] = await Promise.all([
    db.from("newsroom_articles").select("id,headline,category,summary,body,byline,image_url,approved_at,updated_at").eq("status","approved").order("approved_at",{ascending:false}),
    db.from("newsroom_elections").select("id,title,election_type,party_or_jurisdiction,election_date,counting_status,candidates,notes,published_at,updated_at").eq("publication_status","published").order("updated_at",{ascending:false})
  ]);
  if (articles.error || elections.error) return json({ error: "Could not read publication queue." }, 500);
  return json({ generated_at: new Date().toISOString(), articles: articles.data || [], elections: elections.data || [] });
});