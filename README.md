# SpendSnap AI — Backend

REST API for **SpendSnap AI**, a personal finance / expense tracker. Built with
**Node.js, Express.js and SQLite** — no MongoDB.

- JWT authentication with bcrypt password hashing
- Transactions (Income / Expense / Investment) with categories
- Daily, weekly, monthly & yearly analytics reports
- Monthly budget management with automatic totals
- Savings goals with progress tracking
- Rule-based AI insights & in-app notifications
- CSV export of transactions
- Search & filter transactions
- Input validation, rate limiting, CORS, structured error handling

## Tech Stack

| Layer      | Choice                              |
| ---------- | ----------------------------------- |
| Runtime    | Node.js (>= 18)                     |
| Framework  | Express.js                          |
| Database   | SQLite via `better-sqlite3`         |
| Auth       | JWT (`jsonwebtoken`) + `bcryptjs`   |
| Validation | `express-validator`                 |
| Misc       | `dotenv`, `cors`, `helmet`, `morgan`, `express-rate-limit` |

## Getting Started

```bash
npm install
cp .env.example .env   # then edit JWT_SECRET
npm start
```

The server listens on `http://localhost:5000` (configurable via `PORT`).

> The SQLite database file and schema are created automatically on first start
> (`data/spendsnap.sqlite`). No external database server required.

Optional — seed demo data:

```bash
npm run seed
# email: demo@spendsnap.com   password: demo12345
```

Run tests:

```bash
npm test
```

## Environment Variables

See [.env.example](./.env.example):

| Variable                    | Default                          | Description                          |
| --------------------------- | -------------------------------- | ------------------------------------ |
| `PORT`                      | `5000`                           | Server port                          |
| `NODE_ENV`                  | `development`                    | `development` / `production` / `test` |
| `DB_PATH`                   | `data/spendsnap.sqlite`          | SQLite database file path            |
| `JWT_SECRET`                | *(required)*                     | Secret used to sign JWTs             |
| `JWT_EXPIRES_IN`            | `7d`                             | Token lifetime                       |
| `CORS_ORIGINS`              | `http://localhost:3000`          | Comma-separated allowed origins      |
| `RATE_LIMIT_WINDOW_MIN`     | `15`                             | Global rate limit window (minutes)   |
| `RATE_LIMIT_MAX_REQUESTS`   | `300`                            | Global requests per window           |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `20`                          | Login/register attempts per window   |

## Database Schema

Tables are created automatically from [`db/schema.sql`](./db/schema.sql):

- **users** — account & profile data
- **transactions** — income / expense / investment entries
- **budgets** — one row per user + month, with auto-computed totals
- **goals** — savings goals with target & saved amounts
- **ai_insights** — generated rule-based money insights (deduplicated per day)
- **notifications** — in-app alerts

Foreign keys cascade deletes; lookups are indexed on `user_id + date`, `type`,
and `category`.

## Folder Structure

```
backend/
├── config/          # env + SQLite connection & schema init
├── controllers/     # request handlers
├── db/              # schema.sql + seed.js
├── exports/         # CSV export helpers
├── middleware/      # auth, validation, rate limiting, error handler
├── models/          # SQL query layer (replaces Mongoose models)
├── routes/          # API route definitions
├── services/        # business logic (analytics, budgets, goals, insights…)
├── utils/           # ApiError, asyncHandler, constants
├── server.js        # app entry point
├── package.json
└── .env.example
```

## API Reference

Base URL: `http://localhost:5000/api`

All endpoints below (except auth & health) require the header:

```
Authorization: Bearer <token>
```

Responses use a consistent envelope:

```json
{ "success": true, "data": { ... } }
```

Validation errors return `400` with:

```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "amount", "message": "…" }] }
```

### Auth

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`        | Create account (`fullName`, `email`, `password`, `phone?`, `currency?`) |
| POST   | `/api/auth/login`           | Sign in → returns `{ user, token }`  |
| GET    | `/api/auth/profile`         | Current user profile                 |
| PUT    | `/api/auth/update-profile`  | Update `fullName`, `phone`, `profileImage`, `currency` |
| PUT    | `/api/auth/change-password` | `currentPassword` + `newPassword`    |

### Transactions

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| POST   | `/api/transactions`         | Create (`type`, `category`, `amount`, `paymentMethod?`, `date?`, `note?`) |
| GET    | `/api/transactions`         | List with filters & search (below)   |
| GET    | `/api/transactions/:id`     | Get one transaction                  |
| PUT    | `/api/transactions/:id`     | Update one transaction               |
| DELETE | `/api/transactions/:id`     | Delete one transaction               |

List query params: `type`, `category`, `paymentMethod`, `from`, `to`, `month`
(`YYYY-MM`), `q` (free-text search across note/category/payment method/type),
`sort` (`-date`, `date`, `-amount`, `amount`, `-createdAt`, `createdAt`),
`page`, `limit` (max 100).

Transaction types: `Income`, `Expense`, `Investment`.
Categories: `Food`, `Shopping`, `Travel`, `Bills`, `Health`, `Education`,
`Entertainment`, `Investment`, `Salary`, `Freelancing`, `Pocket Money`, `Other`.

### Dashboard

| Method | Endpoint       | Description                          |
| ------ | -------------- | ------------------------------------ |
| GET    | `/api/dashboard` | Balance, income/expense/investment totals, budget, recent transactions, category breakdown, 6-month summary |

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
transactions whenever a transaction is created, updated or deleted.

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
| GET    | `/api/ai/insights` | Generates (rule-based, no external AI) & returns the 10 latest insights |

### Notifications

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| GET    | `/api/notifications`        | List (`limit`, `page`, `unreadOnly=true`) |
| PUT    | `/api/notifications/read`   | Mark all read, or one (`id`)         |

### CSV Export

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| GET    | `/api/export/csv`           | Downloads transactions as CSV        |

Supports the same filters as the transactions list (`type`, `category`,
`from`, `to`, `month`, `q`).

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
- Global + auth rate limiting, CORS allow-list, helmet security headers.
- SQL is fully parameterized (no string interpolation of user input).
