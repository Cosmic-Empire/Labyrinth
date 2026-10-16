"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  Command,
  FileText,
  FlaskConical,
  ImagePlus,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/src/components/ui/sidebar";
import { Toaster } from "@/src/components/ui/sonner";

type Theme = "light" | "dark";

const notes = [
  {
    title: "A quieter kind of focus",
    excerpt: "Make room for the thought before you rush to make it useful.",
    date: "Today · 9:41 AM",
    tag: "Reflection",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200",
  },
  {
    title: "Signals from the garden",
    excerpt: "Small systems, given time, have a way of finding their own rhythm.",
    date: "Yesterday · 4:18 PM",
    tag: "Field notes",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200",
  },
  {
    title: "Ideas for later",
    excerpt: "A collection of loose threads worth coming back to.",
    date: "Oct 12 · 11:06 AM",
    tag: "Ideas",
    color: "bg-violet-100 text-violet-800 dark:bg-violet-300/10 dark:text-violet-200",
  },
];

const searchItems = [
  { title: "A quieter kind of focus", type: "Note", icon: FileText },
  { title: "Liquid glass study", type: "Component", icon: Sparkles },
  { title: "Signals from the garden", type: "Note", icon: FileText },
  { title: "Workspace settings", type: "Page", icon: Settings2 },
];

const sectionVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const glassPanel =
  "rounded-[28px] border border-white/70 bg-white/65 shadow-[0_16px_50px_-32px_rgba(52,42,24,0.32)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055] dark:shadow-black/20";

function Section({
  number,
  title,
  description,
  children,
  id,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      className="scroll-mt-10"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
            COMPONENT {number}
          </p>
          <h2 className="text-[19px] font-semibold tracking-[-0.04em] text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}

function HoverSurface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.008 }}
      transition={{ type: "spring", stiffness: 320, damping: 25 }}
    >
      <Card className={`${glassPanel} ${className}`}>{children}</Card>
    </motion.div>
  );
}

