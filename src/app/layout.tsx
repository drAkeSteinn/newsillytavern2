import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { PersistenceProvider } from "@/components/persistence-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TavernFlow - AI Character Chat Platform",
  description: "Modern LLM frontend for AI character interactions, similar to SillyTavern but optimized and more configurable.",
  keywords: ["TavernFlow", "AI", "LLM", "Character Cards", "Roleplay", "Chat", "Next.js"],
  authors: [{ name: "TavernFlow Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TavernFlow",
    description: "Modern LLM frontend for AI character interactions",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <PersistenceProvider>
            {children}
          </PersistenceProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
