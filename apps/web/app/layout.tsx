import type { Metadata } from "next";
import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebMCP Hub",
  description: "A community registry of WebMCP configurations for AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <Providers>
          <header className="border-b border-zinc-800 px-6 py-4">
            <nav className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-xl font-bold text-white hover:text-zinc-300"
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 bg-white rounded-full text-xl leading-none">
                    🕷️
                  </span>
                  WebMCP Hub
                </Link>
                <div className="hidden sm:flex items-center gap-4 text-sm text-zinc-400">
                  <Link href="/#browse" className="hover:text-zinc-200 transition-colors">
                    Configs
                  </Link>
                  <Link href="/contribute" className="hover:text-zinc-200 transition-colors">
                    Contribute
                  </Link>
                  <Link href="/leaderboard" className="hover:text-zinc-200 transition-colors">
                    Leaderboard
                  </Link>
                  <Link href="/settings" className="hover:text-zinc-200 transition-colors">
                    Settings
                  </Link>
                </div>
              </div>
              <SignInButton />
            </nav>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-zinc-800 px-6 py-6 text-center text-zinc-500 text-sm">
            <span>WebMCP Community Hub — Open-standard config registry for AI agents</span>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privacy Policy
            </Link>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
