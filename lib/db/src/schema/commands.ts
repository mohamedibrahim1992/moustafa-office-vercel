import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const commandsTable = pgTable("commands", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  priority: text("priority", { enum: ["normal", "urgent", "info"] })
    .notNull()
    .default("normal"),
  target: text("target").notNull().default("all"),
  fromId: integer("from_id"),
  fromName: text("from_name").notNull(),
  flagged: boolean("flagged").notNull().default(false),
  flaggedAt: timestamp("flagged_at", { withTimezone: true }),
  flaggedById: integer("flagged_by_id"),
  flaggedByName: text("flagged_by_name"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedById: integer("completed_by_id"),
  completedByName: text("completed_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CommandRow = typeof commandsTable.$inferSelect;
