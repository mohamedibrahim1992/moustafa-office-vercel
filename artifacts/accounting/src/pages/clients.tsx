import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useImportClients,
  useCheckClientDuplicates,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import type { User, Client, DuplicateEntry } from "@workspace/api-client-react";
import { useNotify } from "@/lib/notify";
import { extractErrorMessage, getErrorStatus } from "@/lib/api-error";
import { formatDate, formatDmy } from "@/lib/format";
import {
  downloadClientsTemplate,
  exportClientsXlsx,
  parseClientsXlsx,
} from "@/lib/excel";

type FormState = {
  name: string;
  taxNumber: string;
  entityType: "" | "فردي" | "شركة";
  vatStatus: "" | "نعم" | "لا" | "ربع سنوي";
  username: string;
  password: string;
  email: string;
  phone: string;
  nationalId: string;
  eInvoiceEmail: string;
  eInvoicePassword: string;
  registrationDate: string;
  taxCardExpiry: string;
  taxPortalExpiry: string;
  tokenExpiry: string;
  appealCommitteeDate: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  taxNumber: "",
  entityType: "",
  vatStatus: "",
  username: "",
  password: "",
  email: "",
  phone: "",
  nationalId: "",
  eInvoiceEmail: "",
  eInvoicePassword: "",
  registrationDate: "",
  taxCardExpiry: "",
  taxPortalExpiry: "",
  tokenExpiry: "",
  appealCommitteeDate: "",
  notes: "",
};

function clientToForm(c: Client): FormState {
  return {
    name: c.name ?? "",
    taxNumber: c.taxNumber ?? "",
    entityType: (c.entityType as any) ?? "",
    vatStatus: (c.vatStatus as any) ?? "",
    username: c.username ?? "",
    password: c.password ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    nationalId: c.nationalId ?? "",
    eInvoiceEmail: c.eInvoiceEmail ?? "",
    eInvoicePassword: c.eInvoicePassword ?? "",
    registrationDate: c.registrationDate ?? "",
    taxCardExpiry: c.taxCardExpiry ?? "",
    taxPortalExpiry: c.taxPortalExpiry ?? "",
    tokenExpiry: c.tokenExpiry ?? "",
    appealCommitteeDate: c.appealCommitteeDate ?? "",
    notes: c.notes ?? "",
  };
}

function formToPayload(f: FormState) {
  const v = (s: string) => (s.trim() ? s.trim() : null);
  return {
    name: f.name.trim(),
    taxNumber: v(f.taxNumber),
    entityType: f.entityType ? (f.entityType as "فردي" | "شركة") : null,
    vatStatus: f.vatStatus ? (f.vatStatus as "نعم" | "لا" | "ربع سنوي") : null,
    username: v(f.username),
    password: v(f.password),
    email: v(f.email),
    phone: v(f.phone),
    nationalId: v(f.nationalId),
    eInvoiceEmail: v(f.eInvoiceEmail),
    eInvoicePassword: v(f.eInvoicePassword),
    registrationDate: v(f.registrationDate),
    taxCardExpiry: v(f.taxCardExpiry),
    taxPortalExpiry: v(f.taxPortalExpiry),
    tokenExpiry: v(f.tokenExpiry),
    appealCommitteeDate: v(f.appealCommitteeDate),
    notes: v(f.notes),
  };
}

function expiryClass(date: string | null | undefined): string {
  if (!date) return "muted";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "muted";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expiry-past";
  if (days <= 14) return "expiry-near";
  return "";
}

const REMINDER_FIELDS: Array<{
  key: "taxCardExpiry" | "taxPortalExpiry" | "tokenExpiry" | "appealCommitteeDate";
  label: string;
  icon: string;
}> = [
  { key: "taxCardExpiry", label: "البطاقة الضريبية", icon: "🪪" },
  { key: "taxPortalExpiry", label: "اشتراك موقع الضرائب", icon: "🌐" },
  { key: "tokenExpiry", label: "التوكن", icon: "🔑" },
  { key: "appealCommitteeDate", label: "لجان الطعن", icon: "⚖️" },
];

type ReminderRow = {
  clientId: number;
  clientName: string;
  phone: string | null | undefined;
  type: string;
  date: string;
  daysLeft: number;
};

