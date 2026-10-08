import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  AddTicketCommentBody,
  AddTicketCommentParams,
  AddTicketCommentResponse,
  CreateTicketBody,
  CreateTicketResponse,
  GetAdminAnalyticsResponse,
  GetCurrentUserResponse,
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetTicketParams,
  GetTicketResponse,
  ListAgentsResponse,
  ListTicketsQueryParams,
  ListTicketsResponse,
  ListUsersResponse,
  LoginUserBody,
  LoginUserResponse,
  LogoutUserResponse,
  RegisterUserBody,
  RegisterUserResponse,
  UpdateTicketBody,
  UpdateTicketParams,
  UpdateTicketResponse,
  UpdateUserRoleBody,
  UpdateUserRoleParams,
  UpdateUserRoleResponse,
} from "@workspace/api-zod";
import {
  activityTable,
  commentsTable,
  db,
  ticketsTable,
  usersTable,
  type Ticket,
  type User,
} from "@workspace/db";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const router: IRouter = Router();
const SESSION_COOKIE = "supportflow_session";
const COOKIE_TTL = 7 * 24 * 60 * 60 * 1000;
const roles = ["USER", "AGENT", "ADMIN"] as const;
const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const categories = [
  "Technical Issue",
  "Account / Login",
  "Network",
  "Hardware",
  "Software",
  "Payment",
  "Academic",
  "General Query",
  "Other",
];
type Role = (typeof roles)[number];

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    createdAt: user.createdAt,
  };
}

function makePasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function currentUser(req: Request): Promise<User | undefined> {
  const signedId = req.signedCookies?.[SESSION_COOKIE];
  const id = Number(signedId);
  if (!Number.isSafeInteger(id) || id < 1) return undefined;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return user;
}

async function requireUser(req: Request, res: Response, allowed?: Role[]): Promise<User | undefined> {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Please sign in to continue." });
    return undefined;
  }
  if (allowed && !allowed.includes(user.role as Role)) {
    res.status(403).json({ error: "You do not have permission to perform this action." });
    return undefined;
  }
  return user;
}

async function ticketView(ticket: Ticket) {
  const [[creator], [assignee]] = await Promise.all([
    db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ticket.createdById)).limit(1),
    ticket.assignedToId
      ? db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ticket.assignedToId)).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    ...ticket,
    createdByName: creator?.name ?? "Unknown user",
    assignedToName: assignee?.name ?? null,
  };
}

async function getTicketIfVisible(id: number, user: User, res: Response): Promise<Ticket | undefined> {
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found." });
    return undefined;
  }
  if (user.role === "USER" && ticket.createdById !== user.id) {
    res.status(403).json({ error: "You can only view tickets you created." });
    return undefined;
  }
  return ticket;
}

function setSession(res: Response, id: number) {
  res.cookie(SESSION_COOKIE, String(id), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_TTL,
    path: "/",
  });
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success || parsed.data.name.trim().length < 2) {
    res.status(400).json({ error: "Enter a name, valid email, and password with at least 8 characters." });
    return;
  }
  try {
    const [user] = await db.insert(usersTable).values({
      name: parsed.data.name.trim(),
      email: parsed.data.email.toLowerCase().trim(),
      passwordHash: makePasswordHash(parsed.data.password),
      role: "USER",
    }).returning();
    setSession(res, user.id);
    res.status(201).json(RegisterUserResponse.parse(publicUser(user)));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    throw error;
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase().trim()))
    .limit(1);
  if (!user || !passwordMatches(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  setSession(res, user.id);
  res.json(LoginUserResponse.parse(publicUser(user)));
});

router.post("/auth/logout", (_req, res): void => {
  res.clearCookie(SESSION_COOKIE, { path: "/", sameSite: "lax", httpOnly: true });
  res.json(LogoutUserResponse.parse({ message: "Signed out." }));
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  res.json(GetCurrentUserResponse.parse(publicUser(user)));
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rows = user.role === "USER"
    ? await db.select().from(ticketsTable).where(eq(ticketsTable.createdById, user.id)).orderBy(desc(ticketsTable.createdAt)).limit(100)
    : await db.select().from(ticketsTable).orderBy(desc(ticketsTable.createdAt)).limit(100);
  const tickets = await Promise.all(rows.map(ticketView));
  res.json(GetDashboardSummaryResponse.parse({
    total: rows.length,
    open: rows.filter((ticket) => ticket.status === "OPEN").length,
    inProgress: rows.filter((ticket) => ticket.status === "IN_PROGRESS").length,
    resolved: rows.filter((ticket) => ticket.status === "RESOLVED").length,
    closed: rows.filter((ticket) => ticket.status === "CLOSED").length,
    tickets,
  }));
});

