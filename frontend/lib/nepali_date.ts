export const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

// Simple helper to format Nepali dates
export function formatNepaliDate(bsDateStr: string | null | undefined): string {
  if (!bsDateStr) return "N/A";
  
  // Example format: 2082-01-15
  const parts = bsDateStr.split("-");
  if (parts.length !== 3) return bsDateStr;

  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (monthIdx >= 0 && monthIdx < 12) {
    return `${day} ${BS_MONTHS[monthIdx]} ${year}`;
  }
  
  return bsDateStr;
}
