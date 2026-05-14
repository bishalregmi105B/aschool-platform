"use client";

import { useState } from "react";

interface SchoolNavbarProps {
  slug: string;
  schoolName: string;
  schoolNameNepali?: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
  primaryColor?: string;
  accentColor?: string;
}

const NAV_ITEMS = [
  { label: "Home", path: "" },
  { label: "About", path: "/about" },
  { label: "Academics", path: "/academics" },
  { label: "Teachers", path: "/teachers" },
  { label: "Notices", path: "/notices" },
  { label: "Gallery", path: "/gallery" },
  { label: "Results", path: "/results" },
  { label: "Contact", path: "/contact" },
];

export function SchoolNavbar({
  slug,
  schoolName,
  schoolNameNepali,
  logo,
  phone,
  email,
  address,
  primaryColor = "var(--color-primary)",
  accentColor = "var(--color-accent)",
}: SchoolNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/school/${slug}`;

  return (
    <>
      {/* Top Info Bar */}
      {(address || phone || email) && (
        <div className="hidden md:block text-xs text-white/80 py-2 px-4" style={{ backgroundColor: "var(--color-primary-dark, #0a1f14)" }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {address && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                  {address}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-1 hover:text-white">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-1 hover:text-white">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                  {email}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo + School Name */}
          <a href={base} className="flex items-center gap-3 min-w-0">
            {logo ? (
              <img src={logo} alt={schoolName} className="h-12 w-12 rounded-full object-cover border-2 border-white/30 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center font-bold text-xl text-white flex-shrink-0">
                {schoolName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-white font-bold text-lg leading-tight truncate" style={{ fontFamily: "var(--font-heading)" }}>
                {schoolName}
              </h1>
              {schoolNameNepali && (
                <p className="text-white/70 text-xs truncate">{schoolNameNepali}</p>
              )}
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.path}
                href={`${base}${item.path}`}
                className="text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium transition-all"
              >
                {item.label}
              </a>
            ))}
            <a
              href={`${base}/admission`}
              className="ml-2 px-4 py-2 rounded-lg text-sm font-bold text-white border-2 border-white hover:bg-white transition-all"
              style={{ color: "inherit" }}
            >
              <span className="hover:text-inherit" style={{ mixBlendMode: "difference" }}>Register Now</span>
            </a>
          </nav>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden text-white p-2 rounded-md hover:bg-white/10 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Drawer */}
        {menuOpen && (
          <div className="lg:hidden border-t border-white/20" style={{ backgroundColor: primaryColor }}>
            <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.path}
                  href={`${base}${item.path}`}
                  className="text-white/90 hover:bg-white/10 px-3 py-2.5 rounded-md text-sm font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href={`${base}/admission`}
                className="mt-2 px-4 py-2.5 rounded-lg text-sm font-bold text-center"
                style={{ backgroundColor: accentColor, color: "#fff" }}
                onClick={() => setMenuOpen(false)}
              >
                Register Now
              </a>
              {(phone || email) && (
                <div className="mt-3 pt-3 border-t border-white/20 flex flex-col gap-2 text-xs text-white/70">
                  {phone && <a href={`tel:${phone}`} className="flex items-center gap-2">📞 {phone}</a>}
                  {email && <a href={`mailto:${email}`} className="flex items-center gap-2">✉️ {email}</a>}
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