type SortKey =
  | "name"
  | "taxNumber"
  | "entityType"
  | "vatStatus"
  | "username"
  | "email"
  | "phone"
  | "nationalId"
  | "registrationDate"
  | "taxCardExpiry"
  | "taxPortalExpiry"
  | "tokenExpiry"
  | "appealCommitteeDate"
  | "addedByName"
  | "createdAt";

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string; type: "text" | "date" }> = [
  { key: "name", label: "الاسم", type: "text" },
  { key: "taxNumber", label: "الرقم الضريبي", type: "text" },
  { key: "entityType", label: "المنشأة", type: "text" },
  { key: "vatStatus", label: "ق.م", type: "text" },
  { key: "username", label: "اسم المستخدم", type: "text" },
  { key: "email", label: "الإيميل", type: "text" },
  { key: "phone", label: "التليفون", type: "text" },
  { key: "nationalId", label: "الرقم القومي", type: "text" },
  { key: "registrationDate", label: "تاريخ التسجيل", type: "date" },
  { key: "taxCardExpiry", label: "انتهاء البطاقة الضريبية", type: "date" },
  { key: "taxPortalExpiry", label: "انتهاء موقع الضرائب", type: "date" },
  { key: "tokenExpiry", label: "انتهاء التوكن", type: "date" },
  { key: "appealCommitteeDate", label: "لجان الطعن", type: "date" },
  { key: "addedByName", label: "أضافه", type: "text" },
  { key: "createdAt", label: "تاريخ الإضافة", type: "date" },
];

const arabicCollator = new Intl.Collator("ar", { sensitivity: "base", numeric: true });

function compareValues(a: any, b: any, type: "text" | "date"): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // empty values always last
  if (bEmpty) return -1;
  if (type === "date") {
    const ta = new Date(a).getTime();
    const tb = new Date(b).getTime();
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta - tb;
  }
  return arabicCollator.compare(String(a), String(b));
}

function statusFor(days: number): { label: string; cls: string } {
  if (days < 0) return { label: `متأخر ${Math.abs(days)} يوم`, cls: "tag-red" };
  if (days === 0) return { label: "اليوم", cls: "tag-red" };
  if (days <= 7) return { label: `باقي ${days} يوم`, cls: "tag-amber" };
  if (days <= 14) return { label: `باقي ${days} يوم`, cls: "tag-blue" };
  return { label: `باقي ${days} يوم`, cls: "tag-gray" };
}

