import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  taxNumber: text("tax_number"),
  entityType: text("entity_type", { enum: ["فردي", "شركة"] }),
  vatStatus: text("vat_status", { enum: ["نعم", "لا", "ربع سنوي"] }),
  username: text("username"),
  password: text("password"),
  email: text("email"),
  phone: text("phone"),
  nationalId: text("national_id"),
  eInvoiceEmail: text("e_invoice_email"),
  eInvoicePassword: text("e_invoice_password"),
  registrationDate: text("registration_date"),
  taxCardExpiry: text("tax_card_expiry"),
  taxPortalExpiry: text("tax_portal_expiry"),
  tokenExpiry: text("token_expiry"),
  appealCommitteeDate: text("appeal_committee_date"),
  notes: text("notes"),
  addedById: integer("added_by_id"),
  addedByName: text("added_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CustomerRow = typeof customersTable.$inferSelect;
