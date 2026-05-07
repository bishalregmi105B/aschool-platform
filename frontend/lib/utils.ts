import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "NPR"): string {
  return new Intl.NumberFormat("ne-NP", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNepaliDate(bsDate: string): string {
  // BS date string format: "2081-03-15"
  const months = [
    "बैशाख", "जेठ", "असार", "श्रावण", "भदौ", "आश्विन",
    "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुन", "चैत्र",
  ];
  const parts = bsDate.split("-");
  if (parts.length !== 3) return bsDate;
  const [year, month, day] = parts;
  const monthIdx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${months[monthIdx] || month}, ${year}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
