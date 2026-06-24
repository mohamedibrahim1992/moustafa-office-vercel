import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, invoicesTable, customersTable } from "@workspace/db";
import {
  ListInvoicesResponse,
  CreateInvoiceBody,
  UpdateInvoiceBody,
  UpdateInvoiceParams,
  DeleteInvoiceParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const toDto = (r: typeof invoicesTable.$inferSelect) => ({
  ...r,
  amount: Number(r.amount),
  createdAt: r.createdAt.toISOString(),
});

// All working roles (admin/manager + 5 accountants) see ALL invoices now.
router.get("/invoices", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(invoicesTable)
    .orderBy(desc(invoicesTable.createdAt));
  res.json(ListInvoicesResponse.parse(rows.map(toDto)));
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, parsed.data.clientId));
  if (!client) {
    res.status(404).json({ error: "العميل غير موجود" });
    return;
  }
  const [row] = await db
    .insert(invoicesTable)
    .values({
      clientId: client.id,
      clientName: client.name,
      amount: String(parsed.data.amount),
      status: parsed.data.status,
      description: parsed.data.description ?? null,
      addedById: req.session.userId ?? null,
      addedByName: req.session.userName ?? null,
    })
    .returning();
  res.status(201).json(toDto(row));
});

// Only admin/manager can edit any invoice (amount/status/description).
router.patch(
  "/invoices/:id",
  requireRole("admin", "manager"),
  async (req, res): Promise<void> => {
    const params = UpdateInvoiceParams.safeParse(req.params);
    const body = UpdateInvoiceBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: !params.success ? params.error.message : body.error?.message ?? "invalid body",
      });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (body.data.amount !== undefined) patch.amount = String(body.data.amount);
    if (body.data.status !== undefined) patch.status = body.data.status;
    if (body.data.description !== undefined) patch.description = body.data.description;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "لا توجد بيانات للتحديث" });
      return;
    }
    const [row] = await db
      .update(invoicesTable)
      .set(patch)
      .where(eq(invoicesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "الفاتورة غير موجودة" });
      return;
    }
    res.json(toDto(row));
  },
);

// All working roles can delete any invoice now.
router.delete("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
