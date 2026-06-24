import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  useGetMe,
  useLogout,
  useListCommands,
  getListCommandsQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

import { NotifyProvider, useNotify } from "@/lib/notify";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import InvoicesPage from "@/pages/invoices";
import ExpensesPage from "@/pages/expenses";
import ReportsPage from "@/pages/reports";
import CommandsPage from "@/pages/commands";
import DeclarationsPage from "@/pages/declarations";
import AllDataPage from "@/pages/alldata";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000,
    },
  },
});

type NavItem = {
  key: string;
  path: string;
  icon: string;
  label: string;
  roles: string[];
};

const FULL_ACCESS = ["admin", "manager"];
// All accountant roles get the same working features as admin/manager
// across clients/invoices/expenses/reports/declarations/commands.
const ALL_ROLES = [...FULL_ACCESS, "clients", "invoices", "expenses", "reports"];
const EXPENSES_REPORTS_ROLES = [...FULL_ACCESS];

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", path: "/", icon: "📊", label: "لوحة التحكم", roles: [...FULL_ACCESS] },
  { key: "clients", path: "/clients", icon: "👥", label: "العملاء", roles: [...ALL_ROLES] },
  { key: "invoices", path: "/invoices", icon: "🧾", label: "الفواتير", roles: [...ALL_ROLES] },
  { key: "expenses", path: "/expenses", icon: "💸", label: "المصروفات", roles: [...EXPENSES_REPORTS_ROLES] },
  { key: "reports", path: "/reports", icon: "📈", label: "التقارير", roles: [...EXPENSES_REPORTS_ROLES] },
  { key: "declarations", path: "/declarations", icon: "📑", label: "الإقرارات", roles: [...ALL_ROLES] },
  { key: "commands", path: "/commands", icon: "📋", label: "المهام", roles: [...ALL_ROLES] },
  { key: "alldata", path: "/alldata", icon: "🗄️", label: "كل البيانات", roles: [...FULL_ACCESS] },
];

function defaultPathForRole(role: string): string {
  if (FULL_ACCESS.includes(role)) return "/";
  const item = NAV_ITEMS.find((n) => n.roles.includes(role) && n.key !== "commands");
  return item?.path ?? "/commands";
}

function CommandsWatcher({ user }: { user: User }) {
  const notify = useNotify();
  const lastSeenIdRef = useRef<number | null>(null);
  const initRef = useRef(false);

  const { data: commands } = useListCommands({
    query: {
      queryKey: getListCommandsQueryKey(),
      refetchInterval: 4000,
    },
  });

  useEffect(() => {
    if (!commands) return;
    if (!initRef.current) {
      initRef.current = true;
      lastSeenIdRef.current = commands.length > 0 ? commands[0].id : 0;
      return;
    }
    const newOnes = commands.filter(
      (c) => lastSeenIdRef.current !== null && c.id > lastSeenIdRef.current,
    );
    if (newOnes.length > 0) {
      newOnes
        .filter((c) => c.target === "all" || c.target === String(user.id) || FULL_ACCESS.includes(user.role))
        .forEach((c) => {
          notify(`📢 ${c.fromName}: ${c.text.slice(0, 60)}${c.text.length > 60 ? "..." : ""}`, "info");
        });
      lastSeenIdRef.current = commands[0].id;
    }
  }, [commands, notify, user.id, user.role]);

  return null;
}

