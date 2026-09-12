import React from "react";

// AOS System Logo: Academic Shield with Open Book & Atomic Knowledge Orbit
export function AOSLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="aos-shield-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0078D4" />
          <stop offset="0.5" stopColor="#005A9E" />
          <stop offset="1" stopColor="#003966" />
        </linearGradient>
        <linearGradient id="aos-gold-grad" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD700" />
          <stop offset="1" stopColor="#FF8C00" />
        </linearGradient>
        <filter id="aos-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0078D4" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Shield Base */}
      <path
        d="M24 4L8 10V22C8 32 15 40 24 44C33 40 40 32 40 22V10L24 4Z"
        fill="url(#aos-shield-grad)"
        filter="url(#aos-glow)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
      />
      {/* Atomic Knowledge Orbit */}
      <ellipse cx="24" cy="22" rx="13" ry="5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" transform="rotate(-25 24 22)" />
      <ellipse cx="24" cy="22" rx="13" ry="5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" transform="rotate(25 24 22)" />
      {/* Open Book of Knowledge */}
      <path
        d="M16 26C18.5 24 21.5 24 24 25.5C26.5 24 29.5 24 32 26V18C29.5 16 26.5 16 24 17.5C21.5 16 18.5 16 16 18V26Z"
        fill="#FFFFFF"
      />
      <path
        d="M24 17.5V25.5"
        stroke="#005A9E"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Golden Guiding Star */}
      <polygon
        points="24,8 25.5,12 29.5,12.5 26.5,15 27.5,19 24,17 20.5,19 21.5,15 18.5,12.5 22.5,12"
        fill="url(#aos-gold-grad)"
      />
    </svg>
  );
}

// 1. Live Classroom App Icon
export function AOSClassroomIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cls-grad" x1="4" y1="6" x2="44" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <rect x="6" y="8" width="36" height="26" rx="6" fill="url(#cls-grad)" />
      <path d="M12 14H36V28H12V14Z" fill="#FFFFFF" fillOpacity="0.9" rx="2" />
      {/* Smartboard Teacher & Chart */}
      <path d="M16 24L20 20L24 22L30 17" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30" cy="17" r="1.5" fill="#0284C7" />
      {/* Stand Legs */}
      <path d="M18 34L14 42M30 34L34 42M24 34V42" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// 2. Academics & Gradebook App Icon
export function AOSGradebookIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grd-base" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="grd-gold" x1="16" y1="16" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="1" stopColor="#EAB308" />
        </linearGradient>
      </defs>
      <rect x="8" y="6" width="32" height="36" rx="6" fill="url(#grd-base)" />
      <rect x="12" y="10" width="24" height="28" rx="4" fill="#FFFFFF" fillOpacity="0.95" />
      {/* Assessment Lines */}
      <line x1="16" y1="15" x2="26" y2="15" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="20" x2="30" y2="20" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="25" x2="28" y2="25" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      {/* Gold Honor Medal */}
      <circle cx="28" cy="30" r="6" fill="url(#grd-gold)" />
      <path d="M26 30L27.5 31.5L30.5 28.5" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 3. Attendance & Timetable App Icon
export function AOSTimetableIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="time-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="32" height="32" rx="7" fill="url(#time-grad)" />
      <rect x="8" y="8" width="32" height="10" rx="7" fill="#5B21B6" />
      {/* Clock Face Inside */}
      <circle cx="24" cy="27" r="8" fill="#FFFFFF" />
      <path d="M24 22V27L27 29" stroke="#6D28D9" strokeWidth="2" strokeLinecap="round" />
      {/* Calendar Top Hooks */}
      <rect x="14" y="5" width="3" height="6" rx="1.5" fill="#DDD6FE" />
      <rect x="31" y="5" width="3" height="6" rx="1.5" fill="#DDD6FE" />
    </svg>
  );
}

