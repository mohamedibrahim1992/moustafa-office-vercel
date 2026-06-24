import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, expensesTable, customersTable } from "@workspace/db";
import {
  ListExpensesResponse,
  CreateExpenseBody,
  DeleteExpenseParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const toDto = (r: typeof expensesTable.$inferSelect) => ({
  ...r,
  amount: Number(r.amount),
  createdAt: r.createdAt.toISOString(),
});

// All working roles see ALL expenses now.
router.get("/expenses", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(expensesTable)
    .orderBy(desc(expensesTable.createdAt));
  res.json(ListExpensesResponse.parse(rows.map(toDto)));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let clientName: string | null = null;
  if (parsed.data.clientId) {
    const [c] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, parsed.data.clientId));
    clientName = c?.name ?? null;
  }
  const [row] = await db
    .insert(expensesTable)
    .values({
      item: parsed.data.item,
      amount: String(parsed.data.amount),
      category: parsed.data.category,
      clientId: parsed.data.clientId ?? null,
      clientName,
      notes: parsed.data.notes ?? null,
      addedById: req.session.userId ?? null,
      addedByName: req.session.userName ?? null,
    })
    .returning();
  res.status(201).json(toDto(row));
});

// All working roles can delete any expense now.
router.delete("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(expensesTable).where(eq(expensesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
