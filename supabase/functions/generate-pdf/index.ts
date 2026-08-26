// supabase/functions/generate-pdf/index.ts
//
// WHY YOU MIGHT WANT THIS:
// The app already generates a great-looking PDF entirely in the browser
// (DetailView → "PDF" tab → "Imprimir / salvar como PDF") with zero backend
// needed. Server-side generation is only worth the extra complexity if you
// need to, e.g., email a PDF automatically, generate one without the user's
// browser open, or produce it from a script/integration.
//
// HOW IT WORKS:
// This function receives an inspection id, loads it from the `inspections`
// table (respecting the caller's own RLS-protected session), renders it to
// HTML (a trimmed port of the same layout used in the app's buildReportHTML),
// and uses a remote headless-Chrome API (Browserless.io — swap for any
// similar "HTML to PDF" service, or your own headless Chrome if you run one)
// to turn that HTML into a real PDF, returned as the response body.
//
// DEPLOYING THIS (I cannot do this step for you — it needs your own Supabase
// CLI login):
//   1. npm install -g supabase
//   2. supabase login
//   3. supabase link --project-ref tskvzrbvtfypqjuzrdzh
//   4. Get a free API key from https://www.browserless.io (or similar) and set it:
//        supabase secrets set BROWSERLESS_API_KEY=your-key-here
//   5. supabase functions deploy generate-pdf
//   6. Call it from the app with:
//        const { data, error } = await supabase.functions.invoke('generate-pdf', { body: { inspectionId } })
//
// IF YOU GET STUCK DEPLOYING THIS, ASK AN AI ASSISTANT:
//   "I have a Supabase Edge Function at supabase/functions/generate-pdf/index.ts
//   in my project. Walk me through deploying it with the Supabase CLI,
//   step by step, including setting the BROWSERLESS_API_KEY secret, and help
//   me debug any errors from `supabase functions deploy`."

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");

serve(async (req) => {
  try {
    const { inspectionId } = await req.json();
    if (!inspectionId) {
      return new Response(JSON.stringify({ error: "inspectionId é obrigatório" }), { status: 400 });
    }

    // Uses the caller's own auth token so Row Level Security still applies —
    // this function can only ever fetch inspections the calling user owns.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: row, error } = await supabase
      .from("inspections")
      .select("data")
      .eq("id", inspectionId)
      .single();

    if (error || !row) {
      return new Response(JSON.stringify({ error: "Vistoria não encontrada ou sem permissão." }), { status: 404 });
    }

    const html = buildSimpleReportHTML(row.data);

    if (!BROWSERLESS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "BROWSERLESS_API_KEY não configurada. Rode: supabase secrets set BROWSERLESS_API_KEY=..." }),
        { status: 500 }
      );
    }

    const pdfResponse = await fetch(`https://chrome.browserless.io/pdf?token=${BROWSERLESS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, options: { printBackground: true, format: "A4" } }),
    });

    if (!pdfResponse.ok) {
      const msg = await pdfResponse.text();
      return new Response(JSON.stringify({ error: "Falha ao gerar PDF", detail: msg }), { status: 502 });
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    return new Response(pdfBytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="laudo.pdf"` },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

// A trimmed HTML template — for the full, polished version, port the
// buildReportHTML() function from src/App.jsx here (same idea, just running
// on the server instead of in the browser).
function buildSimpleReportHTML(inspection: any): string {
  const ambientesHtml = (inspection.ambientes || [])
    .map((a: any) => `<h2>${a.nome}</h2><ul>${(a.itens || []).map((it: any) => `<li>${it.nome} — ${it.estado}</li>`).join("")}</ul>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#2a1c20}
    h1{color:#4e1b26} h2{border-bottom:1px solid #eee;padding-bottom:6px}
  </style></head><body>
    <h1>VistorIA — Laudo de Vistoria</h1>
    <p><strong>Endereço:</strong> ${inspection.imovel?.endereco || "—"}</p>
    <p><strong>Data:</strong> ${inspection.dataVistoria || "—"}</p>
    ${ambientesHtml}
  </body></html>`;
}
