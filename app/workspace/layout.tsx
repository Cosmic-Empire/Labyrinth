import Sidebar from "@/src/components/workspace/Sidebar";
import { NotesProvider } from "@/src/components/workspace/NotesProvider";
import {
  SidebarInset,
  SidebarProvider,
} from "@/src/components/ui/sidebar";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotesProvider>
      <SidebarProvider
        defaultOpen
        className="dark min-h-screen w-full bg-[#0c0c0b]"
        style={{ "--sidebar-width": "17rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}
      >
        <Sidebar />
        <SidebarInset className="min-h-screen bg-transparent text-inherit">
          <main className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </NotesProvider>
  );
}