router.get("/dashboard/analytics", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["ADMIN"]);
  if (!user) return;
  const [tickets, users] = await Promise.all([
    db.select().from(ticketsTable),
    db.select().from(usersTable),
  ]);
  const byStatus = statuses.map((status) => ({
    status,
    count: tickets.filter((ticket) => ticket.status === status).length,
  }));
  const byCategory = categories.map((category) => ({
    category,
    count: tickets.filter((ticket) => ticket.category === category).length,
  })).filter((entry) => entry.count > 0);
  res.json(GetAdminAnalyticsResponse.parse({
    totalTickets: tickets.length,
    openTickets: tickets.filter((ticket) => ticket.status === "OPEN").length,
    inProgressTickets: tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length,
    resolvedTickets: tickets.filter((ticket) => ticket.status === "RESOLVED").length,
    totalUsers: users.length,
    totalAgents: users.filter((candidate) => candidate.role === "AGENT").length,
    byStatus,
    byCategory,
  }));
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["ADMIN"]);
  if (!user) return;
  const rows = await db.select({
    id: activityTable.id,
    action: activityTable.action,
    actorName: usersTable.name,
    ticketNumber: ticketsTable.ticketNumber,
    createdAt: activityTable.createdAt,
  }).from(activityTable)
    .innerJoin(usersTable, eq(activityTable.actorId, usersTable.id))
    .innerJoin(ticketsTable, eq(activityTable.ticketId, ticketsTable.id))
    .orderBy(desc(activityTable.createdAt))
    .limit(12);
  res.json(GetRecentActivityResponse.parse(rows));
});

router.get("/tickets", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = ListTicketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ticket filters." });
    return;
  }
  const filters = parsed.data;
  const rows = user.role === "USER"
    ? await db.select().from(ticketsTable).where(eq(ticketsTable.createdById, user.id)).orderBy(desc(ticketsTable.createdAt)).limit(200)
    : await db.select().from(ticketsTable).orderBy(desc(ticketsTable.createdAt)).limit(200);
  const filtered = rows.filter((ticket) =>
    (!filters.status || ticket.status === filters.status) &&
    (!filters.priority || ticket.priority === filters.priority) &&
    (!filters.search || `${ticket.ticketNumber} ${ticket.title} ${ticket.category}`.toLowerCase().includes(filters.search.toLowerCase()))
  );
  res.json(ListTicketsResponse.parse(await Promise.all(filtered.map(ticketView))));
});

