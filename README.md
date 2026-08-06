# SpendSnap AI

A production-ready **personal finance & expense tracker** with a full-stack setup:
an Express + SQLite REST API backend and a responsive single-page frontend served
from `public/`. No external database, no external AI required — insights are
generated locally with rule-based logic.

![Stack](https://img.shields.io/badge/Node.js-%3E%3D18-339933) ![Express](https://img.shields.io/badge/Express-4.x-000000) ![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57) ![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Transactions** — Income, Expense & Investment entries with per-type categories and receipt upload
- **Dashboards** — balance, budget, recent activity, category breakdown, 6-month summary & investment cards
- **Analytics** — daily, weekly, monthly & yearly reports with zero-filled series
- **Budgets** — monthly budget with auto-recomputed totals (spent / remaining)
- **Savings goals** — targets with progress %, add-savings and status tracking
- **AI insights** — rule-based money insights, generated on demand (no external API)
- **Notifications** — in-app alerts (budget warnings, milestones, seed welcome)
- **CSV export** — download filtered transactions
- **Auth** — JWT + bcrypt, per-user data isolation (every query is scoped to `user_id`)
- **Hardened** — input validation, rate limiting, CORS allow-list, helmet headers, parameterized SQL

## Tech Stack

| Layer      | Choice                              |
| ---------- | ----------------------------------- |
| Runtime    | Node.js (>= 18)                     |
| Framework  | Express.js                          |
| Database   | SQLite via `better-sqlite3`         |
| Frontend   | Vanilla HTML / CSS / JS (in `public/`) |
| Auth       | JWT (`jsonwebtoken`) + `bcryptjs`   |
| Validation | `express-validator`                 |
| Misc       | `dotenv`, `cors`, `helmet`, `morgan`, `express-rate-limit`, `multer` |

## Getting Started

```bash
npm install
cp .env.example .env   # then set a strong JWT_SECRET
npm start
```

Open **http://localhost:5000** — the frontend is served from `public/`.

> The SQLite database (`data/spendsnap.sqlite`) is created automatically on first
> start from `db/schema.sql`. A ready-to-run demo DB is also committed.

### Demo account

The committed database ships with a pre-seeded demo workspace:

| Field    | Value                    |
| -------- | ------------------------ |
| Email    | `demo@spendsnap.com`     |
| Password | `demo12345`              |

You can also re-seed it at any time:

```bash
npm run seed
```

New accounts registered through the UI start with a **clean, empty dashboard**.

### Run tests

```bash
npm test
```

The suite boots the real app against a temporary SQLite file and exercises every
route group — auth, transactions (incl. type-aware category validation and
cross-user isolation), budgets, goals, analytics, insights, notifications and CSV export.

## Environment Variables

See [.env.example](./.env.example):

| Variable                    | Default                          | Description                          |
| --------------------------- | -------------------------------- | ------------------------------------ |
| `PORT`                      | `5000`                           | Server port                          |
| `NODE_ENV`                  | `development`                    | `development` / `production` / `test` |
| `DB_PATH`                   | `data/spendsnap.sqlite`          | SQLite database file path            |
| `JWT_SECRET`                | *(required)*                     | Secret used to sign JWTs             |
| `JWT_EXPIRES_IN`            | `7d`                             | Token lifetime                       |
| `CORS_ORIGINS`              | dev defaults                     | Comma-separated allowed origins      |
| `RATE_LIMIT_WINDOW_MIN`     | `15`                             | Global rate limit window (minutes)   |
| `RATE_LIMIT_MAX_REQUESTS`   | `300`                            | Global requests per window           |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `20`                          | Login/register attempts per window   |

## Folder Structure

```
spendsnap-ai/
├── public/            # FRONTEND — single-page app (served statically)
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── uploads/receipts/   # receipt uploads (runtime; git-ignored)
├── config/            # env parsing + SQLite connection & schema init
├── controllers/       # request handlers
├── db/                # schema.sql + seed.js + committed demo DB
├── exports/           # CSV export helpers
├── middleware/        # auth, validation, rate limiting, error handler, upload
├── models/            # SQL query layer (replaces Mongoose models)
├── routes/            # API route definitions
├── services/          # business logic (analytics, budgets, goals, insights…)
├── tests/             # end-to-end smoke test suite
├── utils/             # ApiError, asyncHandler, constants
├── server.js          # app entry point
├── package.json
└── .env.example
```

## API Reference

Base URL: `http://localhost:5000/api`

All endpoints except auth & health require:

```
Authorization: Bearer <token>
```

Responses use a consistent envelope:

```json
{ "success": true, "data": { ... } }
```

Validation errors return `400`:

```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "amount", "message": "…" }] }
```

### Auth

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`        | Create account (`fullName`, `email`, `password`, `phone?`, `currency?`) |
| POST   | `/api/auth/login`           | Log in → returns `{ user, token }`    |
| GET    | `/api/auth/profile`         | Current user profile                 |
| PUT    | `/api/auth/update-profile`  | Update `fullName`, `phone`, `profileImage`, `currency` |
| PUT    | `/api/auth/change-password` | `currentPassword` + `newPassword`    |

### Transactions

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| POST   | `/api/transactions`         | Create (`type`, `category`, `amount`, `paymentMethod?`, `date?`, `note?`, `receipt?` as multipart) |
| GET    | `/api/transactions`         | List with filters & search (below)   |
| GET    | `/api/transactions/:id`     | Get one transaction                  |
| PUT    | `/api/transactions/:id`     | Update one transaction               |
| DELETE | `/api/transactions/:id`     | Delete one transaction               |

List query params: `type`, `category`, `paymentMethod`, `from`, `to`, `month`
(`YYYY-MM`), `q` (free-text search), `sort` (`-date`, `date`, `-amount`,
`amount`, `-createdAt`, `createdAt`), `page`, `limit` (max 100).

Transaction types: `Income`, `Expense`, `Investment` — each validates against its
own category list:

- **Expense**: `Food`, `Shopping`, `Travel`, `Bills`, `Health`, `Education`, `Entertainment`, `Other`
- **Income**: `Salary`, `Freelancing`, `Pocket Money`, `Investment`, `Other`
- **Investment**: `Investment`, `Stocks`, `Mutual Funds`, `Gold`, `Crypto`, `FD`, `Real Estate`, `Bonds`, `Other`

### Dashboard

| Method | Endpoint       | Description                          |
| ------ | -------------- | ------------------------------------ |
| GET    | `/api/dashboard` | Balance, income/expense/investment totals, budget, recent transactions, category + investment breakdowns, 6-month summary |

### Analytics (Reports)

| Method | Endpoint                    | Query params                  |
| ------ | --------------------------- | ----------------------------- |
| GET    | `/api/analytics/daily`      | `from`, `to`, `type?`         |
| GET    | `/api/analytics/weekly`     | `weeks` (2–26), `type?`       |
| GET    | `/api/analytics/monthly`    | `months` (2–24), `type?`      |
| GET    | `/api/analytics/yearly`     | `years` (2–10), `type?`       |

Each returns a zero-filled `series` of `{ key, total, count }` buckets.

### Budgets

| Method | Endpoint       | Description                          |
| ------ | -------------- | ------------------------------------ |
| POST   | `/api/budget`  | Create/upsert for a month: `monthlyBudget`, `savingGoal`, `month?` |
| GET    | `/api/budget?month=YYYY-MM` | Budget with recomputed totals |
| PUT    | `/api/budget`  | Update `monthlyBudget` / `savingGoal` |

`totalSpent` and `remainingBudget` are recomputed automatically from Expense
transactions on every create/update/delete.

### Savings Goals

| Method | Endpoint                       | Description                          |
| ------ | ------------------------------ | ------------------------------------ |
| GET    | `/api/goals`                   | List goals with `progressPercent`    |
| POST   | `/api/goals`                   | Create (`name`, `targetAmount`, `savedAmount?`, `deadline?`, `category?`) |
| GET    | `/api/goals/:id`               | Get one goal                         |
| PUT    | `/api/goals/:id`               | Update goal                          |
| PATCH  | `/api/goals/:id/add-savings`   | Add `amount` to savedAmount          |
| DELETE | `/api/goals/:id`               | Delete goal                          |

### AI Insights

| Method | Endpoint       | Description                          |
| ------ | -------------- | ------------------------------------ |
| GET    | `/api/ai/insights` | Generates rule-based insights on demand & returns the 10 latest |

### Notifications

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| GET    | `/api/notifications`        | List (`limit`, `page`, `unreadOnly=true`) |
| PUT    | `/api/notifications/read`   | Mark all read, or one (`id`)         |

### CSV Export

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| GET    | `/api/export/csv`           | Downloads transactions as CSV        |

Supports the same filters as the transactions list.

### Health

| Method | Endpoint  | Description          |
| ------ | --------- | -------------------- |
| GET    | `/api/health` | Server health check |

## Example Requests

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Aarav Shah","email":"aarav@test.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aarav@test.com","password":"password123"}'

# Add an expense
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"type":"Expense","category":"Food","amount":450,"paymentMethod":"UPI","note":"Groceries"}'

# Search + filter transactions
curl "http://localhost:5000/api/transactions?type=Expense&category=Food&q=grocery&sort=-date&page=1&limit=25" \
  -H "Authorization: Bearer <token>"

# Monthly report
curl "http://localhost:5000/api/analytics/monthly?months=6&type=Expense" \
  -H "Authorization: Bearer <token>"

# Export CSV
curl "http://localhost:5000/api/export/csv?month=2026-08" \
  -H "Authorization: Bearer <token>" -o transactions.csv
```

## Security Notes

- Passwords hashed with bcrypt (10 rounds); never returned by the API.
- All `/api/*` routes except auth & health require a valid JWT.
- Every query is scoped to the authenticated user (`user_id = ?`) — cross-user access returns `404`.
- Global + auth rate limiting, CORS allow-list, helmet security headers.
- SQL is fully parameterized (no string interpolation of user input).
- `.env` is git-ignored; use `.env.example` as a template.

## License

MIT
