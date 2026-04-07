import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";

import "./globals.css";

const headingFont = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sansFont = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SyncStay",
  description: "Real-time multi-channel control system for hotel distribution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${headingFont.variable} ${sansFont.variable}`}>
      <body className="min-h-screen bg-[var(--background)] font-sans text-[var(--text-primary)]">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
