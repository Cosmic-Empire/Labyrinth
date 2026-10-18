"use client";

import { Fragment, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Files,
  LogOut,
  Plus,
  Settings,
} from "lucide-react";
import { useNotesWorkspace } from "@/src/components/workspace/NotesProvider";
import { DriveUploadButton } from "@/src/components/workspace/DriveUploadButton";
import { WorkspaceSearchTrigger } from "@/src/components/workspace/WorkspaceSearch";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/src/components/ui/sidebar";

const items = [
  { label: "Notes", icon: FileText, href: "/workspace/notes", enabled: true },
  { label: "Drive", icon: Files, href: "/drive", enabled: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { notes, loaded, active, select, create } = useNotesWorkspace();
  const createNote = useCallback(() => { create(); }, [create]);

  return (
    <SidebarRoot
      collapsible="icon"
      variant="sidebar"
      className="border-r border-white/10 bg-[#111110]/90"
    >
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/workspace/notes"
            aria-label="Labyrinth home"
            data-no-interaction-hover
            className="flex min-w-0 items-center gap-3 rounded-xl bg-transparent outline-none hover:bg-transparent hover:text-inherit focus-visible:ring-2 focus-visible:ring-zinc-400 group-data-[collapsible=icon]:hidden"
          >
            <Image
              src="/icon.jpg"
              alt=""
              width={38}
              height={38}
              className="size-[38px] shrink-0 rounded-xl object-cover"
              priority
            />
            <span className="block text-center-[15px] font-mono text-sm tracking[0.28em] text-white/80">
              LABYRINTH
            </span>
            
                </Link>
          <SidebarTrigger
            aria-label="Toggle sidebar"
            data-workspace-sidebar-control
            className="size-9 shrink-0 rounded-xl text-zinc-300 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:mx-auto"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[9px] tracking-[0.15em] text-zinc-400">
            WORKSPACE
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ label, icon: Icon, href, enabled }) => {
                const isActive = enabled && pathname.startsWith(href);

                return (
                  <Fragment key={label}>
                    <SidebarMenuItem>
                    {enabled ? (
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={label}
                        className="h-10 rounded-xl px-3 text-[12px] text-zinc-300 hover:bg-white/10 hover:text-white data-[active=true]:bg-zinc-200 data-[active=true]:text-zinc-950 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-2"
                      >
                        <Link
                          href={href}
                          aria-label={label}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <Icon className="size-4 shrink-0 group-data-[collapsible=icon]:mx-auto" />
                          <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <div className="flex h-10 items-center gap-2 rounded-xl px-3 text-[12px] text-zinc-500 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
                        <Icon className="size-4 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                        <span className="ml-auto text-[9px] uppercase tracking-wider text-zinc-600 group-data-[collapsible=icon]:hidden">
                          soon
                        </span>
                      </div>
                    )}
                    </SidebarMenuItem>
                    {label === "Notes" && loaded && notes.map((note) => (
                <SidebarMenuItem key={note.id} className="ml-3 w-[calc(100%-0.75rem)] group-data-[collapsible=icon]:hidden">
                  <SidebarMenuButton
                    type="button"
                    isActive={active?.id === note.id}
                    tooltip={note.title || "Untitled"}
                    onClick={() => select(note.id)}
                    aria-label={note.title || "Untitled note"}
                    className="h-9 rounded-xl px-3 text-[11px] text-zinc-400 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-zinc-100 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-2"
                  >
                    <FileText className="size-4 shrink-0 group-data-[collapsible=icon]:mx-auto" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {note.title || "Untitled"}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
                  </Fragment>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 overflow-visible p-3">
        <div className="hidden items-center justify-end gap-2 group-data-[collapsible=icon]:flex-col md:flex">
          <WorkspaceSearchTrigger />
          {pathname === "/drive" ? <DriveUploadButton /> : <button type="button" onClick={createNote} aria-label="Create new note" title="Create new note" className="relative z-20 flex size-10 shrink-0 items-center justify-center self-end rounded-full border border-white/15 bg-[#1b1b1b] text-zinc-200 shadow-lg transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300"><Plus className="size-5" /></button>}
        </div>
        <Link href="/settings" aria-label="Settings" data-workspace-sidebar-control aria-current={pathname.startsWith("/settings") ? "page" : undefined} className={`flex h-10 items-center gap-2 rounded-xl px-3 text-[12px] text-zinc-300 transition hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 ${pathname.startsWith("/settings") ? "bg-white/10 text-white" : ""}`}>
          <Settings className="size-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Settings</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            aria-label="Sign out"
            data-workspace-sidebar-control
            className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-[12px] text-zinc-400 transition hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
          >
            <LogOut className="size-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
          </button>
        </form>
      </SidebarFooter>
    </SidebarRoot>
  );
}