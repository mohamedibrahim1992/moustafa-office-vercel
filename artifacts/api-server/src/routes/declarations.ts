import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, customersTable, declarationsTable } from "@workspace/db";
import {
  ListDeclarationsResponse,
  ToggleDeclarationBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

type DeclItem = {
  clientId: number;
  clientName: string;
  entityType: "فردي" | "شركة" | null;
  vatStatus: "نعم" | "لا" | "ربع سنوي" | null;
  type: "income" | "vat";
  periodKey: string;
  periodLabel: string;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  completedByName: string | null;
};

function generateForClient(
  client: typeof customersTable.$inferSelect,
  year: number,
): Array<Omit<DeclItem, "completed" | "completedAt" | "completedByName">> {
  const items: Array<
    Omit<DeclItem, "completed" | "completedAt" | "completedByName">
  > = [];

  // Income tax declaration
  if (client.entityType === "فردي") {
    items.push({
      clientId: client.id,
      clientName: client.name,
      entityType: client.entityType,
      vatStatus: client.vatStatus,
      type: "income",
      periodKey: `income-${year}`,
      periodLabel: `إقرار ضريبة الدخل ${year} (1/1 - 31/3)`,
      dueDate: `${year}-03-31`,
    });
  } else if (client.entityType === "شركة") {
    items.push({
      clientId: client.id,
      clientName: client.name,
      entityType: client.entityType,
      vatStatus: client.vatStatus,
      type: "income",
      periodKey: `income-${year}`,
      periodLabel: `إقرار ضريبة الدخل ${year} (1/1 - 30/4)`,
      dueDate: `${year}-04-30`,
    });
  }

  // VAT declaration
  if (client.vatStatus === "نعم") {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const lastDay = new Date(year, m, 0).getDate();
      items.push({
        clientId: client.id,
        clientName: client.name,
        entityType: client.entityType,
        vatStatus: client.vatStatus,
        type: "vat",
        periodKey: `vat-${year}-${mm}`,
        periodLabel: `إقرار ق.م شهري ${mm}/${year}`,
        dueDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
      });
    }
  } else if (client.vatStatus === "ربع سنوي") {
    const quarters: Array<{ q: number; endMonth: number }> = [
      { q: 1, endMonth: 3 },
      { q: 2, endMonth: 6 },
      { q: 3, endMonth: 9 },
      { q: 4, endMonth: 12 },
    ];
    for (const { q, endMonth } of quarters) {
      const lastDay = new Date(year, endMonth, 0).getDate();
      items.push({
        clientId: client.id,
        clientName: client.name,
        entityType: client.entityType,
        vatStatus: client.vatStatus,
        type: "vat",
        periodKey: `vat-${year}-Q${q}`,
        periodLabel: `إقرار ق.م ربع سنوي - الربع ${q} ${year}`,
        dueDate: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      });
    }
  }

  return items;
}

router.get("/declarations", async (_req, res): Promise<void> => {
  const clients = await db.select().from(customersTable);
  const completedRows = await db.select().from(declarationsTable);
  const completedMap = new Map<string, (typeof completedRows)[number]>();
  for (const r of completedRows) {
    completedMap.set(`${r.clientId}|${r.type}|${r.periodKey}`, r);
  }
  const year = new Date().getFullYear();
  const items: DeclItem[] = [];
  for (const c of clients) {
    for (const gen of generateForClient(c, year)) {
      const found = completedMap.get(
        `${gen.clientId}|${gen.type}|${gen.periodKey}`,
      );
      items.push({
        ...gen,
        completed: !!found?.completedAt,
        completedAt: found?.completedAt?.toISOString() ?? null,
        completedByName: found?.completedByName ?? null,
      });
    }
  }
  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  res.json(ListDeclarationsResponse.parse(items));
});

router.post("/declarations/toggle", async (req, res): Promise<void> => {
  const parsed = ToggleDeclarationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { clientId, type, periodKey, completed } = parsed.data;
  const [client] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, clientId));
  if (!client) {
    res.status(404).json({ error: "العميل غير موجود" });
    return;
  }
  if (completed) {
    await db
      .insert(declarationsTable)
      .values({
        clientId,
        type,
        periodKey,
        completedAt: new Date(),
        completedById: req.session.userId ?? null,
        completedByName: req.session.userName ?? null,
      })
      .onConflictDoUpdate({
        target: [
          declarationsTable.clientId,
          declarationsTable.type,
          declarationsTable.periodKey,
        ],
        set: {
          completedAt: new Date(),
          completedById: req.session.userId ?? null,
          completedByName: req.session.userName ?? null,
        },
      });
  } else {
    await db
      .delete(declarationsTable)
      .where(
        and(
          eq(declarationsTable.clientId, clientId),
          eq(declarationsTable.type, type),
          eq(declarationsTable.periodKey, periodKey),
        ),
      );
  }
  // Regenerate item for response
  const year = new Date().getFullYear();
  const generated = generateForClient(client, year).find(
    (g) => g.type === type && g.periodKey === periodKey,
  );
  if (!generated) {
    res.status(404).json({ error: "الإقرار غير موجود" });
    return;
  }
  res.json({
    ...generated,
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    completedByName: completed ? (req.session.userName ?? null) : null,
  });
});

export default router;
