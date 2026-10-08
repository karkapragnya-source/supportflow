import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  activityTable,
  commentsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";

const demoUsers = [
  {
    name: "Alex Morgan",
    email: "admin@supportflow.demo",
    role: "ADMIN",
    passwordHash:
      "aba00159d4ac816309cb058ff316b6b8:4f47b0656c7f37193c70675984e02d0abf523cbe470fdc5d0d8d8b315079b63de9d1a050ca1d3cd2f99775bce45794e7e5672effd3422a80aa235b1ffb473020",
  },
  {
    name: "Jordan Lee",
    email: "agent@supportflow.demo",
    role: "AGENT",
    passwordHash:
      "ef9ce2155a21fb9ddae6dd3bf244b8ff:01620b93fe0f71d7796334bbcc6bafce75311a3bb0a95df4d4f59285cbf3597681e8935accc69077c30914f4c53797fe266f79ba5ef777c93204d9538450cd43",
  },
  {
    name: "Student",
    email: "student@supportflow.demo",
    role: "USER",
    passwordHash:
      "2864dce238fddc1ee22895f26220a0ac:cc3a318d7ae9651c5a55ed66db97ffcc28786fb64073c44c5ffc680e64a9def96632669431f034caa476e418d7fe0927775132435365dfd0d06e0a758a85b926",
  },
] as const;

export async function seedDemoData(): Promise<void> {
  const usersByEmail = new Map<string, { id: number; role: string }>();
  for (const demo of demoUsers) {
    let [user] = await db.select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.email, demo.email)).limit(1);
    if (!user) {
      [user] = await db.insert(usersTable).values(demo).returning({
        id: usersTable.id,
        role: usersTable.role,
      });
    }
    usersByEmail.set(demo.email, user);
  }

  const [anyTicket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).limit(1);
  if (anyTicket) {
    logger.info("SupportFlow demo users are ready");
    return;
  }

  const student = usersByEmail.get("student@supportflow.demo")!;
  const agent = usersByEmail.get("agent@supportflow.demo")!;
  const examples = [
    {
      ticketNumber: "TKT-2026-10001",
      title: "Campus Wi-Fi keeps disconnecting",
      description: "The connection drops every few minutes in the library study area.",
      category: "Network",
      priority: "HIGH",
      status: "IN_PROGRESS",
      createdById: student.id,
      assignedToId: agent.id,
    },
    {
      ticketNumber: "TKT-2026-10002",
      title: "Unable to access student portal",
      description: "The portal says my session has expired when I sign in.",
      category: "Account / Login",
      priority: "MEDIUM",
      status: "OPEN",
      createdById: student.id,
      assignedToId: null,
    },
    {
      ticketNumber: "TKT-2026-10003",
      title: "Projector setup resolved",
      description: "The lecture hall projector was not detecting my laptop.",
      category: "Hardware",
      priority: "LOW",
      status: "RESOLVED",
      createdById: student.id,
      assignedToId: agent.id,
    },
  ];

  const inserted = await db.insert(ticketsTable).values(examples).returning();
  for (const [index, ticket] of inserted.entries()) {
    await db.insert(activityTable).values({
      ticketId: ticket.id,
      actorId: index === 0 || index === 2 ? agent.id : student.id,
      action: index === 0 ? "started working on a ticket" : index === 2 ? "resolved a ticket" : "created a ticket",
    });
  }
  const [firstTicket] = inserted;
  await db.insert(commentsTable).values({
    ticketId: firstTicket.id,
    authorId: agent.id,
    body: "We are checking the access points near the library.",
  });
  await db.insert(activityTable).values({
    ticketId: firstTicket.id,
    actorId: agent.id,
    action: "commented on a ticket",
  });
  logger.info({ sampleTickets: inserted.length }, "Seeded SupportFlow demo data");
}
