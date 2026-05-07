import Link from "next/link";
import { Sora, Space_Grotesk } from "next/font/google";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });

const heroStats = [
  { label: "Modules", value: "50+" },
  { label: "Apps", value: "3" },
  { label: "Schools", value: "400+" },
];

const coreBlocks = [
  {
    title: "Academic operations",
    description: "Attendance, exams, results, and report cards organized by grade and term.",
  },
  {
    title: "Fees + payments",
    description: "Auto invoices, fee reminders, and wallet integrations for Nepal.",
  },
  {
    title: "People + HR",
    description: "Staff records, leave, payroll, and performance in one place.",
  },
  {
    title: "Website + admissions",
    description: "Publish school sites, accept inquiries, and track admissions.",
  },
];

const launchSteps = [
  {
    title: "Create your school workspace",
    description: "Add academic year, classes, shifts, and staff roles.",
  },
  {
    title: "Onboard students",
    description: "Import lists or register via guided admissions forms.",
  },
  {
    title: "Activate modules",
    description: "Turn on only what you need and scale later.",
  },
  {
    title: "Publish your website",
    description: "Choose a theme, add content, and connect your domain.",
  },
];

const siteFeatures = [
  "Dynamic school subdomain",
  "Custom domain support",
  "Theme builder + branding",
  "Admission and inquiry forms",
  "Notice and events pages",
  "Photo gallery + highlights",
];

const toolGrid = [
  "Admissions",
  "Attendance",
  "Exams",
  "Fees",
  "Payroll",
  "Transport",
  "Library",
  "LMS",
  "Notices",
  "Events",
  "Analytics",
  "Website Builder",
];

