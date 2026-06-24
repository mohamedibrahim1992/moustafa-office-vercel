import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  useListExpenses,
  useCreateExpense,
  useDeleteExpense,
  getListClientsQueryKey,
  getListExpensesQueryKey,
} from "@workspace/api-client-react";
import type { User, ExpenseCategory } from "@workspace/api-client-react";

type CreateExpenseInputCategory = ExpenseCategory;
import { useNotify } from "@/lib/notify";
import { formatDate, formatMoney, CATEGORY_COLORS } from "@/lib/format";

const CATEGORIES: CreateExpenseInputCategory[] = [
  "رواتب",
  "ايجار مكتب",
  "كهرباء",
  "انترنت",
  "مصاريف تشغيلية",
];

const FULL_ACCESS = ["admin", "manager"];

export default function ExpensesPage({ user }: { user: User }) {
  const qc = useQueryClient();
  const notify = useNotify();
  const isFull = FULL_ACCESS.includes(user.role);

  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CreateExpenseInputCategory>("مصاريف تشغيلية");
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: clients = [] } = useListClients({
    query: { queryKey: getListClientsQueryKey(), refetchInterval: 4000 },
  });
  const { data: expenses = [] } = useListExpenses({
    query: { queryKey: getListExpensesQueryKey(), refetchInterval: 4000 },
  });
  const { mutate: createExpense, isPending } = useCreateExpense();
  const { mutate: deleteExpense } = useDeleteExpense();

  const reset = () => {
    setItem(""); setAmount(""); setCategory("مصاريف تشغيلية"); setClientId(""); setNotes("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!item.trim()) { notify("أدخل بند المصروف", "error"); return; }
    if (!amount || Number(amount) <= 0) { notify("أدخل مبلغاً صحيحاً", "error"); return; }
    createExpense(
      {
        data: {
          item: item.trim(),
          amount: Number(amount),
          category,
          clientId: clientId ? Number(clientId) : null,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListExpensesQueryKey() });
          reset();
          notify("تم تسجيل المصروف بنجاح");
        },
        onError: () => notify("فشل تسجيل المصروف", "error"),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("حذف المصروف؟")) return;
    deleteExpense({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        notify("تم حذف المصروف");
      },
      onError: () => notify("فشل الحذف", "error"),
    });
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div data-testid="page-expenses">
      <div className="page-title">💸 المصروفات</div>
      <div className="page-sub">
        {isFull
          ? "تظهر جميع المصروفات من كل المستخدمين"
          : "تظهر المصروفات التي قمت بإضافتها فقط"}
      </div>

      <div className="card">
        <div className="card-title">➕ تسجيل مصروف جديد</div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-row">
            <div>
              <label className="f-label">بند المصروف *</label>
              <input className="f-input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="مثال: فاتورة كهرباء" data-testid="input-item" />
            </div>
            <div>
              <label className="f-label">المبلغ (ج.م) *</label>
              <input className="f-input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-testid="input-amount" />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label className="f-label">التصنيف</label>
              <select className="f-select" value={category} onChange={(e) => setCategory(e.target.value as CreateExpenseInputCategory)} data-testid="select-category">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="f-label">ربط بعميل (اختياري)</label>
              <select className="f-select" value={clientId} onChange={(e) => setClientId(e.target.value)} data-testid="select-client">
                <option value="">— بدون ربط —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="f-label">ملاحظات</label>
            <textarea className="f-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تفاصيل إضافية..." data-testid="input-notes" />
          </div>
          <div>
            <button type="submit" className="btn-save btn-red" disabled={isPending} data-testid="btn-save-expense">
              {isPending ? "..." : "💾 تسجيل المصروف"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">
          📋 سجل المصروفات
          <span className="card-pill">{expenses.length}</span>
          <span className="card-pill" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", marginRight: "auto" }}>
            الإجمالي: {formatMoney(total)} ج.م
          </span>
        </div>
        {expenses.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💸</div>
            <div className="empty-text">لا توجد مصروفات</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>البند</th><th>المبلغ</th><th>التصنيف</th><th>العميل المرتبط</th>
                  <th>الملاحظات</th>
                  <th>أضافه</th><th>التاريخ</th><th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((ex) => (
                  <tr key={ex.id} data-testid={`expense-row-${ex.id}`}>
                    <td style={{ fontWeight: 700 }}>{ex.item}</td>
                    <td className="amount-neg">{formatMoney(Number(ex.amount))} ج.م</td>
                    <td>
                      <span className="badge" style={{ background: `${CATEGORY_COLORS[ex.category]}25`, color: CATEGORY_COLORS[ex.category] }}>
                        {ex.category}
                      </span>
                    </td>
                    <td>{ex.clientName || "—"}</td>
                    <td
                      className="muted"
                      style={{ maxWidth: 240, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      data-testid={`expense-notes-${ex.id}`}
                    >
                      {ex.notes || "—"}
                    </td>
                    <td className="muted">{ex.addedByName || "—"}</td>
                    <td className="muted">{formatDate(ex.createdAt)}</td>
                    <td>
                      {(isFull || ex.addedById === user.id) && (
                        <button className="row-action" onClick={() => handleDelete(ex.id)} data-testid={`btn-delete-expense-${ex.id}`}>
                          🗑️
                        </button>
                      )}
                    </td>
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
