import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const declarationsTable = pgTable(
  "declarations",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull(),
    type: text("type", { enum: ["income", "vat"] }).notNull(),
    periodKey: text("period_key").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedById: integer("completed_by_id"),
    completedByName: text("completed_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("declarations_client_type_period_uniq").on(
      t.clientId,
      t.type,
      t.periodKey,
    ),
  }),
);

export type DeclarationRow = typeof declarationsTable.$inferSelect;
