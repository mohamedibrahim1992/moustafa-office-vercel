import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  useListInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  getListClientsQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import type { User, InvoiceStatus } from "@workspace/api-client-react";

type CreateInvoiceInputStatus = InvoiceStatus;
import { useNotify } from "@/lib/notify";
import { formatDate, formatMoney, STATUS_COLORS } from "@/lib/format";

const STATUSES: CreateInvoiceInputStatus[] = ["معلقة", "مدفوعة"];
const FULL_ACCESS = ["admin", "manager"];

export default function InvoicesPage({ user }: { user: User }) {
  const qc = useQueryClient();
  const notify = useNotify();
  const isFull = FULL_ACCESS.includes(user.role);

  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState<number | "">("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<CreateInvoiceInputStatus>("معلقة");
  const [description, setDescription] = useState("");

  const { data: clients = [] } = useListClients({
    query: { queryKey: getListClientsQueryKey(), refetchInterval: 4000 },
  });
  const { data: invoices = [] } = useListInvoices({
    query: { queryKey: getListInvoicesQueryKey(), refetchInterval: 4000 },
  });
  const { mutate: createInvoice, isPending } = useCreateInvoice();
  const { mutate: updateInvoice, isPending: updating } = useUpdateInvoice();
  const { mutate: deleteInvoice } = useDeleteInvoice();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editStatus, setEditStatus] = useState<CreateInvoiceInputStatus>("معلقة");

  const matched = useMemo(() => {
    const s = clientSearch.trim().toLowerCase();
    if (!s) return clients.slice(0, 8);
    return clients
      .filter((c) => c.name.toLowerCase().includes(s))
      .slice(0, 8);
  }, [clients, clientSearch]);

  const reset = () => {
    setClientSearch("");
    setClientId("");
    setAmount("");
    setStatus("معلقة");
    setDescription("");
  };

  const handleSelectClient = (id: number, name: string) => {
    setClientId(id);
    setClientSearch(name);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    let cid = clientId;
    if (!cid) {
      // Try exact match by typed name
      const match = clients.find((c) => c.name === clientSearch.trim());
      if (match) cid = match.id;
    }
    if (!cid) {
      notify("اختر العميل من القائمة", "error");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      notify("أدخل مبلغاً صحيحاً", "error");
      return;
    }
    createInvoice(
      {
        data: {
          clientId: Number(cid),
          amount: Number(amount),
          status,
          description: description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          reset();
          notify("تم حفظ الفاتورة بنجاح");
        },
        onError: () => notify("فشل حفظ الفاتورة", "error"),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("حذف الفاتورة؟")) return;
    deleteInvoice(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          notify("تم حذف الفاتورة");
        },
        onError: () => notify("فشل الحذف", "error"),
      },
    );
  };

  const startEdit = (inv: { id: number; amount: number | string; status: CreateInvoiceInputStatus }) => {
    setEditingId(inv.id);
    setEditAmount(String(inv.amount));
    setEditStatus(inv.status);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditStatus("معلقة");
  };

  const saveEdit = (id: number) => {
    const amt = Number(editAmount);
    if (!editAmount || Number.isNaN(amt) || amt <= 0) {
      notify("أدخل مبلغاً صحيحاً", "error");
      return;
    }
    updateInvoice(
      {
        id,
        data: { amount: amt, status: editStatus },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          notify("تم تحديث الفاتورة");
          cancelEdit();
        },
        onError: () => notify("فشل تحديث الفاتورة", "error"),
      },
    );
  };

  const total = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const paid = invoices
    .filter((i) => i.status === "مدفوعة")
    .reduce((s, i) => s + Number(i.amount), 0);
  const pending = total - paid;

  return (
    <div data-testid="page-invoices">
      <div className="page-title">🧾 الفواتير والمدفوعات</div>
      <div className="page-sub">
        {isFull
          ? "تظهر هنا جميع الفواتير من كل المستخدمين"
          : "تظهر هنا الفواتير التي قمت بإضافتها فقط"}
      </div>

      <div className="card">
        <div className="card-title">➕ إضافة فاتورة جديدة</div>
        {clients.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">⚠️</div>
            <div className="empty-text">يجب إضافة عميل أولاً قبل إنشاء فاتورة</div>
          </div>
        ) : (
          <form className="form-grid" onSubmit={handleSubmit} autoComplete="off">
            <div className="form-row">
              <div style={{ position: "relative" }}>
                <label className="f-label">العميل *</label>
                <input
                  className="f-input"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientId("");
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="اكتب اسم العميل..."
                  data-testid="input-client-search"
                />
                {showSuggestions && matched.length > 0 && (
                  <div className="autocomplete-list" data-testid="client-suggestions">
                    {matched.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        className="autocomplete-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectClient(c.id, c.name)}
                        data-testid={`suggest-client-${c.id}`}
                      >
                        <span style={{ fontWeight: 700 }}>{c.name}</span>
                        {c.taxNumber && <span className="muted" style={{ fontSize: 11, marginRight: 8 }}>#{c.taxNumber}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="f-label">المبلغ (ج.م) *</label>
                <input className="f-input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-testid="input-amount" />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label className="f-label">الحالة</label>
                <select className="f-select" value={status} onChange={(e) => setStatus(e.target.value as CreateInvoiceInputStatus)} data-testid="select-status">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="f-label">وصف الخدمة</label>
                <input className="f-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف تفصيلي للخدمة المقدمة" data-testid="input-description" />
              </div>
            </div>
            <div>
              <button type="submit" className="btn-save btn-green" disabled={isPending} data-testid="btn-save-invoice">
                {isPending ? "..." : "💾 حفظ الفاتورة"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          📋 سجل الفواتير
          <span className="card-pill">{invoices.length}</span>
          <span className="card-pill" style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7", marginRight: "auto" }}>
            مدفوع: {formatMoney(paid)} ج.م
          </span>
          <span className="card-pill" style={{ background: "rgba(245,158,11,0.15)", color: "#fcd34d" }}>
            معلق: {formatMoney(pending)} ج.م
          </span>
        </div>
        {invoices.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🧾</div>
            <div className="empty-text">لا توجد فواتير</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>الوصف</th>
                  <th>أضافه</th>
                  <th>التاريخ</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isEditing = editingId === inv.id;
                  return (
                    <tr key={inv.id} data-testid={`invoice-row-${inv.id}`}>
                      <td style={{ fontWeight: 700 }}>{inv.clientName}</td>
                      <td className="amount">
                        {isEditing ? (
                          <input
                            className="f-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            style={{ maxWidth: 130 }}
                            data-testid={`input-edit-amount-${inv.id}`}
                          />
                        ) : (
                          <>{formatMoney(Number(inv.amount))} ج.م</>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="f-select"
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as CreateInvoiceInputStatus)}
                            style={{ maxWidth: 130 }}
                            data-testid={`select-edit-status-${inv.id}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="badge" style={{ background: `${STATUS_COLORS[inv.status]}25`, color: STATUS_COLORS[inv.status] }}>
                            {inv.status}
                          </span>
                        )}
                      </td>
                      <td className="muted">{inv.description || "—"}</td>
                      <td className="muted">{inv.addedByName || "—"}</td>
                      <td className="muted">{formatDate(inv.createdAt)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {isFull && (
                            isEditing ? (
                              <>
                                <button
                                  className="row-action"
                                  onClick={() => saveEdit(inv.id)}
                                  disabled={updating}
                                  data-testid={`btn-save-invoice-${inv.id}`}
                                  title="حفظ"
                                >
                                  💾
                                </button>
                                <button
                                  className="row-action"
                                  onClick={cancelEdit}
                                  data-testid={`btn-cancel-invoice-${inv.id}`}
                                  title="إلغاء"
                                >
                                  ✖️
                                </button>
                              </>
                            ) : (
                              <button
                                className="row-action"
                                onClick={() => startEdit({ id: inv.id, amount: inv.amount, status: inv.status })}
                                data-testid={`btn-edit-invoice-${inv.id}`}
                                title="تعديل المبلغ والحالة"
                              >
                                ✏️
                              </button>
                            )
                          )}
                          {(isFull || inv.addedById === user.id) && !isEditing && (
                            <button className="row-action" onClick={() => handleDelete(inv.id)} data-testid={`btn-delete-invoice-${inv.id}`}>
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
