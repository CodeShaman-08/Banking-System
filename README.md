# Banking-System

A small banking backend that moves money with a **double-entry ledger**, idempotent transfers and JWT auth — built with Node.js, Express and MongoDB, with a vanilla JS UI.

**Live demo:** https://banking-system-api-fj4g.onrender.com
**Static UI (GitHub Pages):** https://codeshaman-08.github.io/Banking-System/
**Source:** https://github.com/CodeShaman-08/Banking-System

> The demo runs on Render's free tier, so the first request after 15 minutes of inactivity can take ~30 seconds to wake up. New accounts are credited with ₹5,000 of test money (`DEMO_FUNDING=true`) so you can try a transfer immediately.

---

## What it does

- Register / login / logout with JWT
- Create bank accounts (INR)
- Derive an account balance from ledger entries — there is no `balance` column
- Transfer money between two accounts in a single MongoDB transaction
- Replay-safe transfers with idempotency keys
- Immutable ledger entries (updates and deletes are blocked at the model layer)
- Minimal UI for signup, accounts and transfers

---

## Try it in 60 seconds

1. Open the live demo and create an account.
2. Create a second account (the "Create account" button).
3. Copy the second account's ID with **Use ID**.
4. Send ₹1,000 to it.

You should see the sender's balance drop and the receiver's balance rise.

---

## Architecture

```
public/                     static UI (also deployed to GitHub Pages)
src/
  app.js                    express app, CORS, static hosting, /api/health
  config/db.js              mongoose connection
  models/
    user.model.js           bcrypt password hashing
    account.model.js        getBalance() aggregates the ledger
    ledger.model.js         immutable DEBIT / CREDIT entries
    transaction.model.js    unique idempotencyKey, status lifecycle
    blackList.model.js      revoked JWTs
  controllers/              auth, account and transfer handlers
  routes/                   /api/auth, /api/accounts, /api/transaction
  middleware/               auth + system-user auth
  services/demoFunding.js   demo-only initial funds
server.js                   starts the API on process.env.PORT
```

A transfer writes three documents inside one transaction:

| Document | Change |
|---|---|
| `transaction` | `PENDING` → `COMPLETED` |
| `ledger` (sender) | `DEBIT amount` |
| `ledger` (receiver) | `CREDIT amount` |

Balance is always `SUM(credits) - SUM(debits)` for an account.

---

## API

Base URL: `https://banking-system-api-fj4g.onrender.com`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | – | Health check |
| `POST` | `/api/auth/register` | – | Create a user, returns a JWT |
| `POST` | `/api/auth/login` | – | Login, returns a JWT |
| `POST` | `/api/auth/logout` | Bearer | Blacklist the current JWT |
| `POST` | `/api/accounts` | Bearer | Create an account |
| `GET` | `/api/accounts` | Bearer | List your accounts |
| `GET` | `/api/accounts/balance/:accountId` | Bearer | Ledger-derived balance |
| `POST` | `/api/transaction` | Bearer | Transfer money |
| `POST` | `/api/transaction/system/initial-funds` | System user | Mint initial funds |

Send the token as `Authorization: Bearer <token>`.

### Transfer request

```json
{
  "fromAccount": "6b017d7edc147360fc334952",
  "toAccount": "6b017d7edc147360fc334953",
  "amount": 1000,
  "idempotencyKey": "b1f4c0de-8a52-4a0e-9f0e-2d4b9f0c7e11"
}
```

The same `idempotencyKey` returns the original transaction instead of moving money twice.

---

## Run locally

```bash
git clone https://github.com/CodeShaman-08/Banking-System.git
cd Banking-System
npm install
cp .env.example .env      # then fill MONGO_URI and JWT_SECRET
npm run dev
```

Open http://localhost:3000.

Required environment variables:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb+srv://...
JWT_SECRET=a-long-random-string
CORS_ORIGIN=http://localhost:3000,https://codeshaman-08.github.io
DEMO_FUNDING=true
```

`MONGO_URI` should point at a MongoDB **replica set** (Atlas works) because transfers use multi-document transactions.

---

## Deploy

The repo includes `render.yaml`, so Render can create the service automatically:

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, pick this repo.
3. Set `MONGO_URI` when prompted.
4. In MongoDB Atlas: **Network Access → Add IP Address → 0.0.0.0/0** so Render can connect.
5. Deploy.

The GitHub Pages workflow (`.github/workflows/pages.yml`) publishes the UI from `public/`.

---

## What I learnt building this

### 1. A balance column is a cache, and caches lie
My first instinct was `account.balance`. Then a failed transfer leaves the column and the truth out of sync. Storing every movement as a `DEBIT` or `CREDIT` and deriving the balance with an aggregation makes the balance impossible to disagree with the history. It is slower, and it is correct.

### 2. Every debit needs a credit — even in "test" code
The initial-funds path had its `DEBIT` entry commented out, so money appeared from nowhere. A ledger with one-sided entries is just a list of numbers. I restored the matching debit so the system account funds the user account.

### 3. Idempotency is a database constraint, not an `if`
Checking `findOne({ idempotencyKey })` before writing is not enough: two requests can both pass the check. The real guarantee is the **unique index** on `idempotencyKey` plus handling duplicate-key errors (`11000`) and returning the already-processed transaction.

### 4. A missing `return` can be a security bug
In the transfer handler:

```js
if (balance < amount) {
  res.status(400).json({ message: "insufficient balance" });
}
```

Without `return`, execution continued and the transaction still ran. The request also never received a success response, so the UI hung forever. Every guard clause now returns.

### 5. Authentication is not authorization
A valid JWT proves *who* you are, not *which account* you may spend from. The handler now checks that `fromAccount.user` equals the logged-in user. Without that check, anyone with an account ID could drain it. This was the scariest bug in the project.

### 6. JWTs cannot be un-issued
Logout cannot delete a signed token from the client's history, so I store revoked tokens in a blacklist and check it in the auth middleware. Short expiry plus a blacklist is a reasonable trade-off; a refresh-token rotation scheme would be better.

### 7. Transactions need cleanup on every path
`startSession()` allocates a session. If an error is thrown before `abortTransaction()` and `endSession()`, the session leaks and the request hangs. The handler now wraps the work in `try / catch / finally` and aborts on failure.

### 8. Money is not a float
This project uses JavaScript `Number` for simplicity. Real systems store integer minor units (paise/cents) or `Decimal128`, because `0.1 + 0.2 !== 0.3` and rounding errors compound across millions of entries. This is the first thing I would change for production.

### 9. Deployment is part of the backend
The app worked locally and failed on Render for reasons that had nothing to do with business logic:
- the server hard-coded port `3000` instead of `process.env.PORT`
- Atlas blocked Render's IP
- the UI is on a different origin, so it needs CORS and `SameSite=None; Secure` cookies
- `NODE_ENV=production` changes how `npm install` treats dev dependencies

A backend is not finished until it runs somewhere other than localhost.

### 10. Free tiers sleep
Render's free web service spins down after 15 minutes. The first request can take ~30 seconds. That is fine for a portfolio demo, but it changes how you design health checks, retries and user expectations.

---

## Known limitations / next steps

- Amounts are stored as `Number`; move to integer paise or `Decimal128`.
- No automated tests yet — the next step is integration tests for the ledger invariants (`sum(debits) === sum(credits)`, replay safety, ownership).
- No rate limiting on login or transfers.
- No refresh tokens; JWTs live for 1 day.
- Demo funding is enabled on the live demo only (`DEMO_FUNDING=true`); disable it for real use.
- Transfers are limited to accounts in the same database; no external payment rails.

---

## License

ISC
