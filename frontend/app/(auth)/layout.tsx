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
        .auth-bg {
          background: linear-gradient(135deg, #0e3b2e 0%, #155a44 50%, #0e3b2e 100%);
        }
        .auth-accent {
          box-shadow: 0 24px 80px rgba(14,59,46,0.16);
        }
      `}</style>

      {/* Decorative background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[color:var(--mint)]/20 blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-[color:var(--sun)]/15 blur-3xl translate-y-1/2 -translate-x-1/3"></div>
      </div>

      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 md:p-8 w-full">
        {children}
      </div>
    </div>
  );
}
