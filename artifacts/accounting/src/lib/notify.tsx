import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type NotifType = "success" | "error" | "info";
type Notif = { id: number; msg: string; type: NotifType };

const NotifyContext = createContext<(msg: string, type?: NotifType) => void>(
  () => {},
);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notif[]>([]);

  const notify = useCallback((msg: string, type: NotifType = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const icons: Record<NotifType, string> = { success: "✅", error: "❌", info: "ℹ️" };

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <div className="notif-container">
        {items.map((n) => (
          <div key={n.id} className={`notif ${n.type}`} data-testid={`notif-${n.type}`}>
            <span>{icons[n.type]}</span>
            <span>{n.msg}</span>
          </div>
        ))}
      </div>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotifyContext);
}
