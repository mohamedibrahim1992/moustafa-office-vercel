import { useMemo, useState } from "react";
import {
  useListClients,
  useListInvoices,
  useListExpenses,
  getListClientsQueryKey,
  getListInvoicesQueryKey,
  getListExpensesQueryKey,
} from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { formatMoney, monthLabel } from "@/lib/format";

const REFETCH = { refetchInterval: 4000 };

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(year: number, month0: number): Date {
  return new Date(year, month0, 1, 0, 0, 0, 0);
}
function endOfMonth(year: number, month0: number): Date {
  return new Date(year, month0 + 1, 0, 23, 59, 59, 999);
}

export default function ReportsPage({ user: _user }: { user: User }) {
  const today = new Date();
  const [fromYM, setFromYM] = useState<string>(
    ymKey(new Date(today.getFullYear(), today.getMonth() - 5, 1)),
  );
  const [toYM, setToYM] = useState<string>(ymKey(today));

  const { data: clients = [] } = useListClients({
    query: { queryKey: getListClientsQueryKey(), ...REFETCH },
  });
  const { data: invoices = [] } = useListInvoices({
    query: { queryKey: getListInvoicesQueryKey(), ...REFETCH },
  });
  const { data: expenses = [] } = useListExpenses({
    query: { queryKey: getListExpensesQueryKey(), ...REFETCH },
  });

  const { fromDate, toDate } = useMemo(() => {
    const [fy, fm] = fromYM.split("-").map(Number);
    const [ty, tm] = toYM.split("-").map(Number);
    const f = startOfMonth(fy, fm - 1);
    const t = endOfMonth(ty, tm - 1);
    if (f > t) return { fromDate: t, toDate: f };
    return { fromDate: f, toDate: t };
  }, [fromYM, toYM]);

  const inRange = (iso: string) => {
    const d = new Date(iso);
    return d >= fromDate && d <= toDate;
  };

  const invR = invoices.filter((i) => inRange(i.createdAt));
  const expR = expenses.filter((e) => inRange(e.createdAt));
  const cliR = clients.filter((c) => inRange(c.createdAt));

  const totalInvoices = invR.reduce((s, i) => s + Number(i.amount), 0);
  const paidInvoices = invR.filter((i) => i.status === "مدفوعة").reduce((s, i) => s + Number(i.amount), 0);
  const pendingInvoices = invR.filter((i) => i.status === "معلقة").reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expR.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = paidInvoices - totalExpenses;

  // Build last 24 months options
  const monthOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < 36; i++) {
      const y = d.getFullYear();
      const m = d.getMonth();
      opts.push({
        value: `${y}-${String(m + 1).padStart(2, "0")}`,
        label: monthLabel(y, m),
      });
      d.setMonth(d.getMonth() - 1);
    }
    return opts;
  }, [today]);

  const stats = [
    { num: cliR.length, lbl: "عملاء جدد", icon: "👥", color: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", text: "#93c5fd" },
    { num: invR.length, lbl: "عدد الفواتير", icon: "🧾", color: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", text: "#6ee7b7" },
    { num: `${formatMoney(totalInvoices)} ج.م`, lbl: "إجمالي الفواتير", icon: "💰", color: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", text: "#fcd34d" },
    { num: `${formatMoney(paidInvoices)} ج.م`, lbl: "المحصّل", icon: "✅", color: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", text: "#6ee7b7" },
    { num: `${formatMoney(pendingInvoices)} ج.م`, lbl: "معلق", icon: "⏳", color: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", text: "#fcd34d" },
    { num: `${formatMoney(totalExpenses)} ج.م`, lbl: "إجمالي المصروفات", icon: "💸", color: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", text: "#fca5a5" },
    { num: `${formatMoney(netProfit)} ج.م`, lbl: "صافي الربح", icon: "📈", color: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)", text: "#c4b5fd" },
  ];

  // Per category expenses breakdown
  const expByCategory = expR.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});

  return (
    <div data-testid="page-reports">
      <div className="page-title">📈 التقارير المالية</div>
      <div className="page-sub">إحصائيات تفصيلية لفترة زمنية مختارة</div>

      <div className="card">
        <div className="card-title">📅 اختيار الفترة الزمنية</div>
        <div className="form-row">
          <div>
            <label className="f-label">من شهر</label>
            <select className="f-select" value={fromYM} onChange={(e) => setFromYM(e.target.value)} data-testid="select-from">
              {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="f-label">إلى شهر</label>
            <select className="f-select" value={toYM} onChange={(e) => setToYM(e.target.value)} data-testid="select-to">
              {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

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

      <div className="card">
        <div className="card-title">💸 توزيع المصروفات حسب التصنيف</div>
        {Object.keys(expByCategory).length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💸</div>
            <div className="empty-text">لا توجد مصروفات في هذه الفترة</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>التصنيف</th><th>الإجمالي</th><th>النسبة</th></tr>
              </thead>
              <tbody>
                {Object.entries(expByCategory).map(([cat, amt]) => {
                  const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                  return (
                    <tr key={cat}>
                      <td>{cat}</td>
                      <td className="amount-neg">{formatMoney(amt)} ج.م</td>
                      <td>{pct.toFixed(1)}%</td>
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
