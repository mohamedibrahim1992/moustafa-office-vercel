import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAuthUsers,
  useLogin,
  getGetMeQueryKey,
  getListAuthUsersQueryKey,
} from "@workspace/api-client-react";

const FULL_ACCESS = ["admin", "manager"];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { data: users = [], isLoading, refetch } = useListAuthUsers({
    query: {
      queryKey: getListAuthUsersQueryKey(),
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  const { mutate: login, isPending } = useLogin();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!userId) {
      setError("اختر مستخدماً");
      return;
    }
    login(
      { data: { userId: Number(userId), password } },
      {
        onSuccess: (user) => {
          qc.setQueryData(getGetMeQueryKey(), user);
          if (FULL_ACCESS.includes(user.role)) {
            setLocation("/");
          } else {
            setLocation(`/${user.role}`);
          }
        },
        onError: () => setError("بيانات الدخول غير صحيحة"),
      },
    );
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">🏢</div>
        <div className="login-title">مكتب مصطفى حمزة</div>
        <div className="login-sub">نظام إدارة المحاسبة المتكامل</div>

        {error && <div className="error-msg" data-testid="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>اختر المستخدم</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              data-testid="select-user"
            >
              <option value="">-- اختر اسمك --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {isLoading && <div className="muted" style={{ marginTop: 8 }}>جاري تحميل المستخدمين...</div>}
          </div>

          <div className="field">
            <label>كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••"
              autoComplete="current-password"
              data-testid="input-password"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={isPending} data-testid="btn-login">
            {isPending ? "..." : "🔐 دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
