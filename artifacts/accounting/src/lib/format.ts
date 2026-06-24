export function formatMoney(n: number): string {
  return n.toLocaleString("ar-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDmy(s: string | null | undefined): string {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  manager: "المدير",
  clients: "إدارة العملاء",
  invoices: "الفواتير",
  expenses: "المصروفات",
  reports: "التقارير",
};

export const STATUS_COLORS: Record<string, string> = {
  مدفوعة: "#10b981",
  معلقة: "#f59e0b",
};

export const CATEGORY_COLORS: Record<string, string> = {
  رواتب: "#10b981",
  "ايجار مكتب": "#f59e0b",
  كهرباء: "#fbbf24",
  انترنت: "#06b6d4",
  "مصاريف تشغيلية": "#3b82f6",
};

export const PRIORITY_LABELS: Record<string, string> = {
  normal: "عادي",
  urgent: "عاجل",
  info: "معلومة",
};

export const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function monthLabel(year: number, month0: number): string {
  return `${ARABIC_MONTHS[month0]} ${year}`;
}
