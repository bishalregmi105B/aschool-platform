/**
 * Nepali Utilities — date conversion, number formatting, etc.
 */

// ── Nepali Digits ────────────────────────────────────────

const NEPALI_DIGITS = "०१२३४५६७८९";
const ARABIC_DIGITS = "0123456789";

export function toNepaliDigits(num: number | string): string {
  return String(num).replace(/[0-9]/g, (d) => NEPALI_DIGITS[parseInt(d)]);
}

export function toArabicDigits(str: string): string {
  return str.replace(/[०-९]/g, (d) => String(NEPALI_DIGITS.indexOf(d)));
}

// ── Nepali Currency ──────────────────────────────────────

export function formatNepaliCurrency(amount: number, useNepaliDigits = false): string {
  const integer = Math.floor(amount);
  const decimal = Math.round((amount - integer) * 100);

  // Nepali grouping: last 3 digits, then groups of 2
  let s = String(integer);
  let formatted = "";
  if (s.length > 3) {
    formatted = s.slice(-3);
    s = s.slice(0, -3);
    while (s.length > 0) {
      formatted = s.slice(-2) + "," + formatted;
      s = s.slice(0, -2);
    }
  } else {
    formatted = s;
  }

  const result = decimal > 0 ? `रू ${formatted}.${String(decimal).padStart(2, "0")}` : `रू ${formatted}`;
  return useNepaliDigits ? toNepaliDigits(result) : result;
}

// ── Nepali Month Names ───────────────────────────────────

export const NEPALI_MONTHS = [
  "बैशाख", "जेठ", "असार", "श्रावण", "भदौ", "असोज",
  "कार्तिक", "मंसिर", "पुष", "माघ", "फाल्गुन", "चैत",
];

export const NEPALI_MONTHS_EN = [
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Ashoj",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

export const NEPALI_DAYS = [
  "आइतबार", "सोमबार", "मंगलबार", "बुधबार",
  "बिहीबार", "शुक्रबार", "शनिबार",
];

export const NEPALI_DAYS_SHORT = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];

// ── Nepali Labels ────────────────────────────────────────

const NE_LABELS: Record<string, string> = {
  dashboard: "ड्यासबोर्ड",
  students: "विद्यार्थीहरू",
  teachers: "शिक्षकहरू",
  attendance: "उपस्थिति",
  exams: "परीक्षा",
  fees: "शुल्क",
  library: "पुस्तकालय",
  notices: "सूचनाहरू",
  reports: "प्रतिवेदन",
  settings: "सेटिङहरू",
  present: "उपस्थित",
  absent: "अनुपस्थित",
  late: "ढिलो",
  pass: "उत्तीर्ण",
  fail: "अनुत्तीर्ण",
  save: "सेभ गर्नुहोस्",
  cancel: "रद्द",
  search: "खोज्नुहोस्",
  add: "थप्नुहोस्",
  edit: "सम्पादन",
  delete: "मेटाउनुहोस्",
  loading: "लोड हुँदैछ...",
  no_data: "कुनै डाटा छैन",
};

export function t(key: string, lang: "en" | "ne" = "ne"): string {
  if (lang === "ne") return NE_LABELS[key] || key;
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Relative Time (Nepali) ───────────────────────────────

export function timeAgoNepali(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return "भर्खरै";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} मिनेट अघि`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} घण्टा अघि`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} दिन अघि`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} महिना अघि`;
  return `${Math.floor(seconds / 31536000)} वर्ष अघि`;
}
