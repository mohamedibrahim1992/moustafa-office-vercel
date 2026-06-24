import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, commandsTable, usersTable } from "@workspace/db";
import {
  ListCommandsResponse,
  CreateCommandBody,
  DeleteCommandParams,
  ToggleCommandCompleteBody,
  ToggleCommandCompleteParams,
  ToggleCommandFlagBody,
  ToggleCommandFlagParams,
  GetCommandStatsResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const toDto = (r: typeof commandsTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  flaggedAt: r.flaggedAt ? r.flaggedAt.toISOString() : null,
  completedAt: r.completedAt ? r.completedAt.toISOString() : null,
});

router.get("/commands", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(commandsTable)
    .orderBy(desc(commandsTable.createdAt));
  res.json(ListCommandsResponse.parse(rows.map(toDto)));
});

router.get(
  "/commands/stats",
  requireRole("admin", "manager"),
  async (_req, res): Promise<void> => {
    const users = await db.select().from(usersTable);
    const cmds = await db.select().from(commandsTable);

    const monthLabel = (d: Date) => {
      const months = [
        "يناير",
        "فبراير",
        "مارس",
        "أبريل",
        "مايو",
        "يونيو",
        "يوليو",
        "أغسطس",
        "سبتمبر",
        "أكتوبر",
        "نوفمبر",
        "ديسمبر",
      ];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const stats = users
      .filter((u) => u.role !== "admin")
      .map((u) => {
        const userCmds = cmds.filter((c) => c.target === String(u.id));
        const completed = userCmds.filter((c) => c.completed).length;

        const monthMap = new Map<
          string,
          { periodKey: string; periodLabel: string; total: number; completed: number }
        >();
        const yearMap = new Map<
          string,
          { periodKey: string; periodLabel: string; total: number; completed: number }
        >();

        for (const c of userCmds) {
          const d = new Date(c.createdAt);
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const yKey = String(d.getFullYear());

          if (!monthMap.has(mKey)) {
            monthMap.set(mKey, {
              periodKey: mKey,
              periodLabel: monthLabel(d),
              total: 0,
              completed: 0,
            });
          }
          const m = monthMap.get(mKey)!;
          m.total++;
          if (c.completed) m.completed++;

          if (!yearMap.has(yKey)) {
            yearMap.set(yKey, {
              periodKey: yKey,
              periodLabel: `سنة ${yKey}`,
              total: 0,
              completed: 0,
            });
          }
          const y = yearMap.get(yKey)!;
          y.total++;
          if (c.completed) y.completed++;
        }

        const byMonth = [...monthMap.values()].sort((a, b) =>
          b.periodKey.localeCompare(a.periodKey),
        );
        const byYear = [...yearMap.values()].sort((a, b) =>
          b.periodKey.localeCompare(a.periodKey),
        );

        return {
          userId: u.id,
          userName: u.name,
          userColor: u.color,
          total: userCmds.length,
          completed,
          pending: userCmds.length - completed,
          byMonth,
          byYear,
        };
      });

    res.json(GetCommandStatsResponse.parse(stats));
  },
);

router.post(
  "/commands",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateCommandBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .insert(commandsTable)
      .values({
        text: parsed.data.text,
        priority: parsed.data.priority ?? "normal",
        target: parsed.data.target ?? "all",
        fromId: req.session.userId ?? null,
        fromName: req.session.userName ?? "النظام",
      })
      .returning();
    res.status(201).json(toDto(row));
  },
);

router.patch(
  "/commands/:id/flag",
  async (req, res): Promise<void> => {
    const params = ToggleCommandFlagParams.safeParse(req.params);
    const body = ToggleCommandFlagBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(commandsTable)
      .where(eq(commandsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "المهمة غير موجودة" });
      return;
    }
    const sessionUserId = req.session.userId ?? null;
    const sessionRole = req.session.userRole ?? "";
    const isPrivileged = sessionRole === "admin" || sessionRole === "manager";
    // Only the assignee (target user, or anyone if target=all and not the sender) can flag
    const isTarget =
      existing.target === String(sessionUserId) ||
      (existing.target === "all" && existing.fromId !== sessionUserId);
    if (!isPrivileged && !isTarget) {
      res.status(403).json({ error: "هذه المهمة ليست موجهة إليك" });
      return;
    }
    if (existing.completed) {
      res
        .status(409)
        .json({ error: "المهمة معتمدة بالفعل من المرسل ولا يمكن تعديل علم التنفيذ" });
      return;
    }
    const [row] = await db
      .update(commandsTable)
      .set({
        flagged: body.data.flagged,
        flaggedAt: body.data.flagged ? new Date() : null,
        flaggedById: body.data.flagged ? sessionUserId : null,
        flaggedByName: body.data.flagged ? (req.session.userName ?? null) : null,
      })
      .where(eq(commandsTable.id, params.data.id))
      .returning();
    res.json(toDto(row));
  },
);

router.patch(
  "/commands/:id/complete",
  async (req, res): Promise<void> => {
    const params = ToggleCommandCompleteParams.safeParse(req.params);
    const body = ToggleCommandCompleteBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(commandsTable)
      .where(eq(commandsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "المهمة غير موجودة" });
      return;
    }
    const sessionUserId = req.session.userId ?? null;
    const sessionRole = req.session.userRole ?? "";
    const isAdmin = sessionRole === "admin";
    const isSender = existing.fromId !== null && existing.fromId === sessionUserId;
    // Only the original sender (or admin) can approve / un-approve
    if (!isAdmin && !isSender) {
      res.status(403).json({ error: "اعتماد التنفيذ متاح فقط لمن أرسل المهمة" });
      return;
    }
    // To approve, the assignee must have flagged it as done first
    if (body.data.completed && !existing.flagged) {
      res
        .status(409)
        .json({ error: "لا يمكن اعتماد التنفيذ قبل أن يعلم المستلم بإنجاز المهمة" });
      return;
    }
    const [row] = await db
      .update(commandsTable)
      .set({
        completed: body.data.completed,
        completedAt: body.data.completed ? new Date() : null,
        completedById: body.data.completed ? sessionUserId : null,
        completedByName: body.data.completed
          ? (req.session.userName ?? null)
          : null,
      })
      .where(eq(commandsTable.id, params.data.id))
      .returning();
    res.json(toDto(row));
  },
);

router.delete(
  "/commands/:id",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = DeleteCommandParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db.delete(commandsTable).where(eq(commandsTable.id, params.data.id));
    res.sendStatus(204);
  },
);

export default router;