// 4. Digital Vault & Library Icon
export function AOSLibraryIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lib-grad1" x1="8" y1="8" x2="20" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="lib-grad2" x1="18" y1="8" x2="30" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="lib-grad3" x1="28" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC4899" />
          <stop offset="1" stopColor="#BE185D" />
        </linearGradient>
      </defs>
      {/* Book 1 */}
      <rect x="10" y="12" width="7" height="28" rx="2" fill="url(#lib-grad1)" />
      <line x1="10" y1="16" x2="17" y2="16" stroke="#FEF3C7" strokeWidth="1.5" />
      {/* Book 2 */}
      <rect x="19" y="8" width="8" height="32" rx="2" fill="url(#lib-grad2)" />
      <line x1="19" y1="14" x2="27" y2="14" stroke="#DBEAFE" strokeWidth="1.5" />
      <line x1="19" y1="34" x2="27" y2="34" stroke="#DBEAFE" strokeWidth="1.5" />
      {/* Book 3 (Leaning) */}
      <rect x="30" y="10" width="7" height="30" rx="2" fill="url(#lib-grad3)" transform="rotate(10 30 10)" />
      {/* Shelf Line */}
      <rect x="6" y="40" width="36" height="3" rx="1.5" fill="#64748B" />
    </svg>
  );
}

// 5. Exam & Assessment Center Icon
export function AOSExamIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="exm-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444" />
          <stop offset="1" stopColor="#B91C1C" />
        </linearGradient>
      </defs>
      <rect x="10" y="8" width="28" height="34" rx="5" fill="url(#exm-grad)" />
      <rect x="14" y="12" width="20" height="26" rx="3" fill="#FFFFFF" />
      {/* Exam Checkmarks */}
      <path d="M17 18L19 20L23 16" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="25" y1="18" x2="31" y2="18" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 24L19 26L23 22" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="25" y1="24" x2="31" y2="24" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 30L19 32L23 28" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="25" y1="30" x2="31" y2="30" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      {/* Top Clip */}
      <rect x="19" y="5" width="10" height="5" rx="2" fill="#64748B" />
    </svg>
  );
}

// 6. Campus & Transit Tracker Icon
export function AOSCampusIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cmp-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      {/* Yellow School Bus Front */}
      <rect x="10" y="10" width="28" height="26" rx="6" fill="url(#cmp-grad)" />
      {/* Windshield */}
      <rect x="13" y="14" width="22" height="10" rx="3" fill="#1E293B" />
      {/* Headlights */}
      <circle cx="16" cy="30" r="3" fill="#FEF08A" />
      <circle cx="32" cy="30" r="3" fill="#FEF08A" />
      {/* Bus Grille */}
      <line x1="21" y1="29" x2="27" y2="29" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="32" x2="27" y2="32" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
      {/* Tires */}
      <rect x="12" y="36" width="6" height="4" rx="2" fill="#334155" />
      <rect x="30" y="36" width="6" height="4" rx="2" fill="#334155" />
    </svg>
  );
}

// 7. Student Notebook & Scratchpad Icon
export function AOSNotebookIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ntb-grad" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      <rect x="10" y="6" width="28" height="36" rx="4" fill="url(#ntb-grad)" />
      {/* Spiral Wire Ring Hooks */}
      <circle cx="12" cy="11" r="2" fill="#E2E8F0" />
      <circle cx="12" cy="18" r="2" fill="#E2E8F0" />
      <circle cx="12" cy="25" r="2" fill="#E2E8F0" />
      <circle cx="12" cy="32" r="2" fill="#E2E8F0" />
      <circle cx="12" cy="39" r="2" fill="#E2E8F0" />
      {/* Notebook Cover Bookmark Strip */}
      <rect x="18" y="14" width="16" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.8" />
      <rect x="18" y="20" width="12" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
      <rect x="18" y="26" width="14" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
      {/* Pen Accent */}
      <path d="M32 30L36 26L39 29L35 33L32 34L32 30Z" fill="#F59E0B" />
    </svg>
  );
}

// 8. Science & Math Lab Simulator Icon
export function AOSLabIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lab-fluid" x1="14" y1="20" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A855F7" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      {/* Laboratory Flask Body */}
      <path
        d="M21 8H27V16L37 34C38.5 36.5 36.8 40 33.8 40H14.2C11.2 40 9.5 36.5 11 34L21 16V8Z"
        fill="url(#lab-fluid)"
        stroke="#E2E8F0"
        strokeWidth="2"
      />
      <rect x="19" y="6" width="10" height="3" rx="1.5" fill="#E2E8F0" />
      {/* Liquid Bubbles */}
      <circle cx="20" cy="32" r="2" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="28" cy="30" r="3" fill="#FFFFFF" fillOpacity="0.8" />
      <circle cx="25" cy="24" r="1.5" fill="#FFFFFF" fillOpacity="0.6" />
      {/* Measuring Lines */}
      <line x1="20" y1="22" x2="23" y2="22" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="27" x2="22" y2="27" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="32" x2="21" y2="32" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 9. CS Lab Terminal & Code Studio Icon
