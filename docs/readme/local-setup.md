# Local Development Setup

This guide covers everything needed to run the Goodie Bag platform on your local machine.

---

## Prerequisites

Install the following tools before starting:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22.x LTS | `brew install node@22` or [nodejs.org](https://nodejs.org/) |
| npm | Bundled with Node.js | Comes with Node.js |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) — only needed for local PostgreSQL option |
| Git | Latest | `brew install git` |

Verify:

```bash
node --version   # v22.x.x
npm --version    # 10.x+
docker --version # Docker version 2x.x.x (only if using local PostgreSQL)
```

---

## Step 1 — Clone the Repository

```bash
git clone <your-repo-url>
cd SmallGiftCompany_chao
```

---

## Step 2 — Database Setup

Choose **one** of the two options below.

---

### Option A: Supabase (recommended — no local setup required)

1. Go to [supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **New Project** → set a name (e.g. `goodiebag-local`), set a database password, choose any region → **Create new project**.
3. Once provisioned, go to **Settings → Database → Connection string → URI tab**.
4. Copy the **Transaction** mode URL (port `6543`):
   ```
   postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
5. Use this as your `DATABASE_URL` in Step 3.

---

### Option B: Local PostgreSQL via Docker

1. Make sure Docker Desktop is running.
2. From the repository root, start the database container:

```bash
docker compose up -d
```

This starts PostgreSQL 16 on `localhost:5432` with:
- Database: `goodiebag`
- Username: `goodiebag`
- Password: `goodiebag`

Your `DATABASE_URL` will be:
```
postgres://goodiebag:goodiebag@localhost:5432/goodiebag
```

To stop the container:
```bash
docker compose down
```

To stop and wipe all data:
```bash
docker compose down -v
```

#### Optional: PGAdmin (GUI to browse your local database)

PGAdmin lets you inspect tables, run SQL, and view data without using the command line.

**Install:**
```bash
brew install --cask pgadmin4
```
Or download from [pgadmin.org](https://www.pgadmin.org/download/).

**Connect to the local database:**

1. Open PGAdmin → right-click **Servers** → **Register → Server**
2. **General tab** → Name: `Goodiebag Local`
3. **Connection tab**:

   | Field | Value |
   |-------|-------|
   | Host | `localhost` |
   | Port | `5432` |
   | Database | `goodiebag` |
   | Username | `goodiebag` |
   | Password | `goodiebag` |

4. Click **Save** — the server appears in the left panel.
5. Expand **Servers → Goodiebag Local → Databases → goodiebag → Schemas → public → Tables** to browse all tables after migrations run.

> Note: Docker must be running and `docker compose up -d` must have been executed before PGAdmin can connect.

---

## Step 3 — Environment Variables

All environment variables for both frontend and backend are kept in a single `.env` file inside `backend-node/`. The frontend reads its own variable (`VITE_API_BASE_URL`) from `frontend/.env`.

### Backend `.env`

```bash
cd backend-node
cp .env.example .env
```

Edit `backend-node/.env` with your values:

```bash
# ── Database ────────────────────────────────────────────────────────────────
# Option A — Supabase (transaction mode, port 6543):
DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Option B — Local Docker PostgreSQL:
# DATABASE_URL=postgres://goodiebag:goodiebag@localhost:5432/goodiebag

# ── CORS ────────────────────────────────────────────────────────────────────
# Allow requests from the Vite dev server
CORS_ALLOWED_ORIGIN=http://localhost:5173

# ── Admin credentials ────────────────────────────────────────────────────────
# Used for HTTP Basic auth on /admin/api/** endpoints
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

# ── Node environment ─────────────────────────────────────────────────────────
NODE_ENV=development

# ── Supabase Auth ────────────────────────────────────────────────────────────
# Used to verify JWTs issued by Supabase Auth on /api/user/** endpoints.
# Find this in: Supabase dashboard → Project Settings → API → JWT Secret
SUPABASE_JWT_SECRET=<paste-jwt-secret-here>

# ── Stripe Payment ───────────────────────────────────────────────────────────
# Get from: Stripe Dashboard → Developers → API keys (test mode)
STRIPE_SECRET_KEY=sk_test_...
# For local dev: run `stripe listen --forward-to http://localhost:8080/api/webhooks/stripe`
# and copy the printed signing secret
STRIPE_WEBHOOK_SECRET=whsec_...

# ── Email (AWS SES) ──────────────────────────────────────────────────────────
# No API key needed — uses your AWS credentials (same as deploy).
# For local dev: run `aws configure` (or set AWS_PROFILE) so the SDK can authenticate.
# EMAIL_FROM must be a verified identity in SES (see docs/readme/production-deployment.md §9.5).
# Optional for local dev — emails are skipped (logged as warning) if AWS credentials are absent.
EMAIL_FROM=orders@yourdomain.com
AWS_REGION=us-east-1

# ── Product Image Storage (S3) ──────────────────────────────────────────────
# S3 bucket for product images (presigned PUT upload from admin panel).
# For local dev, set this to a bucket you have access to via your AWS credentials.
# If not set, the presign endpoint returns 503 and image upload is unavailable locally.
# Run `aws configure` so the SDK can authenticate (same credentials used for SES).
PRODUCT_IMAGES_BUCKET=your-local-dev-bucket-name
# AWS_REGION covers both SES and S3 — already set above.

# Frontend URL — used in email confirmation links
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env.local`

The frontend reads Supabase connection values from `frontend/.env.local` (this file is gitignored — create it manually):

```bash
# frontend/.env.local (create this file — never commit it)

# ── Backend API ───────────────────────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:8080

# ── Supabase ─────────────────────────────────────────────────────────────────
# Find these in: Supabase dashboard → Project Settings → API
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<paste-anon-key-here>

# ── Stripe ────────────────────────────────────────────────────────────────────
# Get from: Stripe Dashboard → Developers → API keys (publishable key, test mode)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Where to find the values:
- **`VITE_SUPABASE_URL`** — Supabase dashboard → Project Settings → API → "Project URL"
- **`VITE_SUPABASE_ANON_KEY`** — Supabase dashboard → Project Settings → API → "anon public" under Project API keys
- **`SUPABASE_JWT_SECRET`** — Supabase dashboard → Project Settings → API → "JWT Secret" (click reveal)
- **`STRIPE_SECRET_KEY`** — Stripe Dashboard (test mode) → Developers → API keys → Secret key
- **`VITE_STRIPE_PUBLISHABLE_KEY`** — Stripe Dashboard (test mode) → Developers → API keys → Publishable key
- **`STRIPE_WEBHOOK_SECRET`** — printed by the Stripe CLI when you run `stripe listen` (see Step 3b below)
- **`EMAIL_FROM`** — a sender address you own and have verified in AWS SES Identities
- **`AWS_REGION`** — the AWS region where your SES identity is verified (e.g. `us-east-1`); run `aws configure` so the SDK can authenticate locally
- **`PRODUCT_IMAGES_BUCKET`** — an S3 bucket in your AWS account; your local credentials need `s3:PutObject` on it. Image upload is optional for local dev — if not set the presign endpoint returns 503 and the upload widget shows an error, but all other admin features work normally.

> **Note:** `frontend/.env.local` overrides `frontend/.env`. The `VITE_API_BASE_URL=http://localhost:8080` entry in `.env.local` replaces the production URL baked into `.env` at deploy time.

Vite also proxies `/api/*` to `http://localhost:8080` via `vite.config.ts`, so API calls work without CORS issues during local development.

---

## Step 3b — Stripe CLI Setup (for local payment testing)

The Stripe CLI forwards webhook events from Stripe to your local backend. This is required to test the full payment flow locally (webhook → order creation → confirmation email).

### Install the Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
```

Or download from [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli).

Verify:
```bash
stripe --version  # stripe version x.x.x
```

### Log in to Stripe

```bash
stripe login
# Opens a browser window — approve the access request
```

### Start webhook forwarding

In a **new terminal** (keep it running alongside the backend):

```bash
stripe listen --forward-to http://localhost:8080/api/webhooks/stripe
```

The CLI prints a webhook signing secret:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxx (^C to quit)
```

Copy that `whsec_...` value into `backend-node/.env` as `STRIPE_WEBHOOK_SECRET`.

> Restart the backend (`npm run dev`) after updating `.env` so it picks up the new secret.

### Test a payment end-to-end

1. Add items to your cart at `http://localhost:5173/cart`
2. Go to `http://localhost:5173/checkout`
3. Fill in email, name, and shipping address
4. Click **Continue to Payment** — the Stripe Payment Element appears
5. Use Stripe test card: **`4242 4242 4242 4242`**, any future expiry (e.g. `12/34`), any 3-digit CVC
6. Click **Pay** — Stripe triggers the webhook
7. Watch the `stripe listen` terminal — you should see `payment_intent.succeeded` → `[200]`
8. Check your inbox (if AWS credentials are configured and `EMAIL_FROM` is a verified SES identity) or the backend logs for the order confirmation

### Other test cards

| Scenario | Card number |
|----------|------------|
| Payment succeeds | `4242 4242 4242 4242` |
| Payment declined | `4000 0000 0000 0002` |
| Requires authentication (3DS) | `4000 0025 0000 3155` |
| Insufficient funds | `4000 0000 0000 9995` |

All test cards use any future expiry and any CVC.

> **Email is optional for local dev.** If AWS credentials are not configured, the SES call fails silently — the backend logs a warning and the payment and order still complete normally.

---

## Step 4 — Install Dependencies

```bash
# Backend
cd backend-node
npm install

# Frontend (in a separate terminal)
cd frontend
npm install
```

---

## Step 5 — Run Database Migrations

This creates all the tables in your database (Supabase or local Docker).

```bash
cd backend-node
npm run migrate:local
```

Expected output: migration files applied, exits cleanly. To check status:

```bash
npm run migrate:local:status
```

---

## Step 6 — Start the Backend

```bash
cd backend-node
npm run dev
```

The Express server starts on `http://localhost:8080` with hot reload (via `tsx watch`).

Verify it's working:

```bash
# Health check
curl http://localhost:8080/api/health
# Expected: {"status":"UP"}

# Admin endpoint (requires credentials)
curl -u admin:changeme http://localhost:8080/admin/api/products/
# Expected: 200 with JSON array (empty if no data seeded)
```

---

## Step 7 — Start the Frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

Vite starts on `http://localhost:5173`. Open this URL in your browser.

---

## Step 8 — Run Tests

### Backend unit tests (no database required)

```bash
cd backend-node
npm test
```

### Backend integration tests (requires `DATABASE_URL` to be set)

```bash
cd backend-node
npm run test:integration
```

### All backend tests

```bash
cd backend-node
npm run test:all
```

### Frontend tests

```bash
cd frontend
npm test
```

---

## Common Issues

### Port 8080 already in use

```bash
lsof -i :8080
kill -9 <PID>
```

### Port 5432 already in use (local PostgreSQL option)

Another PostgreSQL instance may be running locally. Either stop it (`brew services stop postgresql`) or change the Docker port mapping in `docker-compose.yml` to `5433:5432` and update `DATABASE_URL` accordingly.

### Migration fails — "connection refused"

- **Docker option**: make sure `docker compose up -d` has been run and the container is healthy (`docker compose ps`)
- **Supabase option**: verify `DATABASE_URL` uses port `6543` (not `5432`) and the project reference and password are correct

### Migration fails — "relation already exists"

The migration was already applied. Run `npm run migrate:status` to see the current state. If you need a clean slate:

```bash
# Local Docker only — wipe the DB and start fresh
docker compose down -v
docker compose up -d
npm run migrate:local
```

### Frontend shows blank page or API errors

- Confirm the backend is running on port 8080 (`curl http://localhost:8080/api/health`)
- Confirm `frontend/.env` has `VITE_API_BASE_URL=http://localhost:8080`
- Restart the Vite dev server after any `.env` changes

### Stripe Payment Element does not appear

- Confirm `VITE_STRIPE_PUBLISHABLE_KEY` is set in `frontend/.env.local` and starts with `pk_test_`
- Restart the Vite dev server after adding the key — Vite env vars are baked in at startup
- Open the browser console for errors; a missing publishable key causes a silent failure

### Webhook fires but order is not created

- Confirm `STRIPE_WEBHOOK_SECRET` in `backend-node/.env` matches the `whsec_...` printed by `stripe listen`
- Confirm the backend was restarted after setting the secret
- Check the backend terminal for `[webhook]` log lines
- Run `stripe listen --forward-to http://localhost:8080/api/webhooks/stripe` again if the CLI session expired

### "POST /api/checkout/intent" returns 500

- Confirm `STRIPE_SECRET_KEY` is set in `backend-node/.env` and starts with `sk_test_`
- The backend throws on startup if `STRIPE_SECRET_KEY` is missing — check for a startup error in the backend terminal

### Image upload fails in admin panel ("Image upload failed")

- Confirm `PRODUCT_IMAGES_BUCKET` is set in `backend-node/.env` to a real S3 bucket name.
- Confirm your local AWS credentials have `s3:PutObject` on that bucket (`aws configure` or `AWS_PROFILE`).
- Confirm the bucket has a CORS rule allowing `PUT` from `http://localhost:5173` (or `*` for dev convenience).
- If `PRODUCT_IMAGES_BUCKET` is not set, the presign endpoint returns 503 — you will see "Image upload failed" in the dialog. Products can still be saved without an image.

### Admin product image upload returns 503

- `PRODUCT_IMAGES_BUCKET` is not set in `backend-node/.env`. Add it and restart the backend.