router.post("/tickets", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success || !categories.includes(parsed.data.category)) {
    res.status(400).json({ error: "Check the ticket fields and choose a valid category." });
    return;
  }
  const title = parsed.data.title.trim();
  const description = parsed.data.description.trim();
  if (title.length < 5 || description.length < 10) {
    res.status(400).json({ error: "The title needs at least 5 characters and the description at least 10." });
    return;
  }
  const ticketNumber = `TKT-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const [ticket] = await db.insert(ticketsTable).values({
    ticketNumber,
    title,
    description,
    category: parsed.data.category,
    priority: parsed.data.priority,
    status: "OPEN",
    createdById: user.id,
  }).returning();
  await db.insert(activityTable).values({ ticketId: ticket.id, actorId: user.id, action: "created a ticket" });
  res.status(201).json(CreateTicketResponse.parse(await ticketView(ticket)));
});

router.get("/tickets/:id", async (req, res): Promise<void> => {
  const params = GetTicketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ticket number." });
    return;
  }
  const user = await requireUser(req, res);
  if (!user) return;
  const ticket = await getTicketIfVisible(params.data.id, user, res);
  if (!ticket) return;
  const comments = await db.select().from(commentsTable)
    .where(eq(commentsTable.ticketId, ticket.id))
    .orderBy(commentsTable.createdAt);
  const commentViews = await Promise.all(comments.map(async (comment) => {
    const [author] = await db.select({ name: usersTable.name, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, comment.authorId)).limit(1);
    return {
      ...comment,
      authorName: author?.name ?? "Unknown user",
      authorRole: (author?.role ?? "USER") as Role,
    };
  }));
  res.json(GetTicketResponse.parse({ ticket: await ticketView(ticket), comments: commentViews }));
});

router.patch("/tickets/:id", async (req, res): Promise<void> => {
  const params = UpdateTicketParams.safeParse(req.params);
  const parsed = UpdateTicketBody.safeParse(req.body);
  if (!params.success || !parsed.success || (!parsed.data.status && parsed.data.assignedToId === undefined)) {
    res.status(400).json({ error: "Choose a valid status or assignee." });
    return;
  }
  const user = await requireUser(req, res, ["AGENT", "ADMIN"]);
  if (!user) return;
  const [existing] = await db.select().from(ticketsTable)
    .where(eq(ticketsTable.id, params.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  if (parsed.data.assignedToId !== undefined && parsed.data.assignedToId !== null) {
    const [assignee] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, parsed.data.assignedToId), eq(usersTable.role, "AGENT"))).limit(1);
    if (!assignee) {
      res.status(400).json({ error: "Choose an active support agent." });
      return;
    }
  }
  const changes: Partial<Ticket> = { updatedAt: new Date() };
  if (parsed.data.status) changes.status = parsed.data.status;
  if (parsed.data.assignedToId !== undefined) changes.assignedToId = parsed.data.assignedToId;
  const [updated] = await db.update(ticketsTable).set(changes)
    .where(eq(ticketsTable.id, existing.id)).returning();
  const action = parsed.data.status
    ? `changed status to ${parsed.data.status.replace("_", " ").toLowerCase()}`
    : parsed.data.assignedToId === null ? "unassigned the ticket" : "assigned the ticket";
  await db.insert(activityTable).values({ ticketId: updated.id, actorId: user.id, action });
  res.json(UpdateTicketResponse.parse(await ticketView(updated)));
});

router.post("/tickets/:id/comments", async (req, res): Promise<void> => {
  const params = AddTicketCommentParams.safeParse(req.params);
  const parsed = AddTicketCommentBody.safeParse(req.body);
  if (!params.success || !parsed.success || !parsed.data.body.trim()) {
    res.status(400).json({ error: "Write a comment before submitting." });
    return;
  }
  const user = await requireUser(req, res);
  if (!user) return;
  const ticket = await getTicketIfVisible(params.data.id, user, res);
  if (!ticket) return;
  const [comment] = await db.insert(commentsTable).values({
    ticketId: ticket.id,
    authorId: user.id,
    body: parsed.data.body.trim(),
  }).returning();
  await db.insert(activityTable).values({ ticketId: ticket.id, actorId: user.id, action: "commented on a ticket" });
  res.status(201).json(AddTicketCommentResponse.parse({
    ...comment,
    authorName: user.name,
    authorRole: user.role as Role,
  }));
});

router.get("/agents", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["AGENT", "ADMIN"]);
  if (!user) return;
  const agents = await db.select().from(usersTable).where(eq(usersTable.role, "AGENT")).orderBy(usersTable.name);
  res.json(ListAgentsResponse.parse(agents.map(publicUser)));
});

router.get("/users", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["ADMIN"]);
  if (!user) return;
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(ListUsersResponse.parse(users.map(publicUser)));
});

router.patch("/users/:id/role", async (req, res): Promise<void> => {
  const params = UpdateUserRoleParams.safeParse(req.params);
  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Choose a valid role." });
    return;
  }
  const user = await requireUser(req, res, ["ADMIN"]);
  if (!user) return;
  if (params.data.id === user.id) {
    res.status(400).json({ error: "You cannot change your own administrator role." });
    return;
  }
  const [updated] = await db.update(usersTable).set({ role: parsed.data.role })
    .where(eq(usersTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json(UpdateUserRoleResponse.parse(publicUser(updated)));
});

export default router;
