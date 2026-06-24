import ExcelJS from "exceljs";

export const CLIENT_HEADERS: Array<{
  key: string;
  label: string;
  type?: "text" | "date";
  width?: number;
}> = [
  { key: "name", label: "الاسم", type: "text", width: 28 },
  { key: "taxNumber", label: "رقم التسجيل الضريبي", type: "text", width: 22 },
  { key: "entityType", label: "نوع المنشأة", type: "text", width: 16 },
  { key: "vatStatus", label: "ق.م", type: "text", width: 14 },
  { key: "username", label: "اسم المستخدم", type: "text", width: 20 },
  { key: "password", label: "كلمة السر", type: "text", width: 20 },
  { key: "email", label: "الإيميل", type: "text", width: 28 },
  { key: "phone", label: "رقم التليفون", type: "text", width: 18 },
  { key: "nationalId", label: "الرقم القومي", type: "text", width: 22 },
  { key: "eInvoiceEmail", label: "إيميل الفاتورة الإلكترونية", type: "text", width: 28 },
  { key: "eInvoicePassword", label: "كلمة سر الفاتورة الإلكترونية", type: "text", width: 24 },
  { key: "registrationDate", label: "تاريخ التسجيل", type: "date", width: 18 },
  { key: "taxCardExpiry", label: "تاريخ انتهاء البطاقة الضريبية", type: "date", width: 22 },
  { key: "taxPortalExpiry", label: "تاريخ انتهاء اشتراك موقع الضرائب", type: "date", width: 24 },
  { key: "tokenExpiry", label: "تاريخ انتهاء التوكن", type: "date", width: 20 },
  { key: "appealCommitteeDate", label: "تاريخ لجان الطعن", type: "date", width: 20 },
  { key: "notes", label: "ملاحظات", type: "text", width: 32 },
];

const ENTITY_OPTIONS = ["فردي", "شركة"];
const VAT_OPTIONS = ["نعم", "لا", "ربع سنوي"];
const VALID_ENTITY = new Set(ENTITY_OPTIONS);
const VALID_VAT = new Set(VAT_OPTIONS);

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E78" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 12,
  color: { argb: "FFFFFFFF" },
  name: "Calibri",
};

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB7C9D9" } },
  left: { style: "thin", color: { argb: "FFB7C9D9" } },
  right: { style: "thin", color: { argb: "FFB7C9D9" } },
  bottom: { style: "thin", color: { argb: "FFB7C9D9" } },
};

const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F6FB" },
};

const SAMPLE_ROW: Record<string, any> = {
  name: "اسم العميل",
  taxNumber: "123-456-789",
  entityType: "فردي",
  vatStatus: "نعم",
  username: "username",
  password: "password",
  email: "client@mail.com",
  phone: "01000000000",
  nationalId: "29800000000000",
  eInvoiceEmail: "einvoice@mail.com",
  eInvoicePassword: "einvoice-pass",
  registrationDate: new Date(2024, 0, 15),
  taxCardExpiry: new Date(2026, 11, 31),
  taxPortalExpiry: new Date(2026, 11, 31),
  tokenExpiry: new Date(2026, 11, 31),
  appealCommitteeDate: new Date(2026, 11, 31),
  notes: "ملاحظات اختيارية",
};

function buildWorkbook(rows: Array<Record<string, any>>): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "مكتب مصطفى حمزة";
  wb.created = new Date();
  wb.views = [
    {
      x: 0,
      y: 0,
      width: 12000,
      height: 9000,
      firstSheet: 0,
      activeTab: 0,
      visibility: "visible",
      rightToLeft: true,
    } as ExcelJS.WorkbookView,
  ];

  const ws = wb.addWorksheet("العملاء", {
    views: [{ state: "frozen", ySplit: 1, rightToLeft: true }],
    properties: { defaultRowHeight: 22 },
  });

  ws.columns = CLIENT_HEADERS.map((h) => ({
    header: h.label,
    key: h.key,
    width: h.width ?? 20,
    style:
      h.type === "date"
        ? { numFmt: "yyyy-mm-dd", alignment: { horizontal: "center", vertical: "middle" } }
        : { alignment: { horizontal: "right", vertical: "middle", wrapText: true } },
  }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER;
  });

  // Add data rows
  rows.forEach((r) => {
    const rowVals: Record<string, any> = {};
    for (const h of CLIENT_HEADERS) {
      const v = r[h.key];
      if (h.type === "date") {
        rowVals[h.key] = toDateOrEmpty(v);
      } else {
        rowVals[h.key] = v ?? "";
      }
    }
    ws.addRow(rowVals);
  });

  // Apply borders + alternating fill to the body rows we have, plus 200 empty rows for entry
  const totalRows = Math.max(rows.length + 1, 200);
  for (let r = 2; r <= totalRows; r++) {
    const row = ws.getRow(r);
    row.height = 22;
    CLIENT_HEADERS.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      cell.border = BORDER;
      if (r % 2 === 0) cell.fill = ALT_ROW_FILL;
      if (h.type === "date") {
        cell.numFmt = "yyyy-mm-dd";
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
      }
    });
  }

  // Data validations (visible dropdown arrows in Excel)
  const entityCol = colLetter(CLIENT_HEADERS.findIndex((h) => h.key === "entityType") + 1);
  const vatCol = colLetter(CLIENT_HEADERS.findIndex((h) => h.key === "vatStatus") + 1);

  for (let r = 2; r <= totalRows; r++) {
    ws.getCell(`${entityCol}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${ENTITY_OPTIONS.join(",")}"`],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "قيمة غير صالحة",
      error: "يرجى الاختيار من القائمة: فردي أو شركة",
      showInputMessage: true,
      promptTitle: "نوع المنشأة",
      prompt: "اختر من القائمة المنسدلة",
    };
    ws.getCell(`${vatCol}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${VAT_OPTIONS.join(",")}"`],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "قيمة غير صالحة",
      error: "يرجى الاختيار من القائمة: نعم / لا / ربع سنوي",
      showInputMessage: true,
      promptTitle: "حالة ق.م",
      prompt: "اختر من القائمة المنسدلة",
    };
  }

  // Date columns: validation that input is a real date
  CLIENT_HEADERS.forEach((h, idx) => {
    if (h.type !== "date") return;
    const letter = colLetter(idx + 1);
    for (let r = 2; r <= totalRows; r++) {
      ws.getCell(`${letter}${r}`).dataValidation = {
        type: "date",
        operator: "greaterThan",
        allowBlank: true,
        formulae: [new Date(1900, 0, 1)],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "تاريخ غير صالح",
        error: "يرجى إدخال تاريخ صحيح بصيغة YYYY-MM-DD",
        showInputMessage: true,
        promptTitle: h.label,
        prompt: "أدخل التاريخ بصيغة YYYY-MM-DD",
      };
    }
  });

  // AutoFilter on header
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: CLIENT_HEADERS.length },
  };

  return wb;
}

