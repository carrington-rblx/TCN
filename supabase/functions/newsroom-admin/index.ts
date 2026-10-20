import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server is not configured." }, 500);
  const bearer = req.headers.get("Authorization") || "";
  const token = bearer.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign-in required." }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid session." }, 401);
  if (!["editor", "admin"].includes(String(authData.user.app_metadata?.role || ""))) return json({ error: "Editor permission required." }, 403);
  let payload: { email?: string; password?: string; display_name?: string };
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const displayName = String(payload.display_name || "").trim();
  if (!email.includes("@") || password.length < 12 || !displayName) return json({ error: "Provide a valid email, display name, and password of at least 12 characters." }, 400);
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: displayName },
    app_metadata: { role: "author" }
  });
  if (error || !data.user) return json({ error: error?.message || "Account creation failed." }, 400);
  await admin.from("newsroom_profiles").upsert({ id: data.user.id, display_name: displayName });
  return json({ ok: true, user: { id: data.user.id, email: data.user.email, display_name: displayName, role: "author" } }, 201);
});