function Sidebar({ user }: { user: User }) {
  const [location, setLocation] = useLocation();
  const qc = useQueryClient();
  const notify = useNotify();
  const { mutate: logout } = useLogout();

  const { data: commands } = useListCommands({
    query: { queryKey: getListCommandsQueryKey(), refetchInterval: 4000 },
  });

  const cmdCount = commands?.length ?? 0;
  const [seenCmdCount, setSeenCmdCount] = useState<number>(cmdCount);
  useEffect(() => {
    if (location === "/commands") setSeenCmdCount(cmdCount);
  }, [location, cmdCount]);

  const unread = Math.max(0, cmdCount - seenCmdCount);

  const items = NAV_ITEMS.filter((n) => n.roles.includes(user.role));

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        qc.removeQueries();
        qc.setQueryData(getGetMeQueryKey(), null);
        notify("تم تسجيل الخروج", "info");
        setLocation("/login");
      },
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <div className="brand-icon">🏢</div>
          <div>
            <div className="brand-name">مكتب مصطفى حمزة</div>
            <div className="brand-sub">للمحاسبة والضرائب</div>
          </div>
        </div>
        <div className="user-chip" data-testid="user-chip">
          <div className="user-avatar" style={{ background: user.color }}>
            {(user.name ?? "?").slice(0, 1)}
          </div>
          <div className="user-chip-text">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
        </div>
      </div>

      <nav className="nav">
        {items.map((item) => {
          const active = location === item.path || (item.path === "/" && location === "");
          return (
            <button
              key={item.key}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => setLocation(item.path)}
              data-testid={`nav-${item.key}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.key === "commands" && unread > 0 && (
                <span className="nav-badge">{unread}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: 11, color: "var(--text2)", textAlign: "center", marginBottom: 10 }}>
          <span className="live-dot"></span> متصل بالخادم مباشرة
        </div>
        <ThemeToggle />
        <button className="btn-logout" onClick={handleLogout} data-testid="btn-logout">
          🚪 تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("mh.theme") as "dark" | "light") || "dark";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mh.theme", theme);
  }, [theme]);
  return (
    <button
      type="button"
      className="btn-theme"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      data-testid="btn-theme-toggle"
    >
      {theme === "dark" ? "🌞 الوضع الفاتح" : "🌙 الوضع الغامق"}
    </button>
  );
}

function AppShell({ user }: { user: User }) {
  return (
    <>
      <CommandsWatcher user={user} />
      <div className="layout">
        <Sidebar user={user} />
        <main className="main fade-in-page">
          <Switch>
            <Route path="/">
              {FULL_ACCESS.includes(user.role) ? <DashboardPage /> : <Redirect to={defaultPathForRole(user.role)} />}
            </Route>
            <Route path="/clients">
              {NAV_ITEMS.find((n) => n.key === "clients")!.roles.includes(user.role) ? (
                <ClientsPage user={user} />
              ) : (
                <Redirect to={defaultPathForRole(user.role)} />
              )}
            </Route>
            <Route path="/invoices">
              {NAV_ITEMS.find((n) => n.key === "invoices")!.roles.includes(user.role) ? (
                <InvoicesPage user={user} />
              ) : (
                <Redirect to={defaultPathForRole(user.role)} />
              )}
            </Route>
            <Route path="/expenses">
              {NAV_ITEMS.find((n) => n.key === "expenses")!.roles.includes(user.role) ? (
                <ExpensesPage user={user} />
              ) : (
                <Redirect to={defaultPathForRole(user.role)} />
              )}
            </Route>
            <Route path="/reports">
              {NAV_ITEMS.find((n) => n.key === "reports")!.roles.includes(user.role) ? (
                <ReportsPage user={user} />
              ) : (
                <Redirect to={defaultPathForRole(user.role)} />
              )}
            </Route>
            <Route path="/commands">
              <CommandsPage user={user} />
            </Route>
            <Route path="/declarations">
              {NAV_ITEMS.find((n) => n.key === "declarations")!.roles.includes(user.role) ? (
                <DeclarationsPage user={user} />
              ) : (
                <Redirect to={defaultPathForRole(user.role)} />
              )}
            </Route>
            <Route path="/alldata">
              {FULL_ACCESS.includes(user.role) ? <AllDataPage /> : <Redirect to={defaultPathForRole(user.role)} />}
            </Route>
            <Route>
              <Redirect to={defaultPathForRole(user.role)} />
            </Route>
          </Switch>
        </main>
      </div>
    </>
  );
}

function AuthGate() {
  const [location, setLocation] = useLocation();
  const { data: me, isLoading, error } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });

  useEffect(() => {
    if (!isLoading && error && location !== "/login") {
      setLocation("/login");
    }
    if (!isLoading && me && location === "/login") {
      setLocation(defaultPathForRole(me.role));
    }
  }, [isLoading, error, me, location, setLocation]);

  if (isLoading) {
    return (
      <div className="loader-page">
        <div className="loader" />
      </div>
    );
  }

  if (location === "/login" || !me) {
    return <LoginPage />;
  }

  return <AppShell user={me} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotifyProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate />
        </WouterRouter>
      </NotifyProvider>
    </QueryClientProvider>
  );
}

export default App;
