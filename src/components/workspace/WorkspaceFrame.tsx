"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Sidebar from "@/src/components/workspace/Sidebar";
import { NotesProvider } from "@/src/components/workspace/NotesProvider";
import { SyncIndicator } from "@/src/components/workspace/SyncIndicator";
import { LaboraAssistant } from "@/src/components/workspace/LaboraAssistant";
import { DriveUploadButton } from "@/src/components/workspace/DriveUploadButton";
import { WorkspaceSearch, WorkspaceSearchTrigger } from "@/src/components/workspace/WorkspaceSearch";
import { SidebarInset, SidebarProvider } from "@/src/components/ui/sidebar";

export function WorkspaceFrame({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <NotesProvider user={user}>
      <SidebarProvider
        defaultOpen
        className="min-h-screen w-full bg-[#0c0c0b]"
        style={{ "--sidebar-width": "17rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}
      >
        <Sidebar />
        <SidebarInset className="min-h-screen bg-transparent text-inherit">
          {pathname === "/workspace/notes" && <SyncIndicator />}
          <div className="sticky top-0 z-30 flex justify-end gap-2 border-b border-white/[0.07] bg-[#0c0c0b]/90 px-4 py-2 backdrop-blur md:hidden">
            <WorkspaceSearchTrigger />
            <DriveUploadButton compact />
          </div>
          <main className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-6">
            <ViewTransition key={pathname} name="workspace-page" share="auto" enter="auto" default="none">
              {children}
            </ViewTransition>
          </main>
        </SidebarInset>
        <LaboraAssistant />
        <WorkspaceSearch />
      </SidebarProvider>
    </NotesProvider>
  );
}
