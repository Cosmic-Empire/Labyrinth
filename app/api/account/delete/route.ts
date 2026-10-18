import { createClient } from "@/src/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(request: Request) {
  const confirmation = request.headers.get("x-confirm-account-deletion");
  if (confirmation !== "DELETE") {
    return Response.json({ error: "Explicit account deletion confirmation is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!serviceRoleKey || !supabaseUrl) {
    return Response.json({ error: "Account deletion is unavailable until the server admin key is configured." }, { status: 503 });
  }

  const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: files, error: filesError } = await supabase
    .from("files")
    .select("storage_path,thumbnail_path")
    .eq("user_id", user.id);
  if (filesError) return Response.json({ error: "Could not list account files for deletion." }, { status: 500 });

  const paths = [...new Set((files ?? []).flatMap((file) => [file.storage_path, file.thumbnail_path].filter((path): path is string => Boolean(path))))];
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from("drive-files").remove(paths.slice(index, index + 100));
    if (error) return Response.json({ error: "Could not delete all stored files; the account has not been deleted." }, { status: 502 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return Response.json({ error: "Could not delete the account." }, { status: 502 });

  return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
