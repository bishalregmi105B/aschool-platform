import type { Metadata } from "next";
import { Inter, Mukta } from "next/font/google";
import "./globals.css";
import "@/src/styles/aos-theme.css";
import "@/src/styles/aos-integration-overrides.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Devanagari UI font — every Nepali label renders in Mukta instead of the
// system fallback (which mixed serif Devanagari with sans Latin).
const mukta = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-mukta",
});

export const metadata: Metadata = {
  title: "ASchool — School Management OS for Nepal",
  description:
    "Complete plugin-based school management system for Nepal with Bikram Sambat calendar, eSewa/Khalti payments, and AI-powered insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ne" suppressHydrationWarning>
      <body className={`${inter.variable} ${mukta.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