export default function Home() {
  return (
    <div className={`${sora.variable} ${space.variable}`} style={{ fontFamily: "var(--font-space)" }}>
      <style>{`
        :root {
          --ink: #0b1621;
          --mint: #c5f4dd;
          --sun: #f4c25d;
          --ocean: #0e3b2e;
          --fog: #f6f3ee;
        }
        .grad-shift { background-size: 200% 200%; animation: gradient 10s ease infinite; }
        .float-slow { animation: float 8s ease-in-out infinite; }
        .float-fast { animation: float 5s ease-in-out infinite; }
        .rise { animation: rise 0.9s ease-out both; }
        .pulse-glow { box-shadow: 0 32px 90px rgba(14, 59, 46, 0.18); }
        .marquee { animation: marquee 20s linear infinite; }
        @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      <div className="min-h-screen bg-[color:var(--fog)] text-[color:var(--ink)]">
        <header className="sticky top-0 z-20 border-b border-black/10 bg-[color:var(--fog)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--ocean)] text-sm font-semibold text-white">
                AS
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-sora)" }}>ASchool</p>
                <p className="text-xs text-black/60">School OS for Nepal</p>
              </div>
            </div>
            <nav className="hidden items-center gap-6 text-sm text-black/70 md:flex">
              <a href="#platform" className="hover:text-black">Platform</a>
              <a href="#modules" className="hover:text-black">Modules</a>
              <a href="#website" className="hover:text-black">Websites</a>
              <a href="#onboarding" className="hover:text-black">Onboarding</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold hover:border-black/40"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-[color:var(--ink)] px-4 py-2 text-xs font-semibold text-white"
              >
                Start onboarding
              </Link>
            </div>
          </div>
        </header>

        <main>
          <section className="relative overflow-hidden">
            <div className="absolute -left-40 top-16 h-72 w-72 rounded-full bg-[color:var(--mint)] blur-3xl opacity-70" />
            <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#ffe6b5] blur-3xl opacity-80" />

            <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div className="space-y-6">
                <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/70">
                  Made for Nepali schools
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--sun)]" />
                </p>
                <h1 className="text-4xl font-semibold leading-tight md:text-5xl" style={{ fontFamily: "var(--font-sora)" }}>
                  Onboard once. Run every campus, class, and website from one home.
                </h1>
                <p className="text-base text-black/70">
                  ASchool connects academics, finance, and communication with a modern parent experience and websites that launch in days.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href="/register"
                    className="rounded-full bg-[color:var(--ocean)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-green-900/15"
                  >
                    Book onboarding
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-full border border-black/20 px-6 py-3 text-sm font-semibold text-black/80 hover:border-black/50"
                  >
                    View demo
                  </Link>
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-black/70">
                  {heroStats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-xl font-semibold text-black">{stat.value}</p>
                      <p>{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -top-10 right-8 h-36 w-36 rounded-3xl bg-[color:var(--sun)]/60 blur-2xl" />
                <div className="relative rounded-3xl bg-white p-6 pulse-glow rise">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-black/50">ASchool Home</p>
                      <p className="text-lg font-semibold">Live school overview</p>
                    </div>
                    <span className="rounded-full bg-[color:var(--mint)] px-3 py-1 text-xs font-semibold text-[color:var(--ocean)]">Today</span>
                  </div>
                  <div className="mt-6 grid gap-4">
                    {[
                      { label: "Attendance", value: "96%", note: "+2% vs last week" },
                      { label: "Fees collected", value: "NPR 2.8M", note: "Quarter goal 72%" },
                      { label: "Admissions", value: "148 open", note: "12 new inquiries" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-black/5 bg-[#f8f6f1] px-4 py-3">
                        <p className="text-xs text-black/50">{item.label}</p>
                        <p className="font-semibold text-black/90">{item.value}</p>
                        <p className="text-xs text-black/50">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 bg-white p-4 float-fast">
                    <p className="text-xs text-black/50">Website</p>
                    <p className="text-sm font-semibold">your-school.brighternepal.com</p>
                    <p className="text-xs text-black/50">Custom domain enabled</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white p-4 float-slow">
                    <p className="text-xs text-black/50">Parent app</p>
                    <p className="text-sm font-semibold">Real-time notices</p>
                    <p className="text-xs text-black/50">Android + iOS</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="platform" className="border-y border-black/10 bg-white/60">
            <div className="mx-auto max-w-6xl px-5 py-12">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-sora)" }}>
                  Built for everyday school operations
                </h2>
                <p className="hidden text-sm text-black/60 md:block">Everything admin teams need to stay on schedule.</p>
              </div>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {coreBlocks.map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-black/10 bg-white p-6 rise"
                    style={{ animationDelay: `${index * 0.08}s` }}
                  >
                    <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-sora)" }}>{item.title}</h3>
                    <p className="mt-2 text-sm text-black/70">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="modules" className="mx-auto max-w-6xl px-5 py-16">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/40">Modules</p>
                <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-sora)" }}>
                  Expand with flexible modules
                </h2>
              </div>
              <p className="text-sm text-black/60">Choose what you need today. Unlock more later.</p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {toolGrid.map((module, index) => (
                <div
                  key={module}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black/80 rise"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {module}
                </div>
              ))}
            </div>
            <div className="mt-10 overflow-hidden rounded-3xl border border-black/10 bg-[color:var(--ocean)]">
              <div className="marquee flex gap-8 whitespace-nowrap py-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                {[...toolGrid, ...toolGrid].map((item, index) => (
                  <span key={`${item}-${index}`} className="px-4">{item}</span>
                ))}
              </div>
            </div>
          </section>

          <section id="website" className="bg-[color:var(--fog)]">
            <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[0.95fr_1.05fr] md:items-center">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-black/40">School websites</p>
                <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-sora)" }}>
                  Every school gets a modern website with subdomain + custom domain support.
                </h2>
                <p className="text-sm text-black/70">
                  Website content stays synced with your dashboard. Publish in minutes and update anytime.
                </p>
                <div className="grid gap-3">
                  {siteFeatures.map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm">
                      <span>{item}</span>
                      <span className="text-xs font-semibold text-[color:var(--ocean)]">Included</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-6 py-3 text-xs font-semibold text-white"
                >
                  Configure your website
                </Link>
              </div>
              <div className="rounded-3xl border border-black/10 bg-white p-6 pulse-glow">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#f6f2ea] p-4">
                    <p className="text-xs text-black/50">Homepage preview</p>
                    <p className="text-lg font-semibold">Welcome to Green Valley School</p>
                    <p className="text-sm text-black/60">Admissions open for 2083 BS</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {["Notices", "Events", "Gallery", "Results"].map((item) => (
                      <div key={item} className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold">
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-[color:var(--ocean)] px-4 py-3 text-sm font-semibold text-white">
                    Admission forms connect directly to the dashboard
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="onboarding" className="mx-auto max-w-6xl px-5 py-16">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-sora)" }}>
                Onboarding that feels guided, not rushed.
              </h2>
              <p className="text-sm text-black/60">A clear checklist that gets your team online fast.</p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {launchSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-3xl border border-black/10 bg-white p-6 rise"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <p className="text-xs text-black/50">Step {index + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold" style={{ fontFamily: "var(--font-sora)" }}>{step.title}</h3>
                  <p className="mt-2 text-sm text-black/70">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[color:var(--ocean)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14 text-white md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-sora)" }}>
                  Ready to onboard your school?
                </h2>
                <p className="text-sm text-white/80">We set up your data, website, and apps together.</p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/register"
                  className="rounded-full bg-white px-6 py-3 text-xs font-semibold text-[color:var(--ocean)]"
                >
                  Book onboarding
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/60 px-6 py-3 text-xs font-semibold text-white"
                >
                  Admin login
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}