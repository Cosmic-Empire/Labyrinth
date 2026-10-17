"use client";

import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Sidebar from "@/src/components/workspace/Sidebar";
import { NotesProvider } from "@/src/components/workspace/NotesProvider";
import { SyncIndicator } from "@/src/components/workspace/SyncIndicator";
import { SidebarInset, SidebarProvider } from "@/src/components/ui/sidebar";

export function WorkspaceFrame({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <NotesProvider user={user}>
      <SidebarProvider
        defaultOpen
        className="dark min-h-screen w-full bg-[#0c0c0b]"
        style={{ "--sidebar-width": "17rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}
      >
        <Sidebar />
        <SidebarInset className="min-h-screen bg-transparent text-inherit">
          {pathname === "/workspace/notes" && <SyncIndicator />}
          <main className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </NotesProvider>
  );
}
