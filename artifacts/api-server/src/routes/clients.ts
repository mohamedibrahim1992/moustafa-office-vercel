import { Router, type IRouter } from "express";
import { eq, desc, sql, or, and, ne } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  ListClientsResponse,
  CreateClientBody,
  UpdateClientBody,
  UpdateClientParams,
  DeleteClientParams,
  ImportClientsBody,
  CheckClientDuplicatesBody,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const toDto = (r: typeof customersTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
});

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase();

type DupRow = {
  id: number;
  name: string;
  taxNumber: string | null;
};

async function findDuplicate(opts: {
  name: string;
  taxNumber?: string | null;
  excludeId?: number;
}): Promise<{ row: DupRow; field: "name" | "taxNumber" } | null> {
  const nameNorm = norm(opts.name);
  const taxNorm = (opts.taxNumber ?? "").trim();
  const conditions: any[] = [];
  if (nameNorm) {
    conditions.push(sql`lower(trim(${customersTable.name})) = ${nameNorm}`);
  }
  if (taxNorm) {
    conditions.push(sql`trim(${customersTable.taxNumber}) = ${taxNorm}`);
  }
  if (conditions.length === 0) return null;
  const where =
    opts.excludeId !== undefined
      ? and(or(...conditions), ne(customersTable.id, opts.excludeId))
      : or(...conditions);
  const rows = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      taxNumber: customersTable.taxNumber,
    })
    .from(customersTable)
    .where(where);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (taxNorm && (row.taxNumber ?? "").trim() === taxNorm) {
    return { row, field: "taxNumber" };
  }
  return { row, field: "name" };
}

router.get("/clients", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(customersTable)
    .orderBy(desc(customersTable.createdAt));
  res.json(ListClientsResponse.parse(rows.map(toDto)));
});

router.post(
  "/clients",
  requireRole("clients", "invoices", "expenses", "reports"),
  async (req, res): Promise<void> => {
    const parsed = CreateClientBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const dup = await findDuplicate({ name: d.name, taxNumber: d.taxNumber });
    if (dup) {
      const message =
        dup.field === "taxNumber"
          ? `الرقم الضريبي "${dup.row.taxNumber}" مسجل بالفعل للعميل "${dup.row.name}"`
          : `يوجد عميل بنفس الاسم "${dup.row.name}" مسجل بالفعل`;
      res
        .status(409)
        .json({ error: message, field: dup.field, existingId: dup.row.id });
      return;
    }
    const [row] = await db
      .insert(customersTable)
      .values({
        name: d.name,
        taxNumber: d.taxNumber ?? null,
        entityType: d.entityType ?? null,
        vatStatus: d.vatStatus ?? null,
        username: d.username ?? null,
        password: d.password ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        nationalId: d.nationalId ?? null,
        eInvoiceEmail: d.eInvoiceEmail ?? null,
        eInvoicePassword: d.eInvoicePassword ?? null,
        registrationDate: d.registrationDate ?? null,
        taxCardExpiry: d.taxCardExpiry ?? null,
        taxPortalExpiry: d.taxPortalExpiry ?? null,
        tokenExpiry: d.tokenExpiry ?? null,
        appealCommitteeDate: d.appealCommitteeDate ?? null,
        notes: d.notes ?? null,
        addedById: req.session.userId ?? null,
        addedByName: req.session.userName ?? null,
      })
      .returning();
    res.status(201).json(toDto(row));
  },
);

router.patch(
  "/clients/:id",
  requireRole("clients", "invoices", "expenses", "reports"),
  async (req, res): Promise<void> => {
    const params = UpdateClientParams.safeParse(req.params);
    const body = UpdateClientBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: !params.success ? params.error.message : body.error?.message ?? "invalid body",
      });
      return;
    }
    if (body.data.name || body.data.taxNumber) {
      const dup = await findDuplicate({
        name: body.data.name ?? "",
        taxNumber: body.data.taxNumber,
        excludeId: params.data.id,
      });
      if (dup) {
        const message =
          dup.field === "taxNumber"
            ? `الرقم الضريبي "${dup.row.taxNumber}" مسجل بالفعل للعميل "${dup.row.name}"`
            : `يوجد عميل آخر بنفس الاسم "${dup.row.name}"`;
        res
          .status(409)
          .json({ error: message, field: dup.field, existingId: dup.row.id });
        return;
      }
    }
    const [row] = await db
      .update(customersTable)
      .set(body.data)
      .where(eq(customersTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "العميل غير موجود" });
      return;
    }
    res.json(toDto(row));
  },
);

