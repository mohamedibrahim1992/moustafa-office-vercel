import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCommands,
  useCreateCommand,
  useDeleteCommand,
  useToggleCommandComplete,
  useToggleCommandFlag,
  useGetCommandStats,
  useListAuthUsers,
  getListCommandsQueryKey,
  getListAuthUsersQueryKey,
  getGetCommandStatsQueryKey,
} from "@workspace/api-client-react";
import type { User, CommandPriority } from "@workspace/api-client-react";

type CreateCommandInputPriority = CommandPriority;
import { useNotify } from "@/lib/notify";
import { extractErrorMessage } from "@/lib/api-error";
import { formatDateTime, PRIORITY_LABELS } from "@/lib/format";

const FULL_ACCESS = ["admin", "manager"];

type ViewTab = "list" | "stats";
type StatsView = "month" | "year";

export default function CommandsPage({ user }: { user: User }) {
  const qc = useQueryClient();
  const notify = useNotify();
  const isFull = FULL_ACCESS.includes(user.role);

  const [text, setText] = useState("");
  const [priority, setPriority] = useState<CreateCommandInputPriority>("normal");
  const [target, setTarget] = useState("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "flagged" | "completed">("all");
  const [view, setView] = useState<ViewTab>("list");
  const [statsView, setStatsView] = useState<StatsView>("month");

  const { data: usersData } = useListAuthUsers({
    query: { queryKey: getListAuthUsersQueryKey() },
  });
  const { data: commandsData } = useListCommands({
    query: { queryKey: getListCommandsQueryKey(), refetchInterval: 4000 },
  });
  const { data: statsData } = useGetCommandStats({
    query: {
      queryKey: getGetCommandStatsQueryKey(),
      refetchInterval: 6000,
      enabled: isFull,
    },
  });
  const { mutate: createCommand, isPending } = useCreateCommand();
  const { mutate: deleteCommand } = useDeleteCommand();
  const { mutate: toggleComplete } = useToggleCommandComplete();
  const { mutate: toggleFlag } = useToggleCommandFlag();

  const users = Array.isArray(usersData) ? usersData : [];
  const commands = Array.isArray(commandsData) ? commandsData : [];
  const stats = Array.isArray(statsData) ? statsData : [];

  // Visibility rules:
  // - Full access: see everything
  // - Otherwise: only tasks targeted to this user or "all"
  const myView = useMemo(() => {
    return commands.filter((c) =>
      isFull || c.target === "all" || c.target === String(user.id),
    );
  }, [commands, isFull, user.id]);

  // Admin filter panel: filter tasks where this user is the target OR sender
  const adminView = useMemo(() => {
    if (!isFull) return [];
    let list = commands;
    if (filterUser !== "all") {
      list = list.filter(
        (c) => c.target === filterUser || String(c.fromId ?? "") === filterUser,
      );
    }
    if (filterStatus === "pending") list = list.filter((c) => !c.completed && !c.flagged);
    if (filterStatus === "flagged") list = list.filter((c) => c.flagged && !c.completed);
    if (filterStatus === "completed") list = list.filter((c) => c.completed);
    return list;
  }, [commands, isFull, filterUser, filterStatus]);

  const visible = isFull ? adminView : myView;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { notify("اكتب نص المهمة", "error"); return; }
    createCommand(
      { data: { text: text.trim(), priority, target } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCommandsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetCommandStatsQueryKey() });
          setText(""); setPriority("normal"); setTarget("all");
          notify("تم إرسال المهمة", "info");
        },
        onError: () => notify("فشل إرسال المهمة", "error"),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("حذف المهمة؟")) return;
    deleteCommand({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCommandsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetCommandStatsQueryKey() });
        notify("تم حذف المهمة");
      },
    });
  };

  const handleToggleComplete = (id: number, current: boolean) => {
    toggleComplete(
      { id, data: { completed: !current } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCommandsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetCommandStatsQueryKey() });
          notify(!current ? "✅ تم اعتماد تنفيذ المهمة" : "تم إلغاء الاعتماد");
        },
        onError: (err) => notify(extractErrorMessage(err, "تعذر التحديث"), "error"),
      },
    );
  };

  const handleToggleFlag = (id: number, current: boolean) => {
    toggleFlag(
      { id, data: { flagged: !current } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCommandsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetCommandStatsQueryKey() });
          notify(!current ? "🚩 تم تعليم المهمة بإنجازها" : "تم إلغاء علم التنفيذ");
        },
        onError: (err) => notify(extractErrorMessage(err, "تعذر تعليم المهمة"), "error"),
      },
    );
  };

  const totalCompleted = commands.filter((c) => c.completed).length;
  const totalFlagged = commands.filter((c) => c.flagged && !c.completed).length;
  const totalPending = commands.filter((c) => !c.completed && !c.flagged).length;

  return (
    <div data-testid="page-commands">
      <div className="page-title">📋 المهام والإشعارات</div>
      <div className="page-sub">
        {isFull
          ? "إرسال المهام للموظفين، المتابعة والتعليم على المنجز، وإحصائيات شهرية وسنوية لكل محاسب"
          : "المهام والتوجيهات الموجهة إليك"}
      </div>

      {isFull && (
        <div className="card">
          <div className="card-title">📝 إرسال مهمة جديدة</div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label className="f-label">نص المهمة أو الإشعار</label>
              <textarea className="f-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب المهمة أو التوجيه..." data-testid="input-text" />
            </div>
            <div className="form-row">
              <div>
                <label className="f-label">الأولوية</label>
                <select className="f-select" value={priority} onChange={(e) => setPriority(e.target.value as CreateCommandInputPriority)} data-testid="select-priority">
                  <option value="normal">عادي</option>
                  <option value="urgent">عاجل 🔴</option>
                  <option value="info">معلومة ℹ️</option>
                </select>
              </div>
              <div>
                <label className="f-label">موجه لـ</label>
                <select className="f-select" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="select-target">
                  <option value="all">الجميع</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <button type="submit" className="btn-save btn-purple" disabled={isPending} data-testid="btn-send-command">
                {isPending ? "..." : "📤 إرسال المهمة"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isFull && (
        <div className="card">
          <div className="card-title">📂 العرض</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className={`tab-btn ${view === "list" ? "active" : ""}`}
              onClick={() => setView("list")}
              data-testid="view-list"
            >
              📋 سجل المهام
            </button>
            <button
              className={`tab-btn ${view === "stats" ? "active" : ""}`}
              onClick={() => setView("stats")}
              data-testid="view-stats"
            >
              📊 إحصائيات شهرية وسنوية
            </button>
          </div>
        </div>
      )}

      {isFull && view === "list" && (
        <div className="card">
          <div className="card-title">🔍 تصفية المهام</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              className={`tab-btn ${filterStatus === "all" ? "active" : ""}`}
              onClick={() => setFilterStatus("all")}
              data-testid="filter-status-all"
            >
              الكل ({commands.length})
            </button>
            <button
              className={`tab-btn ${filterStatus === "pending" ? "active" : ""}`}
              onClick={() => setFilterStatus("pending")}
              data-testid="filter-status-pending"
            >
              ⏳ قيد التنفيذ ({totalPending})
            </button>
            <button
              className={`tab-btn ${filterStatus === "flagged" ? "active" : ""}`}
              onClick={() => setFilterStatus("flagged")}
              data-testid="filter-status-flagged"
            >
              🚩 بانتظار الاعتماد ({totalFlagged})
            </button>
            <button
              className={`tab-btn ${filterStatus === "completed" ? "active" : ""}`}
              onClick={() => setFilterStatus("completed")}
              data-testid="filter-status-completed"
            >
              ✅ معتمدة ({totalCompleted})
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className={`tab-btn ${filterUser === "all" ? "active" : ""}`}
              onClick={() => setFilterUser("all")}
              data-testid="filter-user-all"
            >
              👥 كل المحاسبين
            </button>
            {users.map((u) => {
              const cnt = commands.filter(
                (c) => c.target === String(u.id) || String(c.fromId ?? "") === String(u.id),
              ).length;
              return (
                <button
                  key={u.id}
                  className={`tab-btn ${filterUser === String(u.id) ? "active" : ""}`}
                  onClick={() => setFilterUser(String(u.id))}
                  data-testid={`filter-user-${u.id}`}
                >
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 8, background: u.color, marginLeft: 6 }} />
                  {u.name} ({cnt})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(view === "list" || !isFull) && (
        <div className="card">
          <div className="card-title">
            📋 سجل المهام
            <span className="card-pill">{visible.length}</span>
          </div>
          {visible.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <div className="empty-text">لا توجد مهام</div>
            </div>
          ) : (
            visible.map((c) => {
              const targetLabel =
                c.target === "all"
                  ? "الجميع"
                  : users.find((u) => String(u.id) === c.target)?.name ?? c.target;
              const isAdmin = user.role === "admin";
              const isSender = c.fromId !== null && c.fromId === user.id;
              const isAssignee =
                c.target === String(user.id) ||
                (c.target === "all" && c.fromId !== user.id);
              // Who can flag (mark as done by assignee)
              const canFlag = !c.completed && (isAssignee || isAdmin || (user.role === "manager"));
              // Who can approve (mark as completed by sender)
              const canApprove = isSender || isAdmin;

              let stage: "new" | "flagged" | "completed" = "new";
              if (c.completed) stage = "completed";
              else if (c.flagged) stage = "flagged";

              const stageStyles: Record<typeof stage, { bg: string; color: string; label: string }> = {
                new: {
                  bg: "rgba(245,158,11,0.18)",
                  color: "#fcd34d",
                  label: "⏳ قيد التنفيذ",
                },
                flagged: {
                  bg: "rgba(59,130,246,0.18)",
                  color: "#93c5fd",
                  label: "🚩 معلّمة بالتنفيذ — بانتظار اعتماد المرسل",
                },
                completed: {
                  bg: "rgba(16,185,129,0.18)",
                  color: "#6ee7b7",
                  label: "✅ تم الاعتماد",
                },
              };

              return (
                <div
                  key={c.id}
                  className={`cmd-card ${c.priority} ${c.completed ? "completed" : ""} ${c.flagged && !c.completed ? "flagged" : ""}`}
                  data-testid={`command-${c.id}`}
                >
                  <div className="cmd-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className={`cmd-priority ${c.priority}`}>{PRIORITY_LABELS[c.priority]}</span>
                      <span className="cmd-from">من: {c.fromName}</span>
                      <span className="muted" style={{ fontSize: 11 }}>→ {targetLabel}</span>
                      <span
                        className="badge"
                        style={{
                          background: stageStyles[stage].bg,
                          color: stageStyles[stage].color,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                        data-testid={`badge-stage-${c.id}`}
                      >
                        {stageStyles[stage].label}
                      </span>
                    </div>
                    <div className="cmd-time">{formatDateTime(c.createdAt)}</div>
                  </div>
                  <div
                    className="cmd-text"
                    style={{
                      textDecoration: c.completed ? "line-through" : "none",
                      opacity: c.completed ? 0.65 : 1,
                    }}
                  >
                    {c.text}
                  </div>

                  {(c.flagged || c.completed) && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        fontSize: 11,
                        color: "var(--text2)",
                      }}
                    >
                      {c.flagged && c.flaggedByName && (
                        <span data-testid={`flag-info-${c.id}`}>
                          🚩 علّمها: <b style={{ color: "#93c5fd" }}>{c.flaggedByName}</b>
                          {c.flaggedAt ? ` · ${formatDateTime(c.flaggedAt)}` : ""}
                        </span>
                      )}
                      {c.completed && c.completedByName && (
                        <span data-testid={`approve-info-${c.id}`}>
                          ✅ اعتمدها: <b style={{ color: "#6ee7b7" }}>{c.completedByName}</b>
                          {c.completedAt ? ` · ${formatDateTime(c.completedAt)}` : ""}
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {canFlag && (
                      <button
                        type="button"
                        className="cmd-action-btn flag"
                        onClick={() => handleToggleFlag(c.id, c.flagged)}
                        data-testid={`btn-flag-${c.id}`}
                        title={c.flagged ? "إلغاء علم التنفيذ" : "علم بأن المهمة تم تنفيذها"}
                      >
                        {c.flagged ? "↩️ إلغاء العلم" : "🚩 علم بالتنفيذ"}
                      </button>
                    )}
                    {canApprove && c.flagged && !c.completed && (
                      <button
                        type="button"
                        className="cmd-action-btn approve"
                        onClick={() => handleToggleComplete(c.id, c.completed)}
                        data-testid={`btn-approve-${c.id}`}
                        title="اعتماد تنفيذ المهمة"
                      >
                        ✅ اعتماد التنفيذ
                      </button>
                    )}
                    {canApprove && c.completed && (
                      <button
                        type="button"
                        className="cmd-action-btn unapprove"
                        onClick={() => handleToggleComplete(c.id, c.completed)}
                        data-testid={`btn-unapprove-${c.id}`}
                        title="إلغاء الاعتماد"
                      >
                        ↩️ إلغاء الاعتماد
                      </button>
                    )}
                    {isFull && (
                      <button
                        className="row-action"
                        onClick={() => handleDelete(c.id)}
                        data-testid={`btn-delete-command-${c.id}`}
                      >
                        🗑️ حذف
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {isFull && view === "stats" && (
        <div className="card">
          <div className="card-title">📊 إحصائيات المهام لكل محاسب</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button
              className={`tab-btn ${statsView === "month" ? "active" : ""}`}
              onClick={() => setStatsView("month")}
              data-testid="stats-month"
            >
              📅 شهري
            </button>
            <button
              className={`tab-btn ${statsView === "year" ? "active" : ""}`}
              onClick={() => setStatsView("year")}
              data-testid="stats-year"
            >
              📆 سنوي
            </button>
          </div>

          {stats.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <div className="empty-text">لا توجد بيانات بعد</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {stats.map((s) => {
                const periods = statsView === "month" ? s.byMonth : s.byYear;
                return (
                  <div
                    key={s.userId}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                    data-testid={`stats-user-${s.userId}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: s.userColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 800,
                        }}
                      >
                        {s.userName.replace("أ/", "").slice(0, 1)}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{s.userName}</div>
                      <span className="badge" style={{ background: "rgba(59,130,246,0.18)", color: "#93c5fd" }}>
                        إجمالي: {s.total}
                      </span>
                      <span className="badge" style={{ background: "rgba(16,185,129,0.18)", color: "#6ee7b7" }}>
                        ✅ منجزة: {s.completed}
                      </span>
                      <span className="badge" style={{ background: "rgba(245,158,11,0.18)", color: "#fcd34d" }}>
                        ⏳ متبقية: {s.pending}
                      </span>
                    </div>

                    {periods.length === 0 ? (
                      <div className="muted" style={{ fontSize: 12, padding: "6px 2px" }}>
                        لم توجه له مهام بعد
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>الفترة</th>
                              <th style={{ width: 110 }}>عدد المهام</th>
                              <th style={{ width: 110 }}>المنجزة</th>
                              <th style={{ width: 110 }}>المتبقية</th>
                              <th style={{ width: 200 }}>نسبة الإنجاز</th>
                            </tr>
                          </thead>
                          <tbody>
                            {periods.map((p) => {
                              const pending = p.total - p.completed;
                              const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                              return (
                                <tr key={p.periodKey} data-testid={`stats-${s.userId}-${p.periodKey}`}>
                                  <td style={{ fontWeight: 700 }}>{p.periodLabel}</td>
                                  <td>{p.total}</td>
                                  <td style={{ color: "#6ee7b7", fontWeight: 700 }}>{p.completed}</td>
                                  <td style={{ color: "#fcd34d" }}>{pending}</td>
                                  <td>
                                    <div
                                      style={{
                                        background: "rgba(255,255,255,0.06)",
                                        borderRadius: 8,
                                        height: 10,
                                        overflow: "hidden",
                                        position: "relative",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: `${pct}%`,
                                          height: "100%",
                                          background: pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444",
                                          transition: "width 0.4s",
                                        }}
                                      />
                                    </div>
                                    <div style={{ fontSize: 11, marginTop: 4, color: "var(--text2)" }}>{pct}%</div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
