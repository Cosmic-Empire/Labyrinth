import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { WorkspaceFrame } from "@/src/components/workspace/WorkspaceFrame";

export async function AuthenticatedWorkspace({ children }: { children: React.ReactNode }) {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth");

  return <WorkspaceFrame user={user}>{children}</WorkspaceFrame>;
}