router.post(
  "/clients/check-duplicates",
  requireRole("clients", "invoices", "expenses", "reports"),
  async (req, res): Promise<void> => {
    const parsed = CheckClientDuplicatesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const items = parsed.data.clients;

    const existing = await db
      .select({ name: customersTable.name, taxNumber: customersTable.taxNumber })
      .from(customersTable);
    const existingNames = new Set(existing.map((e) => norm(e.name)));
    const existingTax = new Set(
      existing.map((e) => (e.taxNumber ?? "").trim()).filter((t) => t.length > 0),
    );

    const result: Array<{ name: string; reason: string; inBatch: boolean }> = [];
    const seenNames = new Set<string>();
    const seenTax = new Set<string>();

    for (const d of items) {
      const nameKey = norm(d.name);
      const taxKey = (d.taxNumber ?? "").trim();

      let reason: string | null = null;
      let inBatch = false;

      if (nameKey && existingNames.has(nameKey)) {
        reason = "الاسم موجود بالفعل في قاعدة البيانات";
      } else if (nameKey && seenNames.has(nameKey)) {
        reason = "الاسم مكرر داخل الملف نفسه";
        inBatch = true;
      } else if (taxKey && existingTax.has(taxKey)) {
        reason = "الرقم الضريبي موجود بالفعل في قاعدة البيانات";
      } else if (taxKey && seenTax.has(taxKey)) {
        reason = "الرقم الضريبي مكرر داخل الملف نفسه";
        inBatch = true;
      }

      if (reason) {
        result.push({ name: d.name, reason, inBatch });
      } else {
        if (nameKey) seenNames.add(nameKey);
        if (taxKey) seenTax.add(taxKey);
      }
    }

    res.json({ duplicates: result });
  },
);

router.post(
  "/clients/import",
  requireRole("clients", "invoices", "expenses", "reports"),
  async (req, res): Promise<void> => {
    const parsed = ImportClientsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const items = parsed.data.clients;
    // Names user explicitly approved to insert even if duplicate
    const forceSet = new Set(
      (parsed.data.forceNames ?? []).map((n) => norm(n)),
    );

    if (items.length === 0) {
      res.json({ inserted: 0, skipped: 0, duplicates: [] });
      return;
    }

    const existing = await db
      .select({ name: customersTable.name, taxNumber: customersTable.taxNumber })
      .from(customersTable);
    const existingNames = new Set(existing.map((e) => norm(e.name)));
    const existingTax = new Set(
      existing.map((e) => (e.taxNumber ?? "").trim()).filter((t) => t.length > 0),
    );

    const toInsert: typeof items = [];
    const duplicates: string[] = [];
    const seenNames = new Set<string>();
    const seenTax = new Set<string>();

    for (const d of items) {
      const nameKey = norm(d.name);
      const taxKey = (d.taxNumber ?? "").trim();
      const isForced = forceSet.has(nameKey);

      const dupReason =
        nameKey && (existingNames.has(nameKey) || seenNames.has(nameKey))
          ? "الاسم"
          : taxKey && (existingTax.has(taxKey) || seenTax.has(taxKey))
            ? "الرقم الضريبي"
            : null;

      if (dupReason && !isForced) {
        duplicates.push(`${d.name} (${dupReason} مكرر)`);
        continue;
      }
      toInsert.push(d);
      // Only track in seen-sets if NOT forced, so forced duplicates don't block each other
      if (!isForced) {
        if (nameKey) seenNames.add(nameKey);
        if (taxKey) seenTax.add(taxKey);
      }
    }

    let insertedCount = 0;
    if (toInsert.length > 0) {
      const inserted = await db
        .insert(customersTable)
        .values(
          toInsert.map((d) => ({
            name: d.name,
            taxNumber: d.taxNumber ?? null,
            entityType: d.entityType ?? null,
            vatStatus: d.vatStatus ?? null,
            username: d.username ?? null,
            password: d.password ?? null,
            email: d.email ?? null,
            phone: d.phone ?? null,
            nationalId: d.nationalId ?? null,
            eInvoiceEmail: d.eInvoiceEmail ?? null,
            eInvoicePassword: d.eInvoicePassword ?? null,
            registrationDate: d.registrationDate ?? null,
            taxCardExpiry: d.taxCardExpiry ?? null,
            taxPortalExpiry: d.taxPortalExpiry ?? null,
            tokenExpiry: d.tokenExpiry ?? null,
            appealCommitteeDate: d.appealCommitteeDate ?? null,
            notes: d.notes ?? null,
            addedById: req.session.userId ?? null,
            addedByName: req.session.userName ?? null,
          })),
        )
        .returning();
      insertedCount = inserted.length;
    }

    res.json({ inserted: insertedCount, skipped: duplicates.length, duplicates });
  },
);

router.delete(
  "/clients/:id",
  requireRole("clients", "invoices", "expenses", "reports"),
  async (req, res): Promise<void> => {
    const params = DeleteClientParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .delete(customersTable)
      .where(eq(customersTable.id, params.data.id));
    res.sendStatus(204);
  },
);

export default router;