export function AOSTerminalIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trm-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="1" stopColor="#1E293B" />
        </linearGradient>
      </defs>
      <rect x="6" y="8" width="36" height="32" rx="6" fill="url(#trm-grad)" stroke="#38BDF8" strokeWidth="1.5" />
      <rect x="6" y="8" width="36" height="8" rx="6" fill="#1E293B" />
      {/* Console dots */}
      <circle cx="11" cy="12" r="1.5" fill="#EF4444" />
      <circle cx="16" cy="12" r="1.5" fill="#F59E0B" />
      <circle cx="21" cy="12" r="1.5" fill="#10B981" />
      {/* Prompt Command */}
      <path d="M12 24L17 28L12 32" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="32" x2="28" y2="32" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// 10. AOS System Settings Icon
export function AOSSettingsIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="set-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#64748B" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill="url(#set-grad)" />
      {/* Inner Academic Gear Center */}
      <circle cx="24" cy="24" r="8" fill="#FFFFFF" />
      <circle cx="24" cy="24" r="4" fill="#0284C7" />
      {/* Teeth */}
      <rect x="22" y="3" width="4" height="6" rx="2" fill="#475569" />
      <rect x="22" y="39" width="4" height="6" rx="2" fill="#475569" />
      <rect x="3" y="22" width="6" height="4" rx="2" fill="#475569" />
      <rect x="39" y="22" width="6" height="4" rx="2" fill="#475569" />
    </svg>
  );
}

// 11. School File Manager & Cloud Vault Icon
export function AOSFileManagerIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fm-back" x1="4" y1="8" x2="44" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284C7" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="fm-front" x1="6" y1="16" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      {/* Folder Back with Tab */}
      <path d="M6 12C6 9.8 7.8 8 10 8H20L25 13H38C40.2 13 42 14.8 42 17V36C42 38.2 40.2 40 38 40H10C7.8 40 6 38.2 6 36V12Z" fill="url(#fm-back)" />
      {/* Insert Academic Paper Sheet */}
      <rect x="12" y="12" width="24" height="20" rx="3" fill="#FFFFFF" fillOpacity="0.95" />
      <line x1="16" y1="18" x2="26" y2="18" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="23" x2="32" y2="23" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      {/* Folder Front Cover */}
      <path d="M6 20C6 17.8 7.8 16 10 16H38C40.2 16 42 17.8 42 20V36C42 38.2 40.2 40 38 40H10C7.8 40 6 38.2 6 36V20Z" fill="url(#fm-front)" />
    </svg>
  );
}

// 12. School Administrator & Principal Command Center Icon
export function AOSAdminIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="adm-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="adm-gold" x1="18" y1="16" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047" />
          <stop offset="1" stopColor="#EAB308" />
        </linearGradient>
      </defs>
      {/* Administrative Building Pediment */}
      <rect x="8" y="8" width="32" height="32" rx="7" fill="url(#adm-grad)" />
      {/* Pillars */}
      <path d="M14 16L24 10L34 16H14Z" fill="#FFFFFF" />
      <rect x="16" y="18" width="3" height="14" rx="1" fill="#FFFFFF" />
      <rect x="22.5" y="18" width="3" height="14" rx="1" fill="#FFFFFF" />
      <rect x="29" y="18" width="3" height="14" rx="1" fill="#FFFFFF" />
      <rect x="13" y="32" width="22" height="3" rx="1" fill="#FFFFFF" />
      {/* Executive Seal */}
      <circle cx="34" cy="34" r="7" fill="url(#adm-gold)" />
      <path d="M34 30V35M31.5 32.5L36.5 32.5" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 13. Accountant & Bursar Financial Ledger Icon
export function AOSFinanceIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fin-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="32" height="32" rx="7" fill="url(#fin-grad)" />
      {/* Ledger Book */}
      <rect x="13" y="12" width="22" height="24" rx="3" fill="#FFFFFF" />
      <circle cx="24" cy="21" r="5" fill="#10B981" />
      <text x="24" y="24" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold" fontFamily="sans-serif">$</text>
      <line x1="17" y1="29" x2="31" y2="29" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="32" x2="27" y2="32" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
