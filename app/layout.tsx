import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Labyrinth",
  description: "Labyrinth workspace for notes and ideas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Script id="workspace-theme-init" strategy="beforeInteractive">
          {`try { var theme = localStorage.getItem("labyrinth-workspace-theme"); var root = document.documentElement; root.dataset.workspaceTheme = theme === "light" || theme === "dark" || theme === "system" ? theme : "system"; root.classList.toggle("dark", theme !== "light"); root.style.colorScheme = theme === "light" ? "light" : "dark"; } catch {}`}
        </Script>
      </body>
    </html>
  );
}
