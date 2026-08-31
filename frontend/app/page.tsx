import Link from "next/link";
import { Sora, Space_Grotesk } from "next/font/google";
import {
  GraduationCap,
  CalendarCheck,
  DollarSign,
  BookOpen,
  Users,
  Bus,
  Library,
  LayoutDashboard,
  Bell,
  BarChart3,
  Globe,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
  ChevronRight,
  Building2,
  Award,
  Trophy,
  Fingerprint,
} from "lucide-react";
import { SCHOOL_SITE_DOMAIN } from "@/lib/site-domain";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });

const trustStats = [
  { value: "10+", label: "Years Experience" },
  { value: "400+", label: "Schools & Colleges" },
  { value: "50K+", label: "Students Together" },
  { value: "ISO", label: "27001 Certified" },
];

const features = [
  { icon: GraduationCap, title: "Student Management", desc: "Complete student profiles with photos, documents & history" },
  { icon: CalendarCheck, title: "Smart Attendance", desc: "Biometric, RFID & GPS-based attendance tracking" },
  { icon: DollarSign, title: "Fee & Accounting", desc: "Complete fee collection with online payment support" },
  { icon: BookOpen, title: "Exam & Results", desc: "Marksheet, grade cards & EMIS reporting" },
  { icon: Library, title: "Library Management", desc: "Book inventory, issue/return & fine management" },
  { icon: Users, title: "Payroll & HR", desc: "Staff salary, leave & attendance management" },
  { icon: LayoutDashboard, title: "Hostel & Canteen", desc: "Room allocation, mess & billing system" },
  { icon: Bell, title: "SMS & Mobile App", desc: "Instant notifications to parents & students" },
  { icon: Bus, title: "Vehicle GPS Tracking", desc: "Real-time bus location & route management" },
  { icon: BarChart3, title: "EMIS Reporting", desc: "Government-compliant reports & analytics" },
  { icon: Globe, title: "School Website", desc: "Custom domain, themes & admission forms" },
  { icon: Fingerprint, title: "Biometric Device", desc: "ZKTeco fingerprint & RFID attendance support" },
];

const institutionTypes = [
  {
    icon: GraduationCap,
    title: "Schools",
    subtitle: "Primary to Higher Secondary",
    desc: "Complete student management from nursery to class 12.",
    items: ["Student Profiles", "Fee Management", "Exam & Results", "Parent Communication"],
  },
  {
    icon: Building2,
    title: "Colleges",
    subtitle: "+2 & Bachelor Level",
    desc: "Semester-based management for higher education institutions.",
    items: ["Credit System", "Faculty Management", "Internal Assessment", "Certificate Generation"],
  },
  {
    icon: Trophy,
    title: "Multi-Branch",
    subtitle: "Campus Networks",
    desc: "Unified control across multiple campuses from one dashboard.",
    items: ["Multi-Campus", "Centralized Data", "Branch Analytics", "EMIS Reporting"],
  },
  {
    icon: Bus,
    title: "With Transport",
    subtitle: "GPS Tracking Included",
    desc: "Real-time vehicle tracking with parent notifications.",
    items: ["GPS Tracking", "Route Planning", "Driver Management", "Parent Alerts"],
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "NPR 0",
    period: "forever",
    badge: null,
    description: "Perfect for getting started and exploring the platform.",
    features: [
      "Up to 100 students",
      "Basic attendance & exams",
      "School website (subdomain)",
      "Notice board",
      "1 admin user",
      "Community support",
    ],
    cta: "Start Free",
    href: "/register?plan=free",
    highlight: false,
  },
  {
    name: "Starter",
    price: "NPR 399",
    period: "per month",
    badge: "Most Popular",
    description: "For growing schools that need full operations management.",
    features: [
      "Up to 500 students",
      "Full academics + fees + HR",
      "School website + custom domain",
      "Parent & student mobile apps",
      "5 admin users",
      "Admission forms + inquiries",
      "Priority support",
    ],
    cta: "Get Started",
    href: "/register?plan=starter",
    highlight: true,
  },
  {
    name: "Pro",
    price: "NPR 999",
    period: "per month",
    badge: null,
    description: "For large schools and multi-branch institutions.",
    features: [
      "Unlimited students",
      "All modules included",
      "Multi-branch support",
      "Custom domain + SSL",
      "Advanced analytics",
      "API access",
      "Dedicated onboarding manager",
      "24/7 priority support",
    ],
    cta: "Start Pro",
    href: "/register?plan=pro",
    highlight: false,
  },
];

