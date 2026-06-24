import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userName?: string;
    userRole?: "admin" | "manager" | "clients" | "invoices" | "expenses" | "reports";
    userColor?: string;
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// All accountant roles are now equal in working features.
// Only "admin" / "manager" remain special (sending tasks, marking complete,
// reading stats, etc).
export function requireRole(
  ...allowed: Array<"admin" | "manager" | "clients" | "invoices" | "expenses" | "reports">
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.session.userRole;
    if (!role) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    // admin/manager always pass
    if (role === "admin" || role === "manager") {
      next();
      return;
    }
    if (!allowed.includes(role)) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    next();
  };
}

// Convenience: any logged-in working role (all 5 accountants + admin/manager)
export const WORK_ROLES = [
  "admin",
  "manager",
  "clients",
  "invoices",
  "expenses",
  "reports",
] as const;
