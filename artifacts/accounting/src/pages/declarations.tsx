import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDeclarations,
  useToggleDeclaration,
  getListDeclarationsQueryKey,
} from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useNotify } from "@/lib/notify";
import { formatDate } from "@/lib/format";

type FilterTab = "all" | "pending" | "completed" | "overdue";
type DeclTypeFilter = "all" | "income" | "vat";
type EntityFilter = "all" | "فردي" | "شركة";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default function DeclarationsPage({ user: _user }: { user: User }) {
  const qc = useQueryClient();
  const notify = useNotify();

  // Status tab
  const [filter, setFilter] = useState<FilterTab>("pending");
  // Advanced filter bar
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DeclTypeFilter>("all");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all"); // "all" | "1".."12"
  const [sortBy, setSortBy] = useState<"dueDate" | "client" | "type">("dueDate");

  const { data: itemsData } = useListDeclarations({
    query: {
      queryKey: getListDeclarationsQueryKey(),
      refetchInterval: 6000,
    },
  });
  const { mutate: toggle, isPending } = useToggleDeclaration();
  const items = Array.isArray(itemsData) ? itemsData : [];

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const counts = useMemo(() => {
    let pending = 0, completed = 0, overdue = 0;
    for (const d of items) {
      if (d.completed) completed++;
      else {
        pending++;
        if (d.dueDate < todayKey) overdue++;
      }
    }
    return { all: items.length, pending, completed, overdue };
  }, [items, todayKey]);

  // Build the unique client list for the dropdown
  const clientOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of items) map.set(d.clientId, d.clientName);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [items]);

  const visible = useMemo(() => {
    let list = items.filter((d) => {
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        if (
          !d.clientName.toLowerCase().includes(s) &&
          !d.periodLabel.toLowerCase().includes(s)
        )
          return false;
      }
      if (filter === "pending" && d.completed) return false;
      if (filter === "completed" && !d.completed) return false;
      if (filter === "overdue" && (d.completed || d.dueDate >= todayKey)) return false;
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (entityFilter !== "all" && d.entityType !== entityFilter) return false;
      if (clientFilter !== "all" && String(d.clientId) !== clientFilter) return false;
      if (monthFilter !== "all") {
        const month = parseInt(d.dueDate.slice(5, 7), 10);
        if (month !== parseInt(monthFilter, 10)) return false;
      }
      return true;
    });

    if (sortBy === "client") {
      list = [...list].sort((a, b) => a.clientName.localeCompare(b.clientName, "ar"));
    } else if (sortBy === "type") {
      list = [...list].sort((a, b) => a.type.localeCompare(b.type));
    } else {
      list = [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }
    return list;
  }, [items, filter, search, typeFilter, entityFilter, clientFilter, monthFilter, sortBy, todayKey]);

  const handleToggle = (
    clientId: number,
    type: "income" | "vat",
    periodKey: string,
    completed: boolean,
  ) => {
    toggle(
      { data: { clientId, type, periodKey, completed } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListDeclarationsQueryKey() });
          notify(completed ? "تم الإقرار كمكتمل" : "تم إعادته إلى قيد الانتظار");
        },
        onError: () => notify("تعذر التحديث", "error"),
      },
    );
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setEntityFilter("all");
    setClientFilter("all");
    setMonthFilter("all");
    setSortBy("dueDate");
    setFilter("pending");
  };

  const activeFiltersCount =
    (search.trim() ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (entityFilter !== "all" ? 1 : 0) +
    (clientFilter !== "all" ? 1 : 0) +
    (monthFilter !== "all" ? 1 : 0);

  return (
    <div data-testid="page-declarations">
      <div
        className="page-title"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
      >
        <span>📑 الإقرارات الضريبية</span>
        {activeFiltersCount > 0 && (
          <button
            className="row-action"
            onClick={resetFilters}
            data-testid="btn-reset-filters"
            style={{ fontSize: 12 }}
          >
            ✖ مسح كل الفلاتر ({activeFiltersCount})
          </button>
        )}
      </div>
      <div className="page-sub">
        تذكيرات تلقائية بإقرارات الدخل وضريبة القيمة المضافة بناءً على بيانات كل عميل
      </div>

      {/* Advanced filter bar at the top of the page */}
      <div className="card">
        <div className="card-title">🔎 شريط الفرز السريع</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <label className="f-label">🔍 بحث (عميل / فترة)</label>
            <input
              className="f-input"
              placeholder="ابحث باسم العميل أو الفترة"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>

          <div>
            <label className="f-label">نوع الإقرار</label>
            <select
              className="f-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DeclTypeFilter)}
              data-testid="filter-type"
            >
              <option value="all">كل الأنواع</option>
              <option value="income">ضريبة الدخل</option>
              <option value="vat">ضريبة القيمة المضافة</option>
            </select>
          </div>

          <div>
            <label className="f-label">نوع المنشأة</label>
            <select
              className="f-select"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
              data-testid="filter-entity"
            >
              <option value="all">الكل</option>
              <option value="فردي">فردي</option>
              <option value="شركة">شركة</option>
            </select>
          </div>

          <div>
            <label className="f-label">العميل</label>
            <select
              className="f-select"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              data-testid="filter-client"
            >
              <option value="all">كل العملاء</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="f-label">الشهر</label>
            <select
              className="f-select"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              data-testid="filter-month"
            >
              <option value="all">كل الشهور</option>
              {ARABIC_MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="f-label">ترتيب حسب</label>
            <select
              className="f-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "dueDate" | "client" | "type")}
              data-testid="filter-sort"
            >
              <option value="dueDate">الموعد النهائي</option>
              <option value="client">اسم العميل</option>
              <option value="type">نوع الإقرار</option>
            </select>
          </div>
        </div>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
          <button className={`tab-btn ${filter === "pending" ? "active" : ""}`} onClick={() => setFilter("pending")} data-testid="tab-pending">
            ⏳ قيد الانتظار ({counts.pending})
          </button>
          <button className={`tab-btn ${filter === "overdue" ? "active" : ""}`} onClick={() => setFilter("overdue")} data-testid="tab-overdue">
            ⚠️ متأخرة ({counts.overdue})
          </button>
          <button className={`tab-btn ${filter === "completed" ? "active" : ""}`} onClick={() => setFilter("completed")} data-testid="tab-completed">
            ✅ مكتملة ({counts.completed})
          </button>
          <button className={`tab-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")} data-testid="tab-all">
            الكل ({counts.all})
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          📋 الإقرارات
          <span className="card-pill">{visible.length}</span>
        </div>
        {visible.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <div className="empty-text">لا توجد إقرارات مطابقة للفرز الحالي</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>تم</th>
                  <th>العميل</th>
                  <th>المنشأة</th>
                  <th>نوع الإقرار</th>
                  <th>الفترة</th>
                  <th>الموعد النهائي</th>
                  <th>الحالة</th>
                  <th>أنجز بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const overdue = !d.completed && d.dueDate < todayKey;
                  return (
                    <tr
                      key={`${d.clientId}-${d.type}-${d.periodKey}`}
                      data-testid={`decl-${d.clientId}-${d.type}-${d.periodKey}`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={d.completed}
                          disabled={isPending}
                          onChange={(e) =>
                            handleToggle(d.clientId, d.type, d.periodKey, e.target.checked)
                          }
                          data-testid={`check-${d.clientId}-${d.type}-${d.periodKey}`}
                        />
                      </td>
                      <td style={{ fontWeight: 700 }}>{d.clientName}</td>
                      <td>{d.entityType || "—"}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              d.type === "income" ? "rgba(139,92,246,0.18)" : "rgba(6,182,212,0.18)",
                            color: d.type === "income" ? "#c4b5fd" : "#67e8f9",
                          }}
                        >
                          {d.type === "income" ? "ضريبة الدخل" : "ق.م"}
                        </span>
                      </td>
                      <td>{d.periodLabel}</td>
                      <td className={overdue ? "" : "muted"} style={{ color: overdue ? "#fca5a5" : undefined }}>
                        {formatDate(d.dueDate)}
                      </td>
                      <td>
                        {d.completed ? (
                          <span className="badge" style={{ background: "rgba(16,185,129,0.18)", color: "#6ee7b7" }}>
                            ✅ مكتمل
                          </span>
                        ) : overdue ? (
                          <span className="badge" style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5" }}>
                            ⚠️ متأخر
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "rgba(245,158,11,0.18)", color: "#fcd34d" }}>
                            ⏳ قيد الانتظار
                          </span>
                        )}
                      </td>
                      <td className="muted">{d.completedByName || "—"}</td>
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
