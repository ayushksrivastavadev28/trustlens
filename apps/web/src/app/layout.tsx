import type { Metadata } from "next";
import { Manrope, Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "TrustLens AI",
  description: "TrustLens AI - instant trust score for messages, emails, and links."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${fraunces.variable} font-sans`}>
        <Providers>
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <Link href="/" className="font-semibold tracking-tight">
                TrustLens AI
              </Link>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/analyze" className="hover:text-foreground">Analyze</Link>
                <Link href="/history" className="hover:text-foreground">History</Link>
                <Link href="/paywall" className="hover:text-foreground">Paywall</Link>
                <Link href="/account" className="hover:text-foreground">Account</Link>
              </div>
            </nav>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
