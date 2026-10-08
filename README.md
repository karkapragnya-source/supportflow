# SupportFlow

SupportFlow is a support-ticket management app for college communities. Students submit and track requests, agents assign and resolve them, and administrators monitor activity and service trends.

## Features

- Role-based sign-in for students, agents, and administrators
- Self-service registration for student accounts
- Ticket creation, searchable lists, priority and status filters, and ticket detail pages
- Agent assignment, status changes, and threaded comments
- Administrator analytics, recent activity, and user-role management
- Persistent PostgreSQL records for users, tickets, comments, and activity
- Responsive landing page and application dashboards

## Tech stack

- React, Vite, and TypeScript for the web interface
- Node.js and Express for the API
- PostgreSQL and Drizzle ORM for persistent data
- Generated OpenAPI clients and request/response validation

## Installation

This repository uses pnpm workspaces. In Replit, the PostgreSQL database is provisioned for the project. For another environment, configure PostgreSQL and provide the required environment variables.

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret used to sign the HTTP-only authentication cookie |
| `PORT` | Service port, supplied by the Replit workflow |
| `BASE_PATH` | Web app mount path, supplied by the Replit workflow |

Set secrets through the hosting environment's secret manager. Do not commit `.env` files, credentials, or database connection strings.

## Demo accounts

The API seeds these accounts when it starts. Passwords are intentionally not included in this repository; use the demo credentials supplied with the app handoff.

| Role | Email |
| --- | --- |
| Administrator | `admin@supportflow.demo` |
| Agent | `agent@supportflow.demo` |
| Student | `student@supportflow.demo` |

Public registration always creates a student account. Administrators can change a user's role from the user management page.

## How to run

In Replit, start the `artifacts/api-server: API Server` and `artifacts/supportflow: web` workflows. To run the services locally, provide `DATABASE_URL` and `SESSION_SECRET`, then use separate terminals:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/supportflow run dev
```

The frontend uses the same-origin `/api` route to reach the backend.

## Hackathon demo flow

1. Sign in as the student and create a Network ticket with High priority.
2. Note the generated `TKT-...` ticket number, then sign out.
3. Sign in as the agent, open the new ticket, assign it, set it to In Progress, and add a comment.
4. Change the ticket to Resolved.
5. Sign in as the administrator to review live ticket counts, charts, recent activity, and users.
