import { useState } from "react";
import {
  useListClients,
  useListInvoices,
  useListExpenses,
  useListReports,
  getListClientsQueryKey,
  getListInvoicesQueryKey,
  getListExpensesQueryKey,
  getListReportsQueryKey,
} from "@workspace/api-client-react";
import { formatDate, formatDateTime, formatMoney, STATUS_COLORS, CATEGORY_COLORS } from "@/lib/format";

type Tab = "clients" | "invoices" | "expenses" | "reports";

const REFETCH = { refetchInterval: 4000 };

export default function AllDataPage() {
  const [tab, setTab] = useState<Tab>("clients");

  const { data: clients = [] } = useListClients({ query: { queryKey: getListClientsQueryKey(), ...REFETCH } });
  const { data: invoices = [] } = useListInvoices({ query: { queryKey: getListInvoicesQueryKey(), ...REFETCH } });
  const { data: expenses = [] } = useListExpenses({ query: { queryKey: getListExpensesQueryKey(), ...REFETCH } });
  const { data: reports = [] } = useListReports({ query: { queryKey: getListReportsQueryKey(), ...REFETCH } });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "clients", label: "👥 العملاء", count: clients.length },
    { key: "invoices", label: "🧾 الفواتير", count: invoices.length },
    { key: "expenses", label: "💸 المصروفات", count: expenses.length },
    { key: "reports", label: "📊 التقارير", count: reports.length },
  ];

  return (
    <div data-testid="page-alldata">
      <div className="page-title">🗄️ كل البيانات</div>
      <div className="page-sub">عرض جميع البيانات المدخلة في النظام</div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
            data-testid={`tab-${t.key}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "clients" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>الاسم</th><th>الرقم الضريبي</th><th>المنشأة</th><th>ق.م</th><th>الهاتف</th><th>أضافه</th><th>التاريخ</th></tr></thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td className="muted">{c.taxNumber || "—"}</td>
                    <td>{c.entityType || "—"}</td>
                    <td>{c.vatStatus || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td className="muted">{c.addedByName || "—"}</td>
                    <td className="muted">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "invoices" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>العميل</th><th>المبلغ</th><th>الحالة</th><th>الوصف</th><th>أضافه</th><th>التاريخ</th></tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700 }}>{inv.clientName}</td>
                    <td className="amount">{formatMoney(Number(inv.amount))} ج.م</td>
                    <td>
                      <span className="badge" style={{ background: `${STATUS_COLORS[inv.status]}25`, color: STATUS_COLORS[inv.status] }}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="muted">{inv.description || "—"}</td>
                    <td className="muted">{inv.addedByName || "—"}</td>
                    <td className="muted">{formatDate(inv.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "expenses" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>البند</th><th>المبلغ</th><th>التصنيف</th><th>العميل</th><th>أضافه</th><th>التاريخ</th></tr></thead>
              <tbody>
                {expenses.map((ex) => (
                  <tr key={ex.id}>
                    <td style={{ fontWeight: 700 }}>{ex.item}</td>
                    <td className="amount-neg">{formatMoney(Number(ex.amount))} ج.م</td>
                    <td>
                      <span className="badge" style={{ background: `${CATEGORY_COLORS[ex.category]}25`, color: CATEGORY_COLORS[ex.category] }}>
                        {ex.category}
                      </span>
                    </td>
                    <td>{ex.clientName || "—"}</td>
                    <td className="muted">{ex.addedByName || "—"}</td>
                    <td className="muted">{formatDate(ex.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "reports" && (
          <div>
            {reports.map((r) => (
              <div key={r.id} className="report-card">
                <div className="report-title">{r.title}</div>
                {r.period && <div className="report-period">📅 {r.period}</div>}
                <div className="report-summary">{r.summary}</div>
                <div className="report-foot">
                  <span>👤 {r.addedByName || "—"} · {formatDateTime(r.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {((tab === "clients" && clients.length === 0) ||
          (tab === "invoices" && invoices.length === 0) ||
          (tab === "expenses" && expenses.length === 0) ||
          (tab === "reports" && reports.length === 0)) && (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <div className="empty-text">لا توجد بيانات</div>
          </div>
        )}
      </div>
    </div>
  );
}
