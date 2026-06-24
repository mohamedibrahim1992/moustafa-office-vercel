import {
  useListClients,
  useListInvoices,
  useListExpenses,
  useListDeclarations,
  getListClientsQueryKey,
  getListInvoicesQueryKey,
  getListExpensesQueryKey,
  getListDeclarationsQueryKey,
} from "@workspace/api-client-react";
import { formatMoney, formatDate } from "@/lib/format";

const REFETCH = { refetchInterval: 4000 };

export default function DashboardPage() {
  const { data: clients = [] } = useListClients({ query: { queryKey: getListClientsQueryKey(), ...REFETCH } });
  const { data: invoices = [] } = useListInvoices({ query: { queryKey: getListInvoicesQueryKey(), ...REFETCH } });
  const { data: expenses = [] } = useListExpenses({ query: { queryKey: getListExpensesQueryKey(), ...REFETCH } });
  const { data: declarations = [] } = useListDeclarations({ query: { queryKey: getListDeclarationsQueryKey(), refetchInterval: 8000 } });

  const totalInvoices = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const paidInvoices = invoices.filter((i) => i.status === "مدفوعة").reduce((s, i) => s + Number(i.amount), 0);
  const pendingInvoices = invoices.filter((i) => i.status === "معلقة").reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = paidInvoices - totalExpenses;
  const pendingDecls = declarations.filter((d) => !d.completed).length;

  const stats = [
    { num: clients.length, lbl: "العملاء", icon: "👥", color: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", text: "#93c5fd" },
    { num: invoices.length, lbl: "الفواتير", icon: "🧾", color: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", text: "#6ee7b7" },
    { num: `${formatMoney(totalInvoices)} ج.م`, lbl: "إجمالي الفواتير", icon: "💰", color: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", text: "#fcd34d" },
    { num: `${formatMoney(paidInvoices)} ج.م`, lbl: "المحصّل", icon: "✅", color: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", text: "#6ee7b7" },
    { num: `${formatMoney(pendingInvoices)} ج.م`, lbl: "معلق", icon: "⏳", color: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", text: "#fcd34d" },
    { num: `${formatMoney(totalExpenses)} ج.م`, lbl: "إجمالي المصروفات", icon: "💸", color: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", text: "#fca5a5" },
    { num: `${formatMoney(netProfit)} ج.م`, lbl: "صافي الربح", icon: "📈", color: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)", text: "#c4b5fd" },
    { num: pendingDecls, lbl: "إقرارات معلقة", icon: "📑", color: "rgba(6,182,212,0.15)", border: "rgba(6,182,212,0.3)", text: "#67e8f9" },
  ];

  return (
    <div data-testid="page-dashboard">
      <div className="page-title">لوحة التحكم</div>
      <div className="page-sub">نظرة عامة على جميع البيانات — تتحدث تلقائياً</div>

      <div className="stats-grid">
        {stats.map((s, i) => (
          <div
            key={i}
            className="stat-card"
            style={{ background: s.color, borderColor: s.border }}
            data-testid={`stat-${i}`}
          >
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-num" style={{ color: s.text }}>{s.num}</div>
            <div className="stat-lbl" style={{ color: s.text }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">📋 آخر الفواتير</div>
          {invoices.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🧾</div>
              <div className="empty-text">لا توجد فواتير</div>
            </div>
          ) : (
            invoices.slice(0, 5).map((inv) => (
              <div className="recent-row" key={inv.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{inv.clientName}</div>
                  <div className="recent-meta">{inv.status} · {formatDate(inv.createdAt)}</div>
                </div>
                <div className="amount-pos">{formatMoney(Number(inv.amount))} ج.م</div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-title">💸 آخر المصروفات</div>
          {expenses.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">💸</div>
              <div className="empty-text">لا توجد مصروفات</div>
            </div>
          ) : (
            expenses.slice(0, 5).map((ex) => (
              <div className="recent-row" key={ex.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{ex.item}</div>
                  <div className="recent-meta">{ex.category} · {formatDate(ex.createdAt)}</div>
                </div>
                <div className="amount-neg">{formatMoney(Number(ex.amount))} ج.م</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
