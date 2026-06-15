import type { Metadata } from "next";
import { Hanken_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { CommandPaletteMount } from "@/components/CommandPaletteMount";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://scorefit.net"),
  title: {
    default: "ScoreFit — Science-based hypertrophy training",
    template: "%s · ScoreFit",
  },
  description:
    "Two 12-week, science-based hypertrophy programs. 53 exercises with sets, reps, RPE targets, substitutions, demo videos, and a full training guidebook.",
  keywords: [
    "hypertrophy",
    "bodybuilding program",
    "muscle building",
    "RPE training",
    "progressive overload",
    "ScoreFit",
  ],
  openGraph: {
    title: "ScoreFit — Science-based hypertrophy training",
    description:
      "Two 12-week hypertrophy programs, 53 exercises, RPE-based progression, and a full guidebook.",
    url: "https://scorefit.net",
    siteName: "ScoreFit",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "ScoreFit" },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://www.youtube-nocookie.com" />
      </head>
      <body className="min-h-screen antialiased">
        <div className="grain" aria-hidden />
        <AuthSessionProvider>
          <MotionProvider>
            <SiteHeader />
            <main>{children}</main>
            <Footer />
            <CommandPaletteMount />
          </MotionProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
