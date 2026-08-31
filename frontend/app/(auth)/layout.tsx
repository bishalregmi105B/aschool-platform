import { Sora, Space_Grotesk } from "next/font/google";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${sora.variable} ${space.variable} min-h-screen bg-[color:var(--fog)] text-[color:var(--ink)] flex flex-col`}
      style={{ fontFamily: "var(--font-space)" }}
    >
      <style>{`
        :root {
          --ink: #0d1f14;
          --mint: #c5f4dd;
          --sun: #f4c25d;
          --ocean: #0e3b2e;
          --ocean-light: #155a44;
          --fog: #f7f5f0;
          --card: #ffffff;
          --muted: #6b7a72;
        }
      `}</style>

      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 md:p-8 w-full">
        {children}
      </div>
    </div>
  );
}