function colLetter(index: number): string {
  let s = "";
  let n = index;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function toDateOrEmpty(v: any): Date | string {
  if (!v) return "";
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return "";
  // Try ISO YYYY-MM-DD
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(d.getTime())) return d;
  }
  // Try DD/MM/YYYY
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d;
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadClientsTemplate(filename = "نموذج_العملاء.xlsx") {
  const wb = buildWorkbook([SAMPLE_ROW]);
  await downloadWorkbook(wb, filename);
}

export async function exportClientsXlsx(
  rows: Array<Record<string, any>>,
  filename = "العملاء.xlsx",
) {
  const wb = buildWorkbook(rows);
  await downloadWorkbook(wb, filename);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function excelSerialToIso(serial: number): string | null {
  // Excel epoch (1900-01-01) with the leap-year bug: day 60 = 1900-02-29 (does not exist)
  if (!isFinite(serial) || serial <= 0) return null;
  const utcDays = Math.floor(serial - 25569); // 25569 = days between 1899-12-30 and 1970-01-01
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function normalizeDateValue(raw: any): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return dateToIso(raw);
  }
  if (typeof raw === "number") {
    return excelSerialToIso(raw);
  }
  // ExcelJS may give rich-text or formula objects
  if (typeof raw === "object") {
    if ("text" in raw) return normalizeDateValue((raw as any).text);
    if ("result" in raw) return normalizeDateValue((raw as any).result);
    if ("richText" in raw) {
      const txt = ((raw as any).richText as Array<{ text: string }>)
        .map((p) => p.text)
        .join("");
      return normalizeDateValue(txt);
    }
  }
  const s = String(raw).trim();
  if (!s) return null;
  // ISO
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(d.getTime())) return dateToIso(d);
  }
  // DD/MM/YYYY
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) return dateToIso(d);
  }
  // Excel serial number as string
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 59 && n < 80000) return excelSerialToIso(n);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return dateToIso(d);
  return null;
}

function normalizeText(raw: any): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number") return String(raw).trim();
  if (typeof raw === "boolean") return raw ? "true" : "false";
  if (raw instanceof Date) return dateToIso(raw);
  if (typeof raw === "object") {
    if ("text" in raw) return normalizeText((raw as any).text);
    if ("result" in raw) return normalizeText((raw as any).result);
    if ("hyperlink" in raw && "text" in raw) return normalizeText((raw as any).text);
    if ("richText" in raw) {
      return ((raw as any).richText as Array<{ text: string }>)
        .map((p) => p.text)
        .join("")
        .trim();
    }
  }
  return String(raw).trim();
}

export async function parseClientsXlsx(file: File): Promise<Array<Record<string, any>>> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  // Map header label → column index by reading the first row
  const headerRow = ws.getRow(1);
  const labelToCol = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const txt = normalizeText(cell.value);
    if (txt) labelToCol.set(txt, colNumber);
  });

  const out: Array<Record<string, any>> = [];
  const lastRow = ws.actualRowCount || ws.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, any> = {};
    for (const h of CLIENT_HEADERS) {
      const colIdx = labelToCol.get(h.label);
      if (!colIdx) continue;
      const raw = row.getCell(colIdx).value;
      if (h.type === "date") {
        const iso = normalizeDateValue(raw);
        if (iso) obj[h.key] = iso;
        continue;
      }
      const v = normalizeText(raw);
      if (!v) continue;
      if (h.key === "entityType" && !VALID_ENTITY.has(v)) continue;
      if (h.key === "vatStatus" && !VALID_VAT.has(v)) continue;
      obj[h.key] = v;
    }
    if (obj.name) out.push(obj);
  }
  return out;
}
