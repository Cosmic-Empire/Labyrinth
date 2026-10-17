import { Suspense } from "react";
import { AuthenticatedWorkspace } from "@/src/components/workspace/AuthenticatedWorkspace";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0c0c0b]" />}>
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </Suspense>
  );
}