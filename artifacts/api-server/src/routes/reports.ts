import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, reportsTable } from "@workspace/db";
import {
  ListReportsResponse,
  CreateReportBody,
  DeleteReportParams,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const toDto = (r: typeof reportsTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
});

router.get("/reports", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(reportsTable)
    .orderBy(desc(reportsTable.createdAt));
  res.json(ListReportsResponse.parse(rows.map(toDto)));
});

router.post(
  "/reports",
  requireRole("clients", "invoices", "expenses", "reports"),
  async (req, res): Promise<void> => {
    const parsed = CreateReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .insert(reportsTable)
      .values({
        title: parsed.data.title,
        period: parsed.data.period ?? null,
        summary: parsed.data.summary,
        addedById: req.session.userId ?? null,
        addedByName: req.session.userName ?? null,
      })
      .returning();
    res.status(201).json(toDto(row));
  },
);

router.delete(
  "/reports/:id",
  requireRole("clients", "invoices", "expenses", "reports"),
  async (req, res): Promise<void> => {
    const params = DeleteReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db.delete(reportsTable).where(eq(reportsTable.id, params.data.id));
    res.sendStatus(204);
  },
);

export default router;
