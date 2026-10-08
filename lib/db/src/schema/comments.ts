import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { ticketsTable } from "./tickets";
import { usersTable } from "./users";

export const commentsTable = pgTable("supportflow_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Comment = typeof commentsTable.$inferSelect;
