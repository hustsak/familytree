import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { LanguageProvider } from "@/lib/i18n/context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const khmerSiemreap = localFont({
  src: "../../public/fonts/KhmerOSSiemreap.ttf",
  variable: "--font-khmer-siemreap",
  display: "swap",
});

export const metadata: Metadata = {
  title: "កូនចៅត្រកូល ទៀង | ដែនគ្រួសារឯកជន (Private Family Tree)",
  description: "ដែនពង្សាវតារ និងមែកធាងគ្រួសារឯកជន សម្រាប់តែសមាជិកគ្រួសារត្រកូល ទៀង។",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="km"
      className={`${geistSans.variable} ${geistMono.variable} ${khmerSiemreap.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0c0f14] text-slate-100 selection:bg-[#d4af37]/30 selection:text-white">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
