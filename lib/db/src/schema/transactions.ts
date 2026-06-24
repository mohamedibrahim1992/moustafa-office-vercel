import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  integer,
} from "drizzle-orm/pg-core";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  method: text("method", { enum: ["cash", "bank", "card"] }).notNull(),
  relatedInvoiceId: integer("related_invoice_id"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TransactionRow = typeof transactionsTable.$inferSelect;
