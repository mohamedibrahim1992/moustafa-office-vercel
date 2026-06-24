import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  ListAuthUsersResponse,
  LoginBody,
  LoginResponse,
  GetMeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/auth/users", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      role: usersTable.role,
      color: usersTable.color,
    })
    .from(usersTable)
    .orderBy(asc(usersTable.id));
  res.json(ListAuthUsersResponse.parse(rows));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parsed.data.userId));
  if (!user || user.password !== parsed.data.password) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }
  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;
  req.session.userColor = user.color;
  res.json(
    LoginResponse.parse({
      id: user.id,
      name: user.name,
      role: user.role,
      color: user.color,
    }),
  );
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

router.get("/auth/me", (req, res): void => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(
    GetMeResponse.parse({
      id: req.session.userId,
      name: req.session.userName,
      role: req.session.userRole,
      color: req.session.userColor,
    }),
  );
});

export default router;