export default function ClientsPage({ user }: { user: User }) {
  const qc = useQueryClient();
  const notify = useNotify();
  void user;
  const canEdit = true;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients = [] } = useListClients({
    query: { queryKey: getListClientsQueryKey(), refetchInterval: 4000 },
  });
  const { mutate: createClient, isPending: creating } = useCreateClient();
  const { mutate: updateClient, isPending: updating } = useUpdateClient();
  const { mutate: deleteClient } = useDeleteClient();
  const { mutate: importClients, isPending: importing } = useImportClients();
  const { mutate: checkDuplicates, isPending: checking } = useCheckClientDuplicates();

  // Duplicate confirmation modal state
  type PendingImport = { rows: any[]; dups: DuplicateEntry[] };
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  // Set of names user chose to force-add despite duplication
  const [forceNames, setForceNames] = useState<Set<string>>(new Set());

  const set = (k: keyof FormState, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify("أدخل اسم العميل", "error");
      return;
    }
    const payload = formToPayload(form);
    if (editingId) {
      updateClient(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
            reset();
            notify("تم تحديث بيانات العميل");
          },
          onError: (err) => notify(extractErrorMessage(err, "فشل تحديث العميل"), "error"),
        },
      );
    } else {
      createClient(
        { data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
            reset();
            notify("تم إضافة العميل بنجاح");
          },
          onError: (err) => notify(extractErrorMessage(err, "فشل إضافة العميل"), "error"),
        },
      );
    }
  };

  const handleDelete = (id: number, n: string) => {
    if (!confirm(`حذف العميل "${n}"؟`)) return;
    deleteClient(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
          notify("تم حذف العميل");
          if (editingId === id) reset();
        },
        onError: () => notify("فشل الحذف", "error"),
      },
    );
  };

  const handleEdit = (c: Client) => {
    setForm(clientToForm(c));
    setEditingId(c.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExport = () => {
    if (clients.length === 0) {
      notify("لا توجد بيانات للتصدير", "error");
      return;
    }
    exportClientsXlsx(clients);
    notify("تم تنزيل ملف العملاء");
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const doImport = (rows: any[], forced: string[]) => {
    importClients(
      { data: { clients: rows, forceNames: forced } },
      {
        onSuccess: (res) => {
          qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
          if (res.skipped > 0) {
            const sample = res.duplicates.slice(0, 3).join("، ");
            const more = res.duplicates.length > 3 ? ` و${res.duplicates.length - 3} غيرهم` : "";
            notify(
              `تم استيراد ${res.inserted} عميل وتجاهل ${res.skipped} (مكرر): ${sample}${more}`,
              res.inserted > 0 ? "success" : "error",
            );
          } else {
            notify(`تم استيراد ${res.inserted} عميل بنجاح`);
          }
          setPendingImport(null);
          setForceNames(new Set());
        },
        onError: (err) => notify(extractErrorMessage(err, "فشل الاستيراد"), "error"),
      },
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = await parseClientsXlsx(file);
      if (parsed.length === 0) {
        notify("الملف فارغ أو لا يحتوي بيانات صالحة", "error");
        return;
      }
      // First check for duplicates
      checkDuplicates(
        {
          data: {
            clients: parsed.map((r) => ({
              name: (r as any).name,
              taxNumber: (r as any).taxNumber ?? null,
            })),
          },
        },
        {
          onSuccess: (res) => {
            if (res.duplicates.length === 0) {
              // No duplicates — go straight to import
              doImport(parsed as any, []);
            } else {
              // Show modal for user to decide per duplicate
              setPendingImport({ rows: parsed as any, dups: res.duplicates });
              setForceNames(new Set());
            }
          },
          onError: (err) => {
            if (getErrorStatus(err) === 401) {
              notify("انتهت جلستك، يرجى إعادة تسجيل الدخول", "error");
              setTimeout(() => window.location.reload(), 1500);
            } else {
              // Fallback: import directly without duplicate check
              doImport(parsed as any, []);
            }
          },
        },
      );
    } catch (err) {
      notify("تعذر قراءة الملف", "error");
    }
  };

  const filtered = useMemo(() => {
    const base = clients.filter((c) => {
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      return (
        c.name.toLowerCase().includes(s) ||
        (c.taxNumber ?? "").toLowerCase().includes(s) ||
        (c.phone ?? "").toLowerCase().includes(s)
      );
    });
    const colMeta = SORTABLE_COLUMNS.find((c) => c.key === sortKey);
    const type = colMeta?.type ?? "text";
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      const cmp = compareValues(av, bv, type);
      if (cmp !== 0) return cmp * dir;
      // Stable secondary sort by id (newer first)
      return (b.id - a.id);
    });
  }, [clients, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default direction: dates → desc (newest first), text → asc
      const colMeta = SORTABLE_COLUMNS.find((c) => c.key === key);
      setSortDir(colMeta?.type === "date" ? "desc" : "asc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <span className="sort-arrow muted">⇅</span>;
    return <span className="sort-arrow active">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const sortable = (key: SortKey, label: string) => (
    <th
      className="sortable-th"
      onClick={() => toggleSort(key)}
      data-testid={`sort-${key}`}
      title="اضغط للفرز"
    >
      <span className="th-label">{label}</span>
      {sortIndicator(key)}
    </th>
  );

  // --- Reminders aggregation (only the 4 expiry dates) ---
  const reminders = useMemo<ReminderRow[]>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const out: ReminderRow[] = [];
    for (const c of clients) {
      for (const meta of REMINDER_FIELDS) {
        const raw = (c as any)[meta.key] as string | null | undefined;
        if (!raw) continue;
        const d = new Date(raw);
        if (isNaN(d.getTime())) continue;
        d.setHours(0, 0, 0, 0);
        const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
        if (days <= 14 && days >= -14) {
          out.push({
            clientId: c.id,
            clientName: c.name,
            phone: c.phone,
            type: `${meta.icon} ${meta.label}`,
            date: raw,
            daysLeft: days,
          });
        }
      }
    }
    out.sort((a, b) => a.daysLeft - b.daysLeft);
    return out;
  }, [clients]);

  return (
    <div data-testid="page-clients">
      {/* ─── Duplicate Confirmation Modal ─── */}
      {pendingImport && (
        <div className="dup-modal-overlay text-[15px]" onClick={() => setPendingImport(null)}>
          <div className="dup-modal" onClick={(e) => e.stopPropagation()} data-testid="dup-modal">
            <div className="dup-modal-title">
              ⚠️ تم اكتشاف بيانات مكررة
            </div>
            <p className="dup-modal-sub">
              وُجد <strong>{pendingImport.dups.length}</strong> عميل مكرر في الملف.
              حدّد كل اسم على حدة: هل تريد إضافته أم تجاهله؟
            </p>

            <div className="dup-modal-actions-top">
              <button
                type="button"
                className="dup-select-all"
                onClick={() => setForceNames(new Set(pendingImport.dups.map((d) => d.name)))}
              >
                ✅ قبول الكل
              </button>
              <button
                type="button"
                className="dup-select-none"
                onClick={() => setForceNames(new Set())}
              >
                ❌ تجاهل الكل
              </button>
            </div>

            <div className="dup-list">
              {pendingImport.dups.map((dup) => {
                const checked = forceNames.has(dup.name);
                return (
                  <div
                    key={dup.name}
                    className={`dup-row ${checked ? "dup-row-accept" : "dup-row-skip"}`}
                    onClick={() => {
                      setForceNames((prev) => {
                        const next = new Set(prev);
                        checked ? next.delete(dup.name) : next.add(dup.name);
                        return next;
                      });
                    }}
                    data-testid={`dup-row-${dup.name}`}
                  >
                    <div className="dup-row-check">
                      {checked ? "✅" : "⬜"}
                    </div>
                    <div className="dup-row-info">
                      <div className="dup-row-name">{dup.name}</div>
                      <div className="dup-row-reason">
                        {dup.inBatch ? "📄 " : "🗄️ "}
                        {dup.reason}
                      </div>
                    </div>
                    <div className="dup-row-decision">
                      {checked
                        ? <span className="dup-badge dup-badge-add">إضافة</span>
                        : <span className="dup-badge dup-badge-skip">تجاهل</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="dup-modal-footer">
              <span className="muted" style={{ fontSize: 12 }}>
                سيُضاف {forceNames.size} مكرر · سيُتجاهل {pendingImport.dups.length - forceNames.size} مكرر
                {" · "}
                {pendingImport.rows.length - pendingImport.dups.length + forceNames.size} عميل إجمالاً
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => { setPendingImport(null); setForceNames(new Set()); }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="btn-save btn-purple"
                  disabled={importing}
                  onClick={() => doImport(pendingImport.rows, Array.from(forceNames))}
                  data-testid="btn-confirm-import"
                >
                  {importing ? "..." : "📥 استيراد"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="page-title">👥 إدارة العملاء</div>
      <div className="page-sub">إضافة وتعديل بيانات العملاء وملفاتهم الضريبية</div>
      {/* === REMINDERS SECTION (4 dates only) === */}
      <div className="card card-compact">
        <div className="card-title">
          ⏰ التذكيرات الخاصة بالعملاء
          <span className="card-pill" data-testid="reminders-count">{reminders.length}</span>
          <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>
            (ضمن ±14 يوم)
          </span>
        </div>
        {reminders.length === 0 ? (
          <div className="empty" style={{ padding: 18 }}>
            <div className="empty-icon" style={{ fontSize: 32 }}>✅</div>
            <div className="empty-text">لا توجد تذكيرات عاجلة الآن</div>
          </div>
        ) : (
          <div className="excel-wrap" style={{ maxHeight: 240, overflowY: "auto" }}>
            <table className="excel-table excel-compact" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>التليفون</th>
                  <th>نوع التذكير</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r, i) => {
                  const s = statusFor(r.daysLeft);
                  return (
                    <tr key={i} data-testid={`reminder-row-${r.clientId}-${i}`}>
                      <td style={{ fontWeight: 700 }}>{r.clientName}</td>
                      <td className="muted">{r.phone || "—"}</td>
                      <td>{r.type}</td>
                      <td>{formatDmy(r.date)}</td>
                      <td><span className={`tag ${s.cls}`}>{s.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {canEdit && (
        <div className="card card-compact">
          <div className="card-title">
            {editingId ? "✏️ تعديل بيانات العميل" : "➕ إضافة عميل جديد"}
            <div style={{ marginRight: "auto", display: "flex", gap: 6 }}>
              {editingId && (
                <button
                  type="button"
                  className="row-action"
                  onClick={reset}
                  data-testid="btn-cancel-edit"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>
          <form className="form-grid form-compact" onSubmit={handleSubmit}>
              <div className="form-row-3">
                <div>
                  <label className="f-label">الاسم *</label>
                  <input className="f-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="الاسم الكامل" data-testid="input-name" />
                </div>
                <div>
                  <label className="f-label">الرقم الضريبي</label>
                  <input className="f-input" value={form.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} placeholder="000-000-000" data-testid="input-tax-number" />
                </div>
                <div>
                  <label className="f-label">الرقم القومي</label>
                  <input className="f-input" value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} data-testid="input-national-id" />
                </div>
              </div>
              <div className="form-row-3">
                <div>
                  <label className="f-label">نوع المنشأة</label>
                  <select className="f-select" value={form.entityType} onChange={(e) => set("entityType", e.target.value)} data-testid="select-entity-type">
                    <option value="">— اختر —</option>
                    <option value="فردي">فردي</option>
                    <option value="شركة">شركة</option>
                  </select>
                </div>
                <div>
                  <label className="f-label">ق.م</label>
                  <select className="f-select" value={form.vatStatus} onChange={(e) => set("vatStatus", e.target.value)} data-testid="select-vat-status">
                    <option value="">— اختر —</option>
                    <option value="نعم">نعم (شهري)</option>
                    <option value="لا">لا</option>
                    <option value="ربع سنوي">ربع سنوي</option>
                  </select>
                </div>
                <div>
                  <label className="f-label">تاريخ التسجيل</label>
                  <input className="f-input" type="date" value={form.registrationDate} onChange={(e) => set("registrationDate", e.target.value)} data-testid="input-registration-date" />
                </div>
              </div>
              <div className="form-row-3">
                <div>
                  <label className="f-label">اسم المستخدم</label>
                  <input className="f-input" value={form.username} onChange={(e) => set("username", e.target.value)} data-testid="input-username" />
                </div>
                <div>
                  <label className="f-label">كلمة السر</label>
                  <input className="f-input" value={form.password} onChange={(e) => set("password", e.target.value)} data-testid="input-password" />
                </div>
                <div>
                  <label className="f-label">رقم التليفون</label>
                  <input className="f-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01xxxxxxxxx" data-testid="input-phone" />
                </div>
              </div>
              <div className="form-row-3">
                <div>
                  <label className="f-label">الإيميل</label>
                  <input className="f-input" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="example@mail.com" data-testid="input-email" />
                </div>
                <div>
                  <label className="f-label">إيميل الفاتورة الإلكترونية</label>
                  <input className="f-input" value={form.eInvoiceEmail} onChange={(e) => set("eInvoiceEmail", e.target.value)} data-testid="input-einvoice-email" />
                </div>
                <div>
                  <label className="f-label">كلمة سر الفاتورة الإلكترونية</label>
                  <input className="f-input" value={form.eInvoicePassword} onChange={(e) => set("eInvoicePassword", e.target.value)} data-testid="input-einvoice-password" />
                </div>
              </div>

              <div className="card-title" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>
                📅 تواريخ هامة (تظهر في التذكيرات)
              </div>
              <div className="form-row-4">
                <div>
                  <label className="f-label">انتهاء البطاقة الضريبية</label>
                  <input className="f-input" type="date" value={form.taxCardExpiry} onChange={(e) => set("taxCardExpiry", e.target.value)} data-testid="input-tax-card-expiry" />
                </div>
                <div>
                  <label className="f-label">انتهاء موقع الضرائب</label>
                  <input className="f-input" type="date" value={form.taxPortalExpiry} onChange={(e) => set("taxPortalExpiry", e.target.value)} data-testid="input-tax-portal-expiry" />
                </div>
                <div>
                  <label className="f-label">انتهاء التوكن</label>
                  <input className="f-input" type="date" value={form.tokenExpiry} onChange={(e) => set("tokenExpiry", e.target.value)} data-testid="input-token-expiry" />
                </div>
                <div>
                  <label className="f-label">لجان الطعن</label>
                  <input className="f-input" type="date" value={form.appealCommitteeDate} onChange={(e) => set("appealCommitteeDate", e.target.value)} data-testid="input-appeal-committee-date" />
                </div>
              </div>

              <div>
                <label className="f-label">ملاحظات</label>
                <textarea className="f-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="أي تفاصيل إضافية..." data-testid="input-notes" />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="submit" className="btn-save btn-blue" disabled={creating || updating} data-testid="btn-save-client">
                  {creating || updating ? "..." : editingId ? "💾 حفظ التعديلات" : "💾 حفظ العميل"}
                </button>
                <button type="button" className="btn-save" style={{ background: "#1e293b" }} onClick={() => downloadClientsTemplate()} data-testid="btn-template">
                  📄 نموذج Excel
                </button>
                <button type="button" className="btn-save" style={{ background: "#0e7490" }} onClick={handleUploadClick} disabled={importing} data-testid="btn-import">
                  {importing ? "..." : "📤 استيراد"}
                </button>
                <button type="button" className="btn-save" style={{ background: "#166534" }} onClick={handleExport} data-testid="btn-export">
                  📥 تصدير
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>
          </form>
        </div>
      )}
      <div className="card">
        <div className="card-title">
          📋 قائمة العملاء
          <span className="card-pill" data-testid="clients-count">{clients.length}</span>
          <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>
            مرتب حسب: {SORTABLE_COLUMNS.find((c) => c.key === sortKey)?.label}{" "}
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
          <div style={{ marginRight: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            {(sortKey !== "createdAt" || sortDir !== "desc") && (
              <button
                type="button"
                className="row-action"
                onClick={() => {
                  setSortKey("createdAt");
                  setSortDir("desc");
                }}
                data-testid="btn-reset-sort"
                title="إعادة الترتيب الافتراضي"
              >
                ↺ ترتيب افتراضي
              </button>
            )}
            <input
              className="f-input"
              style={{ maxWidth: 260 }}
              placeholder="🔍 بحث بالاسم / الرقم الضريبي / التليفون"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👥</div>
            <div className="empty-text">لا يوجد عملاء</div>
          </div>
        ) : (
          <div className="excel-wrap">
            <table className="excel-table excel-sticky" style={{ minWidth: 2400 }}>
              <thead>
                <tr>
                  {sortable("name", "الاسم")}
                  {sortable("taxNumber", "الرقم الضريبي")}
                  {sortable("entityType", "المنشأة")}
                  {sortable("vatStatus", "ق.م")}
                  {sortable("username", "اسم المستخدم")}
                  <th>كلمة السر</th>
                  {sortable("email", "الإيميل")}
                  {sortable("phone", "التليفون")}
                  {sortable("nationalId", "الرقم القومي")}
                  <th>إيميل الفاتورة الإلكترونية</th>
                  <th>كلمة سر الفاتورة الإلكترونية</th>
                  {sortable("registrationDate", "تاريخ التسجيل")}
                  {sortable("taxCardExpiry", "انتهاء البطاقة الضريبية")}
                  {sortable("taxPortalExpiry", "انتهاء موقع الضرائب")}
                  {sortable("tokenExpiry", "انتهاء التوكن")}
                  {sortable("appealCommitteeDate", "لجان الطعن")}
                  <th>ملاحظات</th>
                  {sortable("addedByName", "أضافه")}
                  {sortable("createdAt", "تاريخ الإضافة")}
                  {canEdit && <th>إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} data-testid={`client-row-${c.id}`}>
                    <td style={{ fontWeight: 700 }} title={c.name}>{c.name}</td>
                    <td className="muted">{c.taxNumber || "—"}</td>
                    <td>
                      <span className={`tag tag-${c.entityType === "شركة" ? "blue" : "purple"}`}>
                        {c.entityType || "—"}
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${c.vatStatus === "نعم" ? "tag-green" : c.vatStatus === "ربع سنوي" ? "tag-amber" : "tag-gray"}`}>
                        {c.vatStatus || "—"}
                      </span>
                    </td>
                    <td className="muted">{c.username || "—"}</td>
                    <td className="muted">{c.password || "—"}</td>
                    <td className="muted">{c.email || "—"}</td>
                    <td className="muted">{c.phone || "—"}</td>
                    <td className="muted">{c.nationalId || "—"}</td>
                    <td className="muted">{c.eInvoiceEmail || "—"}</td>
                    <td className="muted">{c.eInvoicePassword || "—"}</td>
                    <td className="muted">{formatDmy(c.registrationDate)}</td>
                    <td className={expiryClass(c.taxCardExpiry)}>{formatDmy(c.taxCardExpiry)}</td>
                    <td className={expiryClass(c.taxPortalExpiry)}>{formatDmy(c.taxPortalExpiry)}</td>
                    <td className={expiryClass(c.tokenExpiry)}>{formatDmy(c.tokenExpiry)}</td>
                    <td className={expiryClass(c.appealCommitteeDate)}>{formatDmy(c.appealCommitteeDate)}</td>
                    <td className="muted" style={{ maxWidth: 220, whiteSpace: "normal" }}>{c.notes || "—"}</td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{c.addedByName || "—"}</td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDate(c.createdAt)}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="row-action" onClick={() => handleEdit(c)} data-testid={`btn-edit-client-${c.id}`}>
                            ✏️
                          </button>
                          <button className="row-action" onClick={() => handleDelete(c.id, c.name)} data-testid={`btn-delete-client-${c.id}`}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