function MazeAnimation() {
  return (
    <div className="relative mx-auto flex h-[214px] w-full max-w-[350px] items-center justify-center overflow-hidden rounded-[24px] bg-[#f2eee6] dark:bg-[#151513]">
      <motion.div
        className="absolute h-40 w-40 rounded-full bg-amber-300/30 blur-[55px] dark:bg-amber-400/10"
        animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.svg
        viewBox="0 0 240 180"
        className="relative h-[190px] w-[270px] overflow-visible"
        role="img"
        aria-label="An isometric maze gently tracing its path"
      >
        <defs>
          <linearGradient id="maze-ink" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#c58a20" />
            <stop offset="1" stopColor="#e1bd70" />
          </linearGradient>
          <filter id="maze-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <motion.g
          initial={{ opacity: 0.7, rotateX: 8 }}
          animate={{ y: [0, -3, 0], opacity: [0.72, 1, 0.72] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "120px 90px" }}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M120 20 202 66 120 112 38 66Z" stroke="#d8cdb9" strokeWidth="1.2" />
          <path d="m38 66 82 47v43L38 109Z" stroke="#c9bca5" strokeWidth="1.2" />
          <path d="m202 66-82 47v43l82-47Z" stroke="#d8cdb9" strokeWidth="1.2" />
          <path d="m65 66 55 32 55-32M92 51l55 32M92 82l55-32M65 98l28-16m27 16 27-16m-82 32 27 16m28-16 27 16" stroke="#ddd3c2" strokeWidth="1" />
          <path d="M39 66h27l13 8v11l-14 8v15l27 16 14-8V99l14-8 14 8v15l13 8 28-16V91l-14-8V67h27" stroke="url(#maze-ink)" strokeWidth="2.3" pathLength="1" strokeDasharray="0.08 0.015" />
          <motion.path
            d="M39 66h27l13 8v11l-14 8v15l27 16 14-8V99l14-8 14 8v15l13 8 28-16V91l-14-8V67h27"
            stroke="url(#maze-ink)"
            strokeWidth="2.3"
            pathLength="1"
            strokeDasharray="0.17 0.83"
            filter="url(#maze-glow)"
            animate={{ strokeDashoffset: [0, -1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
          <motion.circle
            r="4.5"
            fill="#f3bd4d"
            stroke="#fff8e8"
            strokeWidth="2"
            filter="url(#maze-glow)"
            animate={{ cx: [39, 66, 79, 79, 65, 65, 92, 106, 106, 120, 134, 134, 148, 161, 189, 189, 175, 175, 202], cy: [66, 66, 74, 85, 93, 108, 124, 116, 99, 91, 99, 114, 122, 114, 98, 91, 83, 67, 66] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        </motion.g>
      </motion.svg>
      <div className="absolute bottom-3 flex items-center gap-1.5 rounded-full border border-white/75 bg-white/75 px-3 py-1.5 text-[10px] font-medium text-zinc-500 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/75 dark:text-zinc-400">
        <motion.span className="size-1.5 rounded-full bg-amber-500" animate={{ opacity: [0.45, 1, 0.45], scale: [0.85, 1.15, 0.85] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        Finding a way through
      </div>
    </div>
  );
}

export default function DesignShowcase() {
  const [theme, setTheme] = useState<Theme>("light");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const isDark = theme === "dark";

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  const filteredItems = useMemo(
    () =>
      searchItems.filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  const showToast = (variant: "success" | "note" = "success") => {
    const isSuccess = variant === "success";
    toast.custom(
      (id) => (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.96, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="flex w-[350px] items-center gap-3 rounded-[22px] border border-white/70 bg-white/90 p-3.5 text-zinc-900 shadow-[0_18px_60px_-24px_rgba(20,20,20,.32)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#20201e]/95 dark:text-white"
        >
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-2xl ${isSuccess ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"}`}>
            {isSuccess ? <Check className="size-4" /> : <Sparkles className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">{isSuccess ? "Saved just right" : "A little note for you"}</span>
            <span className="mt-0.5 block text-[11px] text-zinc-500 dark:text-zinc-400">{isSuccess ? "Your changes are tucked away." : "A soft reminder to take a breath."}</span>
          </span>
          <button aria-label="Dismiss notification" onClick={() => toast.dismiss(id)} className="rounded-full p-1.5 text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"><X className="size-3.5" /></button>
        </motion.div>
      ),
      { duration: 3600 },
    );
  };

  const acceptFile = (file?: File) => {
    if (file) {
      setFileName(file.name);
      toast.success("File ready to upload", { description: file.name });
    }
  };

  return (
    <div
      className={`design-shell min-h-screen transition-colors duration-500 ${isDark ? "dark" : ""}`}
      style={{
        background: isDark
          ? "radial-gradient(ellipse at 50% -15%, rgba(99,79,43,.16), transparent 52%), #0c0c0b"
          : "radial-gradient(ellipse at 50% -15%, rgba(238,202,133,.17), transparent 48%), #f8f7f4",
        color: isDark ? "#f4f2ee" : "#252420",
      }}
    >
      <SidebarProvider
        defaultOpen
        className="min-h-screen w-full bg-transparent"
        style={{ "--sidebar-width": "17rem", "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}
      >
        <Sidebar collapsible="offcanvas" variant="sidebar" className="design-sidebar border-r border-zinc-200/70 bg-white/55 dark:border-white/10 dark:bg-[#111110]/85">
          <SidebarHeader className="gap-5 p-4">
            <a href="#top" className="flex items-center gap-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
              <motion.span
              className="flex size-10 items-center justify-center rounded-[15px] bg-zinc-900 text-amber-300 shadow-lg shadow-black/10 dark:bg-amber-300 dark:text-zinc-950"
              whileHover={{ rotate: -8, scale: 1.08 }}
              transition={{ type: "spring", stiffness: 340, damping: 18 }}
              ><FlaskConical className="size-[18px]" /></motion.span>
              <span>
                <span className="block text-[14px] font-semibold tracking-[-0.03em]">little lab</span>
                <span className="block text-[10px] tracking-[0.13em] text-zinc-400">A STUDY IN SOFT UI</span>
              </span>
            </a>
            <div className="rounded-[18px] border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-300/10 dark:bg-amber-300/[0.07]">
              <p className="text-[9px] font-semibold tracking-[0.16em] text-amber-800 dark:text-amber-200">COMPONENT 06</p>
              <p className="mt-1 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Sidebar</p>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-[9px] tracking-[0.15em]">WORKSPACE</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[
                    { label: "Overview", icon: LayoutDashboard, href: "#top" },
                    { label: "Spotlight", icon: Search, href: "#spotlight" },
                    { label: "My notes", icon: FileText, href: "#notes" },
                    { label: "Dropzone", icon: ImagePlus, href: "#dropzone" },
                  ].map(({ label, icon: Icon, href }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton asChild isActive={activeNav === label} className="h-10 rounded-xl px-3 text-[12px]">
                        <a href={href} onClick={() => setActiveNav(label)}>
                          <Icon className="size-4" />
                          <span>{label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="flex items-center gap-2.5 rounded-[15px] border border-zinc-200/60 bg-white/55 p-2.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
              <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-rose-200 text-[10px] font-semibold text-amber-950">S</span>
              <span className="text-[10px] font-medium">Sage Morgan</span>
              <MoreHorizontal className="ml-auto size-4 text-zinc-400" />
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset
          className="min-h-screen bg-transparent text-inherit"
          style={{
            background: isDark
              ? "radial-gradient(ellipse at 50% -15%, rgba(99,79,43,.16), transparent 52%), #0c0c0b"
              : "radial-gradient(ellipse at 50% -15%, rgba(238,202,133,.17), transparent 48%), #f8f7f4",
            color: isDark ? "#f4f2ee" : "#252420",
          }}
        >
          <div className="mx-auto w-full max-w-[1250px] px-5 pb-24 pt-7 sm:px-8 lg:px-12">
        <header className="mb-12 flex items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="flex size-9 rounded-[13px] border border-zinc-200/70 bg-white/65 text-zinc-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/10" />
            <span className="hidden text-[11px] font-medium text-zinc-500 dark:text-zinc-400 sm:inline">Component playground</span>
          </div>
          <div aria-label="Color theme" className={`flex rounded-full border p-1 shadow-sm backdrop-blur-xl ${isDark ? "border-white/10 bg-white/[0.05]" : "border-black/[0.07] bg-white/65"}`} role="group">
            {(["light", "dark"] as const).map((option) => (
              <button key={option} aria-pressed={theme === option} onClick={() => setTheme(option)} type="button" className={`rounded-full px-3.5 py-1.5 text-[11px] font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${theme === option ? isDark ? "bg-white/15 text-white" : "bg-white text-zinc-900 shadow-sm" : isDark ? "text-white/50 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}>{option}</button>
            ))}
          </div>
        </header>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-12 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50/70 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-amber-800 dark:border-amber-300/10 dark:bg-amber-300/[0.07] dark:text-amber-200"><Sparkles className="size-3" /> COMPONENT PLAYGROUND <span className="text-amber-500/50">·</span> 01—11</div>
          <h1 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.065em] text-zinc-950 dark:text-white sm:text-[54px]">A softer kind<br className="hidden sm:block" /> of interface.</h1>
          <p className="mt-4 max-w-lg text-[14px] leading-6 text-zinc-500 dark:text-zinc-400">A small collection of liquid, tactile building blocks. Rounded at the edges, a little bit alive, and made to feel good to use.</p>
        </motion.div>

        <div className="grid gap-11 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-12">
          <Section id="top" number="01" title="Glass card" description="Frosted surfaces with a hint of warmth.">
            <HoverSurface className="group relative min-h-[228px] overflow-hidden p-6 sm:p-7">
              <motion.div className="absolute -right-6 -top-16 size-48 rounded-full bg-amber-200/35 blur-[40px] dark:bg-amber-300/10" animate={{ x: [0, -12, 0], y: [0, 10, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
              <div className="relative flex items-start justify-between gap-4">
                <span className="flex size-11 items-center justify-center rounded-[17px] border border-white/80 bg-white/70 text-amber-700 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-amber-200"><AudioLines className="size-5" /></span>
                <Badge className="rounded-full border border-emerald-200/80 bg-emerald-50/75 px-2.5 py-1 text-[10px] font-medium text-emerald-800 dark:border-emerald-300/10 dark:bg-emerald-300/10 dark:text-emerald-200"><span className="size-1.5 rounded-full bg-emerald-500" /> IN FLOW</Badge>
              </div>
              <div className="relative mt-7">
                <p className="text-[10px] font-semibold tracking-[0.17em] text-zinc-400">WEDNESDAY, OCTOBER 14</p>
                <h3 className="mt-2 text-[21px] font-semibold tracking-[-0.045em]">A little space to think.</h3>
                <p className="mt-1.5 max-w-sm text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">Like light through a window, this surface gently lifts what matters.</p>
              </div>
              <motion.span className="absolute bottom-6 right-6 flex size-9 items-center justify-center rounded-full border border-white/80 bg-white/75 text-zinc-500 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-zinc-300" whileHover={{ x: 3 }}><ArrowUpRight className="size-4" /></motion.span>
            </HoverSurface>
          </Section>

          <Section number="02" title="Buttons" description="A little weight, a little lift. Three different moods.">
            <HoverSurface className="flex min-h-[228px] flex-col justify-between gap-6 p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-3">
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}><Button className="h-12 rounded-[18px] border-b-[3px] border-amber-600 bg-amber-400 px-5 text-[13px] font-semibold text-amber-950 shadow-[0_8px_22px_-10px_rgba(180,112,17,.65)] hover:bg-amber-300 active:translate-y-[2px] active:border-b-0">A little action <ArrowRight className="size-4" /></Button></motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}><Button variant="ghost" className="h-11 rounded-[16px] border border-zinc-200/80 bg-white/45 px-4 text-[12px] text-zinc-700 hover:bg-white/90 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10">Maybe later</Button></motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}><Button variant="destructive" className="h-11 rounded-[16px] bg-rose-500 px-4 text-[12px] text-white shadow-sm shadow-rose-500/20 hover:bg-rose-600">Remove <X className="size-3.5" /></Button></motion.div>
              </div>
              <div className="flex items-center gap-2 border-t border-zinc-200/50 pt-4 text-[10px] text-zinc-400 dark:border-white/[0.07]"><span className="size-1.5 rounded-full bg-amber-400" /> Primary <span className="ml-3 size-1.5 rounded-full bg-zinc-400" /> Ghost <span className="ml-3 size-1.5 rounded-full bg-rose-400" /> Danger</div>
            </HoverSurface>
          </Section>

          <Section number="03" title="Input box" description="A soft landing for whatever’s on your mind.">
            <HoverSurface className="min-h-[220px] p-6 sm:p-7">
              <label htmlFor="thought-input" className="mb-2.5 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Leave yourself a thought</label>
              <div className="relative">
                <Input id="thought-input" placeholder="Type a thought…" className="h-[54px] rounded-[18px] border-white/80 bg-white/70 px-4 py-2 pr-12 text-[13px] text-zinc-900 shadow-[0_4px_20px_-14px_rgba(0,0,0,.24)] placeholder:text-zinc-500 focus-visible:border-amber-300 focus-visible:ring-amber-300/20 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder:text-zinc-400" />
                <span className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl bg-amber-100/80 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200"><ArrowUpRight className="size-4" /></span>
              </div>
              <p className="mt-3 text-[10px] text-zinc-400">A simple place to gather a thought.</p>
            </HoverSurface>
          </Section>

          <Section number="04" title="Badges & tags" description="Small bits of context, wrapped up neatly.">
            <HoverSurface className="flex min-h-[220px] flex-col justify-center gap-5 p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge className="rounded-full border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-100"><Sparkles /> In progress</Badge>
                <Badge variant="outline" className="rounded-full border-zinc-200 bg-white/45 text-zinc-600 dark:border-white/15 dark:bg-white/[0.03] dark:text-zinc-300"><span className="size-1.5 rounded-full bg-emerald-400" /> Ready</Badge>
                <Badge className="rounded-full border border-violet-200/70 bg-violet-100/75 text-violet-800 dark:border-violet-300/10 dark:bg-violet-300/10 dark:text-violet-200"><Tag /> Inspiration</Badge>
                <Badge variant="outline" className="rounded-full border-zinc-200/80 text-zinc-500 dark:border-white/10 dark:text-zinc-400">+ Add tag</Badge>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-200/50 pt-4 dark:border-white/[0.07]">
                {["gentle", "thoughts", "someday"].map((tag) => <motion.button key={tag} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} className="rounded-full border border-zinc-200/80 bg-white/50 px-3 py-1.5 text-[10px] text-zinc-500 transition hover:border-amber-300 hover:text-amber-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 dark:hover:text-amber-200">#{tag} <span className="ml-1 text-zinc-400">×</span></motion.button>)}
              </div>
            </HoverSurface>
          </Section>

          <Section number="05" title="Modal" description="A little moment of focus, floating above everything else.">
            <HoverSurface className="flex min-h-[210px] flex-col items-start justify-center gap-4 p-6 sm:p-7">
              <div className="flex size-12 items-center justify-center rounded-[17px] bg-violet-100/80 text-violet-700 dark:bg-violet-300/10 dark:text-violet-200"><LockKeyhole className="size-5" /></div>
              <div><p className="text-[14px] font-semibold">A considered pause.</p><p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Open a softly layered dialog.</p></div>
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild><Button className="h-10 rounded-[15px] bg-zinc-900 px-4 text-[11px] text-white transition-transform hover:-translate-y-0.5 hover:bg-zinc-700 active:scale-[0.97] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">Open the moment <ArrowUpRight className="size-3.5" /></Button></DialogTrigger>
                <DialogContent className={`max-w-[420px] overflow-hidden rounded-[30px] border-white/70 p-0 text-zinc-900 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:text-zinc-100 ${isDark ? "dark bg-[#191917]" : "bg-[#fcfbf8]"}`} style={{ backgroundColor: isDark ? "#191917" : "#fcfbf8", color: isDark ? "#f4f2ee" : "#252420" }}>
                  <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 360, damping: 28 }} className="p-7 sm:p-8">
                    <DialogHeader className="text-left">
                      <span className="mb-2 flex size-11 items-center justify-center rounded-[16px] bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200"><Sparkles className="size-5" /></span>
                      <DialogTitle className="text-[22px] tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">Make a little room.</DialogTitle>
                      <DialogDescription className="text-[13px] leading-6 text-zinc-600 dark:text-zinc-300">A modal is a gentle interruption. Use it for one clear decision, then let people get back to what they were doing.</DialogDescription>
                    </DialogHeader>
                    <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setModalOpen(false)} className="rounded-[14px] text-[12px] text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">Not now</Button><Button onClick={() => setModalOpen(false)} className="rounded-[14px] bg-amber-400 text-[12px] text-amber-950 hover:bg-amber-300">Sounds good <Check className="size-3.5" /></Button></div>
                  </motion.div>
                </DialogContent>
              </Dialog>
            </HoverSurface>
          </Section>

          <Section id="spotlight" number="07" title="Search / spotlight" description="A quick, quiet way to find the thing you almost remembered.">
            <HoverSurface className="min-h-[250px] p-4 sm:p-5">
              <div className={`rounded-[22px] border bg-white/80 shadow-[0_20px_60px_-35px_rgba(33,27,19,.35)] backdrop-blur-2xl transition-colors dark:bg-[#1d1d1b]/85 ${searchOpen ? "border-amber-300/80 ring-4 ring-amber-300/10 dark:border-amber-200/20" : "border-white/80 dark:border-white/10"}`}>
                <div className="flex h-[58px] items-center gap-3 px-4">
                  <Search className="size-[18px] shrink-0 text-zinc-500 dark:text-zinc-300" />
                  <div className="min-w-0 flex-1">
                    <Input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 160)} onKeyDown={(event) => { if (event.key === "Escape") { setSearch(""); setSearchOpen(false); (event.target as HTMLInputElement).blur(); } }} placeholder="Search anything…" aria-label="Search anything" className="h-auto w-full border-0 bg-transparent px-0 py-1 text-[13px] text-zinc-900 shadow-none outline-none placeholder:text-zinc-500 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent dark:text-zinc-100 dark:placeholder:text-zinc-400" />
                  </div>
                  <kbd className="flex shrink-0 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-[9px] text-zinc-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"><Command className="size-2.5" /> K</kbd>
                </div>
                <AnimatePresence initial={false}>
                  {searchOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="mx-4 border-t border-zinc-200/70 dark:border-white/[0.08]" /><p className="px-4 pb-1 pt-3 text-[9px] font-semibold tracking-[0.14em] text-zinc-400">QUICK FIND</p><div className="px-2 pb-2">{filteredItems.length ? filteredItems.map(({ title, type, icon: Icon }, index) => <motion.button key={title} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.035 }} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSearch(title); setSearchOpen(false); }} className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2 text-left transition hover:bg-amber-50 dark:hover:bg-amber-300/[0.07]"><span className="flex size-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-300"><Icon className="size-3.5" /></span><span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-900 dark:text-zinc-100">{title}</span><span className="text-[9px] text-zinc-500 dark:text-zinc-400">{type}</span></motion.button>) : <p className="px-3 py-4 text-[11px] text-zinc-600 dark:text-zinc-300">Nothing found just yet.</p>}</div></motion.div>}
                </AnimatePresence>
              </div>
              <div className="mt-3 flex items-center gap-2 px-1 text-[10px] text-zinc-400"><Sparkles className="size-3 text-amber-500" /> Start typing to see your recent thoughts.</div>
            </HoverSurface>
          </Section>

          <Section id="dropzone" number="08" title="Dropzone" description="A welcoming place for files that are on their way.">
            <HoverSurface className="min-h-[250px] p-4 sm:p-5">
              <input ref={fileInput} type="file" className="sr-only" aria-label="Choose a file to upload" onChange={(event) => acceptFile(event.target.files?.[0])} />
              <motion.div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }} animate={{ scale: dragging ? 1.015 : 1, borderColor: dragging ? "#eebd59" : isDark ? "rgba(255,255,255,.15)" : "rgba(210,204,192,.8)" }} transition={{ type: "spring", stiffness: 350, damping: 26 }} className={`flex min-h-[207px] flex-col items-center justify-center rounded-[21px] border border-dashed px-5 text-center ${dragging ? "bg-amber-50/90 dark:bg-amber-300/[0.07]" : "bg-white/30 dark:bg-white/[0.015]"}`}>
                <motion.span animate={{ y: dragging ? -5 : [0, -3, 0], rotate: dragging ? -8 : 0 }} transition={dragging ? { type: "spring", stiffness: 350 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }} className="mb-3 flex size-12 items-center justify-center rounded-[18px] border border-white/90 bg-white/80 text-amber-700 shadow-sm dark:border-white/10 dark:bg-white/[0.07] dark:text-amber-200">{fileName ? <Check className="size-5" /> : <Upload className="size-5" />}</motion.span>
                <p className="max-w-full truncate text-[12px] font-semibold">{fileName || (dragging ? "That looks perfect — let go." : "Drop something lovely here")}</p>
                <p className="mt-1 text-[10px] text-zinc-400">{fileName ? "Ready whenever you are." : "PDF, images, or anything you’d like to keep."}</p>
                <Button variant="ghost" onClick={() => fileInput.current?.click()} className="mt-3 h-8 rounded-xl border border-zinc-200/80 bg-white/55 px-3 text-[10px] text-zinc-600 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/10">{fileName ? "Choose another" : "Browse files"}<ArrowDownToLine className="size-3" /></Button>
              </motion.div>
            </HoverSurface>
          </Section>

          <Section id="notes" number="09" title="Note cards" description="A few of the things you meant to remember.">
            <div className="grid gap-3">
              {notes.map((note, index) => <motion.div key={note.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08, duration: 0.45 }} whileHover={{ y: -3, scale: 1.006 }} className={`${glassPanel} group flex items-start gap-3.5 p-4`}>
                <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[14px] ${note.color}`}><FileText className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-[12px] font-semibold tracking-[-0.02em]">{note.title}</span><ArrowUpRight className="size-3 shrink-0 text-zinc-300 opacity-0 transition group-hover:opacity-100" /></span><span className="mt-1 block text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">{note.excerpt}</span><span className="mt-2.5 flex items-center gap-2"><span className="rounded-full bg-white/65 px-2 py-0.5 text-[9px] text-zinc-500 dark:bg-white/[0.07] dark:text-zinc-400">{note.tag}</span><span className="text-[9px] text-zinc-400">{note.date}</span></span></span>
                <button aria-label={`More options for ${note.title}`} className="rounded-lg p-1 text-zinc-400 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"><MoreHorizontal className="size-4" /></button>
              </motion.div>)}
            </div>
          </Section>

          <Section number="10" title="Empty & loading" description="A maze instead of a spinner. Some things take the scenic route.">
            <HoverSurface className="overflow-hidden p-4 sm:p-5"><MazeAnimation /><div className="mt-4 flex items-center justify-between gap-3 px-1"><span className="text-[10px] text-zinc-400">An isometric little detour.</span><span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-200"><span className="size-1.5 animate-pulse rounded-full bg-amber-400" /> STILL EXPLORING</span></div></HoverSurface>
          </Section>

          <Section number="11" title="Toasts" description="A tiny bit of feedback, served with a soft landing.">
            <HoverSurface className="flex min-h-[250px] flex-col justify-between p-6 sm:p-7">
              <div><span className="mb-4 flex size-11 items-center justify-center rounded-[17px] bg-emerald-100/80 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200"><Check className="size-5" /></span><p className="text-[14px] font-semibold">All tucked away.</p><p className="mt-1 max-w-xs text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">Sonner toasts can be helpful without making a fuss. Try one out.</p></div>
              <div className="mt-6 flex flex-wrap gap-2"><motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}><Button onClick={() => showToast("success")} className="h-10 rounded-[15px] bg-amber-400 px-4 text-[11px] font-semibold text-amber-950 hover:bg-amber-300">Show a toast <Sparkles className="size-3.5" /></Button></motion.div><motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}><Button onClick={() => showToast("note")} variant="ghost" className="h-10 rounded-[15px] border border-zinc-200/80 bg-white/45 px-4 text-[11px] text-zinc-600 hover:bg-white/90 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/10">A small note</Button></motion.div></div>
            </HoverSurface>
          </Section>
        </div>

        <motion.footer initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-zinc-200/65 pt-6 text-[10px] text-zinc-400 dark:border-white/[0.08] sm:flex-row">
          <span className="flex items-center gap-1.5"><FlaskConical className="size-3" /> Made gently, in the little lab.</span>
          <motion.button whileHover={{ x: 3 }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-1.5 transition hover:text-zinc-700 dark:hover:text-zinc-200">Back to the beginning <Plus className="size-3 rotate-45" /></motion.button>
        </motion.footer>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" theme={isDark ? "dark" : "light"} closeButton={false} gap={10} />
    </div>
  );
}
