import { createClient } from "@/src/lib/supabase/server";
import { embedTexts, splitNoteIntoChunks } from "@/src/lib/search-embeddings";

export const maxDuration = 60;
const MAX_QUERY_CHARS = 512;
type StaleNoteRow = { id: string; title: string; content: string; revision_at: string; is_deleted: boolean };

async function embedAndStoreNotes(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, notes: StaleNoteRow[], apiKey: string) {
  if (notes.length === 0) return;
  const chunks = notes.flatMap((note) => splitNoteIntoChunks(note.title, note.content).map((content) => ({ note, content })));
  const vectors = await embedTexts(chunks.map((chunk) => chunk.content), "RETRIEVAL_DOCUMENT", apiKey);
  const { error: deleteError } = await supabase.from("note_search_chunks").delete().eq("user_id", userId).in("note_id", notes.map((note) => note.id));
  if (deleteError) throw deleteError;

  const indices = new Map<string, number>();
  for (let offset = 0; offset < chunks.length; offset += 100) {
    const rows = chunks.slice(offset, offset + 100).map(({ note, content }, index) => {
      const chunkIndex = indices.get(note.id) ?? 0;
      indices.set(note.id, chunkIndex + 1);
      return {
        user_id: userId,
        note_id: note.id,
        chunk_index: chunkIndex,
        content,
        embedding: vectors[offset + index],
        revision_at: note.revision_at,
      };
    });
    if (rows.length) {
      const { error } = await supabase.from("note_search_chunks").insert(rows);
      if (error) throw error;
    }
  }
  for (const note of notes) {
    const { error } = await supabase.rpc("mark_note_search_embedded", { p_note_id: note.id, p_revision_at: note.revision_at });
    if (error) throw error;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Semantic search is unavailable because GEMINI_API_KEY is not configured." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON request." }, { status: 400 }); }
  if (typeof body !== "object" || body === null) return Response.json({ error: "Invalid search request." }, { status: 400 });
  const payload = body as Record<string, unknown>;
  const query = payload.query;
  const queryOnly = payload.queryOnly === true;
  const requested = payload.noteIds;
  if (typeof query !== "string" || query.length > MAX_QUERY_CHARS) return Response.json({ error: "Search query must be at most 512 characters." }, { status: 400 });

  try {
    if (!queryOnly) {
      const noteIds = Array.isArray(requested) ? [...new Set(requested.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 3) : [];
      if (noteIds.length > 0) {
        const { data, error } = await supabase.rpc("claim_stale_note_search_embeddings", { p_note_ids: noteIds, p_limit: 3 });
        if (error) throw error;
        const notes = (data ?? []) as StaleNoteRow[];
        if (notes.length) await embedAndStoreNotes(supabase, user.id, notes, apiKey);
      }
    }

    if (!query.trim()) return Response.json({ semantic: [], indexed: true }, { headers: { "Cache-Control": "no-store" } });
    const queryVector = (await embedTexts([`task: search result | query: ${query.trim()}`], "RETRIEVAL_QUERY", apiKey))[0];
    const { data, error } = await supabase.rpc("search_workspace_semantic", { p_embedding: `[${queryVector.join(",")}]`, p_limit: 20 });
    if (error) throw error;
    return Response.json({ semantic: data ?? [], indexed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Workspace semantic search failed.", error);
    return Response.json({ error: "Semantic search is temporarily unavailable.", code: "semantic_unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Semantic indexing is unavailable." }, { status: 503 });

  try {
    const { data: stale, error } = await supabase.rpc("claim_stale_note_search_embeddings", { p_note_ids: null, p_limit: 3 });
    if (error) throw error;
    const notes = (stale ?? []) as StaleNoteRow[];
    if (notes.length) await embedAndStoreNotes(supabase, user.id, notes, apiKey);
    return Response.json({ indexed: notes.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Workspace embedding backfill failed.", error);
    return Response.json({ error: "Could not refresh note search embeddings." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