const marqueeItems = [
  "Admissions", "Attendance", "Exams", "Fees", "Payroll",
  "Transport", "Library", "LMS", "Notices", "Events", "Analytics", "Website Builder",
  "HR", "Biometric", "Hostel", "Canteen", "SMS", "EMIS", "Reports", "Mobile Apps",
];

export default function Home() {
  return (
    <div className={`${sora.variable} ${space.variable}`} style={{ fontFamily: "var(--font-space)" }}>
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
        * { scroll-behavior: smooth; }
        .rise { animation: rise 0.8s ease-out both; }
        .marquee-track { animation: marquee 28s linear infinite; }
        .pulse-glow { box-shadow: 0 24px 80px rgba(14,59,46,0.15); }
        .float { animation: float 6s ease-in-out infinite; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(14,59,46,0.12); }
        .feature-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .stat-pill { background: #0e3b2e; }
        @keyframes rise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
      `}</style>

      <div className="min-h-screen bg-[color:var(--fog)] text-[color:var(--ink)]">

        {/* ── NAVBAR ── */}
        <header className="sticky top-0 z-30 border-b border-black/8 bg-[color:var(--fog)]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--ocean)] text-xs font-bold text-white shadow-sm">
                AS
              </div>
              <div>
                <p className="text-sm font-bold leading-none" style={{ fontFamily: "var(--font-sora)" }}>ASchool</p>
                <p className="text-[10px] text-[color:var(--muted)] mt-0.5">School OS for Nepal</p>
              </div>
            </div>
            <nav className="hidden items-center gap-5 text-sm font-medium text-[color:var(--muted)] md:flex">
              <a href="#features" className="hover:text-[color:var(--ocean)] transition-colors">Features</a>
              <a href="#institutions" className="hover:text-[color:var(--ocean)] transition-colors">Solutions</a>
              <a href="#pricing" className="hover:text-[color:var(--ocean)] transition-colors">Pricing</a>
              <a href="#contact" className="hover:text-[color:var(--ocean)] transition-colors">Contact</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-black/15 px-4 py-2 text-xs font-semibold text-[color:var(--ink)] hover:border-[color:var(--ocean)] hover:text-[color:var(--ocean)] transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-[color:var(--ocean)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[color:var(--ocean-light)] transition-colors"
              >
                Book Demo
              </Link>
            </div>
          </div>
        </header>

        <main>

          {/* ── HERO ── */}
          <section className="relative overflow-hidden bg-[color:var(--ocean)]">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[color:var(--mint)] blur-3xl -translate-y-1/2 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[color:var(--sun)] blur-3xl translate-y-1/2 -translate-x-1/3" />
            </div>
            <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-20">
              <div className="grid md:grid-cols-[1fr_0.85fr] gap-14 items-center">
                <div className="space-y-6 text-white">
                  <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--sun)]" />
                    Nepal&apos;s Trusted School Management Software
                  </span>
                  <h1 className="text-4xl font-bold leading-[1.15] md:text-5xl lg:text-[3.25rem]" style={{ fontFamily: "var(--font-sora)" }}>
                    Nepal&apos;s Most Reliable<br />
                    <span className="text-[color:var(--mint)]">School Management</span><br />
                    Platform
                  </h1>
                  <p className="text-base text-white/75 max-w-lg leading-relaxed">
                    10+ years of experience with 400+ institutions — the complete EdTech solution for Nepali schools, colleges and universities.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-2 rounded-full bg-[color:var(--sun)] px-6 py-3 text-sm font-bold text-[color:var(--ink)] shadow-lg hover:brightness-105 transition-all"
                    >
                      Book Free Demo
                      <ChevronRight size={14} />
                    </Link>
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-sm"
                    >
                      View Dashboard
                    </Link>
                    <a
                      href="/downloads/aschool-user.apk"
                      download
                      className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-sm"
                    >
                      <Smartphone size={14} /> Download App (Android)
                    </a>
                  </div>

                  {/* App downloads */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-white/70">
                    <span className="text-white/50">Mobile apps:</span>
                    <a href="/downloads/aschool-user.apk" download className="underline hover:text-white">All-in-One (Admin · Teacher · Parent · Student)</a>
                    <span className="text-white/30">|</span>
                    <a href="/downloads/aschool-admin.apk" download className="underline hover:text-white">Admin App</a>
                    <span className="text-white/30">|</span>
                    <a href="https://app.brighternepal.com" className="underline hover:text-white">Web App</a>
                  </div>

                  {/* Trust stats row */}
                  <div className="flex flex-wrap gap-6 pt-2">
                    {trustStats.map((s) => (
                      <div key={s.label}>
                        <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-sora)" }}>{s.value}</p>
                        <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hero card / dashboard preview */}
                <div className="relative rise">
                  <div className="rounded-3xl bg-white p-5 pulse-glow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[10px] text-[color:var(--muted)] uppercase tracking-wide">ASchool Dashboard</p>
                        <p className="text-base font-bold text-[color:var(--ink)]">Live School Overview</p>
                      </div>
                      <span className="rounded-full bg-[color:var(--mint)] px-3 py-1 text-[10px] font-bold text-[color:var(--ocean)] uppercase tracking-wide">Live</span>
                    </div>
                    <div className="grid gap-3">
                      {[
                        { label: "Today's Attendance", value: "96%", delta: "▲ 2% vs last week", color: "bg-green-50" },
                        { label: "Fees Collected", value: "NPR 2.8M", delta: "72% of quarter goal", color: "bg-blue-50" },
                        { label: "Open Admissions", value: "148", delta: "12 new inquiries today", color: "bg-amber-50" },
                      ].map((item) => (
                        <div key={item.label} className={`rounded-2xl ${item.color} px-4 py-3 flex items-center justify-between`}>
                          <div>
                            <p className="text-[10px] text-[color:var(--muted)] uppercase tracking-wide">{item.label}</p>
                            <p className="text-lg font-bold text-[color:var(--ink)]">{item.value}</p>
                          </div>
                          <p className="text-[10px] text-[color:var(--muted)] text-right max-w-[100px]">{item.delta}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="rounded-2xl border border-black/8 p-3 float">
                        <p className="text-[10px] text-[color:var(--muted)]">School Website</p>
                        <p className="text-xs font-semibold mt-0.5 text-[color:var(--ink)]">{"your-school." + SCHOOL_SITE_DOMAIN}</p>
                        <p className="text-[10px] text-green-600 mt-0.5">✓ Live</p>
                      </div>
                      <div className="rounded-2xl border border-black/8 p-3 float" style={{ animationDelay: "1s" }}>
                        <p className="text-[10px] text-[color:var(--muted)]">Parent App</p>
                        <p className="text-xs font-semibold mt-0.5 text-[color:var(--ink)]">Real-time notices</p>
                        <p className="text-[10px] text-[color:var(--muted)] mt-0.5">Android + iOS</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trusted by bar */}
              <div className="mt-12 border-t border-white/15 pt-6">
                <p className="text-center text-xs text-white/50 uppercase tracking-[0.2em] mb-4">Trusted by Nepal&apos;s Best Institutions</p>
                <div className="flex flex-wrap justify-center gap-6 text-sm font-semibold text-white/60">
                  {["Kathmandu Model School", "Xavier International", "Budhanilkantha School", "Lalitpur Secondary", "Capital College", "Trinity International"].map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── MARQUEE STRIP ── */}
          <div className="bg-[color:var(--ocean-light)] overflow-hidden py-3">
            <div className="marquee-track flex gap-0 whitespace-nowrap">
              {[...marqueeItems, ...marqueeItems].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 px-6 text-xs font-bold uppercase tracking-[0.25em] text-white/70">
                  {item}
                  <span className="w-1 h-1 rounded-full bg-[color:var(--sun)]" />
                </span>
              ))}
            </div>
          </div>

          {/* ── FEATURES GRID ── */}
          <section id="features" className="mx-auto max-w-6xl px-5 py-20">
            <div className="text-center mb-12">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--ocean)]">Complete Platform</span>
              <h2 className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
                All School Management Features
              </h2>
              <p className="mt-3 text-sm text-[color:var(--muted)] max-w-xl mx-auto">
                From student admission to result publishing — manage everything in one place.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {features.map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  className="feature-card rounded-2xl border border-black/8 bg-white p-5 rise"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--ocean)]/8 text-[color:var(--ocean)]">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-[color:var(--ink)]">{title}</h3>
                  <p className="mt-1 text-xs text-[color:var(--muted)] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── APPS SHOWCASE ── */}
          <section id="mobile-apps" className="bg-white border-y border-black/8">
            <div className="mx-auto max-w-6xl px-5 py-16">
              <div className="grid md:grid-cols-[1fr_1fr] gap-12 items-center">
                <div className="space-y-5">
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--ocean)]">Mobile Apps</span>
                  <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
                    3 Dedicated Apps.<br />One Connected System.
                  </h2>
                  <p className="text-sm text-[color:var(--muted)] leading-relaxed">
                    Separate apps for Students, Parents, and Teachers — each designed for their specific needs and available on Android & iOS.
                  </p>
                  <div className="grid gap-3">
                    {[
                      { app: "Parent App", desc: "Track attendance, fees, notices & bus location in real time.", color: "bg-blue-50 border-blue-100" },
                      { app: "Student App", desc: "Access homework, results, timetable and e-library anytime.", color: "bg-green-50 border-green-100" },
                      { app: "Teacher App", desc: "Mark attendance, upload marks, and communicate with parents.", color: "bg-amber-50 border-amber-100" },
                    ].map(({ app, desc, color }) => (
                      <div key={app} className={`flex items-start gap-4 rounded-2xl border ${color} px-4 py-3`}>
                        <Smartphone size={18} className="text-[color:var(--ocean)] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-[color:var(--ink)]">{app}</p>
                          <p className="text-xs text-[color:var(--muted)] mt-0.5">{desc}</p>
                        </div>
                        <CheckCircle2 size={14} className="text-[color:var(--ocean)] mt-1 shrink-0 ml-auto" />
                      </div>
                    ))}
                  </div>
                  <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ocean)] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[color:var(--ocean-light)] transition-colors">
                    Get Free Demo
                    <ChevronRight size={14} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "School Website", sub: "Custom domain support", icon: Globe },
                    { label: "Biometric Device", sub: "ZKTeco fingerprint", icon: Fingerprint },
                    { label: "EMIS Reports", sub: "Govt-compliant exports", icon: BarChart3 },
                    { label: "Data Security", sub: "ISO 27001 certified", icon: ShieldCheck },
                  ].map(({ label, sub, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-black/8 bg-[color:var(--fog)] p-5 text-center feature-card">
                      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--ocean)] text-white">
                        <Icon size={22} />
                      </div>
                      <p className="text-sm font-bold text-[color:var(--ink)]">{label}</p>
                      <p className="text-xs text-[color:var(--muted)] mt-1">{sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── INSTITUTION TYPES ── */}
          <section id="institutions" className="mx-auto max-w-6xl px-5 py-20">
            <div className="text-center mb-12">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--ocean)]">Solutions</span>
              <h2 className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
                Built for Every Institution
              </h2>
              <p className="mt-3 text-sm text-[color:var(--muted)] max-w-xl mx-auto">
                From primary schools to universities — ASchool adapts to your institution&apos;s needs.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {institutionTypes.map(({ icon: Icon, title, subtitle, desc, items }, i) => (
                <div
                  key={title}
                  className="feature-card rounded-3xl border border-black/8 bg-white p-6 rise flex flex-col"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--ocean)] text-white">
                    <Icon size={22} />
                  </div>
                  <h3 className="text-base font-bold text-[color:var(--ink)]">{title}</h3>
                  <p className="text-xs text-[color:var(--ocean)] font-semibold mt-0.5">{subtitle}</p>
                  <p className="mt-2 text-xs text-[color:var(--muted)] leading-relaxed">{desc}</p>
                  <ul className="mt-4 space-y-1.5 flex-1">
                    {items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                        <span className="w-1 h-1 rounded-full bg-[color:var(--ocean)] shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-5 flex items-center gap-1 text-xs font-bold text-[color:var(--ocean)] hover:underline">
                    Get Started <ChevronRight size={12} />
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* ── PRICING ── */}
          <section id="pricing" className="bg-[color:var(--fog)] border-y border-black/8">
            <div className="mx-auto max-w-6xl px-5 py-20">
              <div className="text-center mb-12">
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--ocean)]">Pricing</span>
                <h2 className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
                  Simple, Transparent Plans
                </h2>
                <p className="mt-3 text-sm text-[color:var(--muted)] max-w-xl mx-auto">
                  Start free and scale as you grow. Every plan includes a school website, mobile apps, and core modules.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {pricingPlans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`rounded-3xl border flex flex-col gap-5 relative overflow-hidden ${
                      plan.highlight
                        ? "border-[color:var(--ocean)] bg-[color:var(--ocean)] text-white shadow-2xl shadow-green-900/25"
                        : "border-black/10 bg-white"
                    }`}
                  >
                    {plan.highlight && (
                      <div className="absolute top-0 inset-x-0 h-1 bg-[color:var(--sun)]" />
                    )}
                    <div className="p-7 flex flex-col gap-5 flex-1">
                      {plan.badge && (
                        <span className="self-start bg-[color:var(--sun)] text-[color:var(--ink)] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                          {plan.badge}
                        </span>
                      )}
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${plan.highlight ? "text-white/50" : "text-[color:var(--muted)]"}`}>
                          {plan.name}
                        </p>
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>{plan.price}</span>
                          <span className={`text-sm pb-1 ${plan.highlight ? "text-white/50" : "text-[color:var(--muted)]"}`}>/{plan.period}</span>
                        </div>
                        <p className={`text-sm mt-2 ${plan.highlight ? "text-white/70" : "text-[color:var(--muted)]"}`}>{plan.description}</p>
                      </div>
                      <ul className="flex-1 space-y-2.5">
                        {plan.features.map((f) => (
                          <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? "text-white/90" : "text-[color:var(--ink)]"}`}>
                            <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${plan.highlight ? "text-[color:var(--mint)]" : "text-[color:var(--ocean)]"}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={plan.href}
                        className={`rounded-full py-3 text-sm font-bold text-center transition-all ${
                          plan.highlight
                            ? "bg-white text-[color:var(--ocean)] hover:bg-white/90"
                            : "bg-[color:var(--ocean)] text-white hover:bg-[color:var(--ocean-light)]"
                        }`}
                      >
                        {plan.cta}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-[color:var(--muted)] mt-6">
                All plans include a 14-day free trial · No credit card required · Cancel anytime
              </p>
            </div>
          </section>

          {/* ── CONTACT / DEMO FORM ── */}
          <section id="contact" className="bg-white border-b border-black/8">
            <div className="mx-auto max-w-6xl px-5 py-20">
              <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--ocean)]">Get Started</span>
                  <h2 className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
                    Book a Free Demo
                  </h2>
                  <p className="mt-3 text-sm text-[color:var(--muted)] leading-relaxed max-w-md">
                    Contact us today and our team will present the best solution for your school or college.
                  </p>
                  <form className="mt-8 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">School / College Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Green Valley School"
                          className="w-full rounded-xl border border-black/15 bg-[color:var(--fog)] px-4 py-2.5 text-sm placeholder:text-black/30 focus:outline-none focus:border-[color:var(--ocean)] focus:ring-2 focus:ring-[color:var(--ocean)]/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">Contact Person *</label>
                        <input
                          type="text"
                          placeholder="Your full name"
                          className="w-full rounded-xl border border-black/15 bg-[color:var(--fog)] px-4 py-2.5 text-sm placeholder:text-black/30 focus:outline-none focus:border-[color:var(--ocean)] focus:ring-2 focus:ring-[color:var(--ocean)]/10"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">Phone Number *</label>
                        <input
                          type="tel"
                          placeholder="98XXXXXXXX"
                          className="w-full rounded-xl border border-black/15 bg-[color:var(--fog)] px-4 py-2.5 text-sm placeholder:text-black/30 focus:outline-none focus:border-[color:var(--ocean)] focus:ring-2 focus:ring-[color:var(--ocean)]/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">District / Location</label>
                        <input
                          type="text"
                          placeholder="e.g. Kathmandu"
                          className="w-full rounded-xl border border-black/15 bg-[color:var(--fog)] px-4 py-2.5 text-sm placeholder:text-black/30 focus:outline-none focus:border-[color:var(--ocean)] focus:ring-2 focus:ring-[color:var(--ocean)]/10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">Message</label>
                      <textarea
                        rows={3}
                        placeholder="Tell us about your school and requirements..."
                        className="w-full rounded-xl border border-black/15 bg-[color:var(--fog)] px-4 py-2.5 text-sm placeholder:text-black/30 focus:outline-none focus:border-[color:var(--ocean)] focus:ring-2 focus:ring-[color:var(--ocean)]/10 resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-full bg-[color:var(--ocean)] py-3 text-sm font-bold text-white shadow-sm hover:bg-[color:var(--ocean-light)] transition-colors"
                    >
                      Send Inquiry →
                    </button>
                  </form>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl bg-[color:var(--ocean)] p-6 text-white">
                    <div className="flex items-center gap-3 mb-4">
                      <Award size={20} className="text-[color:var(--sun)]" />
                      <p className="font-bold text-sm">Our Commitment</p>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed mb-5">
                      We respond to every inquiry within 24 hours and provide a dedicated onboarding manager for setup.
                    </p>
                    <div className="grid gap-3">
                      {[
                        { label: "24-Hour Response", desc: "Guaranteed reply within 1 business day" },
                        { label: "Free Setup Support", desc: "We help migrate and configure your data" },
                        { label: "Training Included", desc: "Staff training sessions at no extra cost" },
                      ].map(({ label, desc }) => (
                        <div key={label} className="flex items-start gap-3">
                          <CheckCircle2 size={14} className="text-[color:var(--mint)] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold">{label}</p>
                            <p className="text-xs text-white/60">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/8 bg-[color:var(--fog)] p-6 space-y-4">
                    {[
                      { icon: Phone, label: "Call Us", value: "01-XXXXXXX / 98XXXXXXXX" },
                      { icon: MessageCircle, label: "WhatsApp", value: "98XXXXXXXX" },
                      { icon: Mail, label: "Email", value: "info@brighternepal.com" },
                      { icon: MapPin, label: "Office", value: "Kathmandu, Nepal" },
                      { icon: Clock, label: "Hours", value: "Sun–Fri: 9AM – 5PM" },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-[color:var(--ocean)]/8 flex items-center justify-center text-[color:var(--ocean)] shrink-0">
                          <Icon size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
                          <p className="text-xs font-semibold text-[color:var(--ink)]">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── FINAL CTA BANNER ── */}
          <section className="bg-[color:var(--ocean)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-14 text-white md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-sora)" }}>
                  Ready to transform your school?
                </h2>
                <p className="text-sm text-white/70 mt-1">Join 400+ institutions already running on ASchool.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className="rounded-full bg-[color:var(--sun)] px-6 py-3 text-sm font-bold text-[color:var(--ink)] hover:brightness-105 transition-all">
                  Book Free Demo
                </Link>
                <Link href="/login" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all">
                  Admin Login
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* ── FOOTER ── */}
        <footer className="bg-[color:var(--ink)] text-white">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[color:var(--ocean)] grid place-items-center text-xs font-bold">AS</div>
                  <div>
                    <p className="font-bold text-sm" style={{ fontFamily: "var(--font-sora)" }}>ASchool</p>
                    <p className="text-[10px] text-white/40">School OS for Nepal</p>
                  </div>
                </div>
                <p className="text-xs text-white/50 leading-relaxed max-w-xs">
                  Nepal&apos;s comprehensive school management platform connecting academics, finance, and communication.
                </p>
                <div className="flex gap-3 pt-1">
                  {["ISO 27001", "IRD Verified"].map((badge) => (
                    <span key={badge} className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-semibold text-white/60">{badge}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Platform</p>
                <ul className="space-y-2">
                  {([
                    { label: "Features", href: "#features" },
                    { label: "Pricing", href: "#pricing" },
                    { label: "Mobile Apps", href: "#mobile-apps" },
                    { label: "School Website", href: "#features" },
                    { label: "EMIS Reports", href: "#features" },
                  ] as const).map(({ label, href }) => (
                    <li key={label}><a href={href} className="text-xs text-white/60 hover:text-white transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Solutions</p>
                <ul className="space-y-2">
                  {["Schools", "Colleges", "Multi-Branch", "Transport", "With Biometric"].map((link) => (
                    <li key={link}><a href="#institutions" className="text-xs text-white/60 hover:text-white transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-10 border-t border-white/10 pt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-white/40">© 2026 ASchool. All rights reserved. Made with ❤️ in Nepal</p>
              <div className="flex gap-4">
                <a href="#contact" className="text-xs text-white/40 hover:text-white/70 transition-colors">Support</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}