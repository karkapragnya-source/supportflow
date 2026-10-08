import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { ticketsTable } from "./tickets";
import { usersTable } from "./users";

export const activityTable = pgTable("supportflow_activity", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").notNull().references(() => usersTable.id),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Activity = typeof activityTable.$inferSelect;
