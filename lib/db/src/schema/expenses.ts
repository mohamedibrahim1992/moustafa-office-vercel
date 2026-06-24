import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  integer,
} from "drizzle-orm/pg-core";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  item: text("item").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  category: text("category", {
    enum: ["رواتب", "ايجار مكتب", "كهرباء", "انترنت", "مصاريف تشغيلية"],
  }).notNull(),
  clientId: integer("client_id"),
  clientName: text("client_name"),
  notes: text("notes"),
  addedById: integer("added_by_id"),
  addedByName: text("added_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ExpenseRow = typeof expensesTable.$inferSelect;
