# ApexStore — e-commerce storefront

A Next.js storefront backed by a Node.js HTTP API and SQLite. Its curated demo catalog contains 12 real computer products across laptops, PC components, and peripherals. The project includes customer accounts, email verification and password recovery, guest checkout, and order tracking.

## Stack and layout

- `frontend/` — Next.js 14 app, storefront pages, account UI, cart, and wishlist.
- `backend/src/server.js` — product, order, review, coupon, and account API.
- `backend/src/assistant-api.js` and `backend/src/mcp-server.js` — scoped shop API and stdio MCP adapter; MCP accesses data only through the API.
- `backend/src/db/database.js` — SQLite schema and non-destructive migrations.
- `backend/src/db/seed.js` — replaces the product catalog, product reviews, and catalog categories from the checked-in computer catalog while preserving orders, accounts, and return records.
- `backend/src/db/computer-catalog.json` — researched manufacturer product descriptions, specifications, FAQs, and source links for the demo catalog.

## Start locally

Use Node.js 22.5 or newer and npm. The backend uses Node’s built-in `node:sqlite`.

1. In one terminal, configure email and session settings, then run the backend:

```powershell
cd backend
$env:AUTH_SECRET = 'use-a-long-random-secret-here'
$env:FRONTEND_ORIGIN = 'http://localhost:3000'
$env:SMTP_HOST = 'smtp.example.com'
$env:SMTP_PORT = '587'
$env:SMTP_USER = 'your-smtp-user'
$env:SMTP_PASS = 'your-smtp-password'
$env:SMTP_FROM = 'ApexStore <support@example.com>'
npm run seed
npm start
```

2. In another terminal, run the storefront:

```powershell
cd frontend
$env:NEXT_PUBLIC_API_URL = 'http://localhost:5000'
npm run dev
```

Open `http://localhost:3000`. For local development without SMTP, verification and reset codes are printed in the backend terminal. Production requires `AUTH_SECRET` and SMTP configuration. Set `FRONTEND_ORIGIN` to the deployed storefront origin and use HTTPS so session cookies are marked Secure.

## Run with Docker

Install Docker Desktop, then from the project root copy `.env.example` to `.env` and set a unique, long `AUTH_SECRET`. The local example sets `NODE_ENV=development`; without SMTP, verification and password reset codes are printed in backend logs. To deliver real emails, configure SMTP settings in `.env`. Set `NODE_ENV=production` for deployment, and configure both SMTP and `AUTH_SECRET`. Start both services with:

```powershell
docker compose up --build -d
```

Open `http://localhost:3000`; the API is at `http://localhost:5000/api`. The backend seeds the catalog on first start and stores SQLite data in the persistent `storefront-data` volume. To stop the services while keeping data, run `docker compose down`. To follow logs, run `docker compose logs -f`; to remove the database volume too, run `docker compose down -v`.

The frontend API URL is embedded at build time. For a remote deployment, set `NEXT_PUBLIC_API_URL` to the publicly reachable API origin and `FRONTEND_ORIGIN` to the storefront origin before building. Set a real `AUTH_SECRET` and SMTP credentials in `.env`; the example fallback secret is only intended for local evaluation.

## Order management and refunds

- Customers who are signed in can see their own orders and request a partial refund for selected quantities from `/account`. Refund amounts are calculated from the order snapshot, apply discounts and tax proportionally, and exclude shipping.
- The `/orders` page automatically lists a signed-in customer’s orders without requiring an order ID. Guest customers can continue using the order ID lookup on that page.
- Add verified staff account email addresses to `ADMIN_EMAILS` in `.env` as a comma-separated list, then run `docker compose up -d --force-recreate backend`. Staff sign in normally and open `/admin/orders`. The backend checks the allowlist for every management API request; a customer account cannot grant itself staff access.
- For a local classroom/demo build only, `DEMO_ADMIN_PASSWORD` in `.env` initializes each `ADMIN_EMAILS` address as verified and sets its password at backend startup. The password is stored in SQLite as a salted hash. This setting is rejected when `NODE_ENV=production`; leave it unset for deployment. In this demo mode, restarting the backend resets the allowlisted account password to the configured value.
- New orders start in `Processing` (waiting for staff review). Staff can confirm or reject them, advance confirmed orders through preparation, shipping, and delivery, and review refund requests. Status changes are recorded in `order_status_history`; refund decisions and processing timestamps are recorded in `refund_requests`.
- New catalog prices, coupon thresholds, and orders use INR. Existing catalog prices are converted once at a fixed reference rate of ₹94.83 per US$1 when the database starts after this update; existing order snapshots keep their original currency, and new orders are explicitly recorded as INR. Shipping fees and the free-shipping threshold use the same conversion basis.
- The refund provider adapter sends automatic refunds and staff-approved refunds to the configured `PAYMENT_REFUND_URL`, honoring an idempotency key. Configure `PAYMENT_API_KEY` and the provider endpoint before enabling money movement; without them, refunds fail closed and do not move funds.
- For a local demo without a payment processor, you can point `PAYMENT_REFUND_URL` to `http://127.0.0.1:5000/api/test/payment-refunds`, set `ENABLE_TEST_REFUND_ENDPOINT=true`, and set `PAYMENT_API_KEY` to a demo-only secret in `.env`, then run `docker compose up -d --build`. The endpoint requires that bearer secret and is hidden whenever `NODE_ENV=production`; it returns a deterministic test receipt with `test_mode: true` and `money_moved: false`. Never use this endpoint or its demo credential in production.

The checked-in catalog is used by `npm run seed`. Seeding replaces all product, review, and category rows while preserving orders, accounts, coupons, and return/refund records. The catalog contains real computer models and manufacturer-verified technical facts. Demo prices and stock counts are illustrative, not live quotes or inventory. The seed preserves SQLite's product ID sequence, so older order snapshots cannot accidentally match newly listed products.

## Assistant API and MCP

The dedicated `/api/assistant/v1` API is the only interface the MCP server uses to read shop data. It returns minimal catalog and order fields, requires `customer_id` on order calls, and responds with not found for orders that do not belong to that customer. API credentials are configured in `SHOP_API_KEYS` as JSON mapping each high-entropy bearer secret to a name and scopes, for example:

```json
{"replace-with-a-long-random-token":{"name":"mcp","scopes":["catalog:read","orders:read","refunds:read","refunds:create"]}}
```

The supported scopes are `catalog:read`, `orders:read`, `refunds:read`, and `refunds:create`. Read calls are limited to 120 per minute per credential and refund calls to 10 per minute. The MCP HTTP client timeout is 10 seconds; payment provider timeout defaults to 8 seconds.

Run the stdio MCP server from `backend` with `npm run mcp`, setting `SHOP_API_URL` (defaults to `http://127.0.0.1:5000/api/assistant/v1`) and `SHOP_API_TOKEN` in the MCP host environment. It exposes product search/details/pricing, customer lookup, owner-scoped orders and tracking, refund eligibility, OTP verification, refund creation, and refund status tools. It does not import or open the SQLite database.

Customer login/verification responses include a one-hour RS256 customer token. The verification key is published at `/api/assistant/v1/.well-known/jwks.json`. Production must set `CUSTOMER_TOKEN_PRIVATE_KEY` to a persistent RSA private key (PEM; literal `\\n` sequences are accepted) and configure `CUSTOMER_TOKEN_ISSUER`. Refund actions send an OTP to the order email and require the resulting short-lived, order-bound verification token.

Refund eligibility requires delivery within 30 days, unreserved purchased quantities, INR currency, and a total of at most ₹2,000. New INR orders at or under the cap may be auto-refunded after OTP verification; higher amounts and orders whose currency is not INR require staff review. Configure `PAYMENT_REFUND_URL` and `PAYMENT_API_KEY` for a provider endpoint that accepts the documented JSON refund payload and honors the `Idempotency-Key` header. Until configured, refunds fail closed with `TEMPORARILY_UNAVAILABLE`. Staff Approve submits the existing refund through this same provider adapter and records its resulting status.

Assistant API errors use stable codes: `NOT_FOUND`, `NOT_ELIGIBLE`, `RATE_LIMITED`, `TEMPORARILY_UNAVAILABLE`, `UNAUTHORIZED`, `FORBIDDEN`, and `INVALID_REQUEST`.

## NovaRetail support widget

The storefront loads the hosted NovaRetail widget from `NEXT_PUBLIC_NOVARETAIL_GATEWAY_URL` (for example `http://localhost:8000`) when that setting is configured. `NEXT_PUBLIC_NOVARETAIL_TENANT` defaults to `tenant_novaretail`. The loader passes the gateway API base, the current product ID on product pages, and `getApexCustomerToken` as the token callback. The callback reads the signed customer token from `/api/auth/me` using the storefront session cookie. These `NEXT_PUBLIC_*` values are embedded at frontend build time, so rebuild the frontend after changing them.

Add the storefront's exact origin (such as `http://localhost:3000` in development or `https://shop.example.com` in production) to the tenant's `WIDGET_ALLOWED_ORIGINS` / `tenants.widget_origins` in the NovaRetail Gateway. The gateway is a separate application and must be configured there; this repo cannot update that allowlist. Also set the backend `FRONTEND_ORIGIN` to the storefront origin so credentialed customer-token requests are allowed. The widget stays disabled when the gateway URL is empty.

## Accounts and orders

- Create an account with an email and a password of at least 10 characters, then verify the emailed 6-digit code.
- Sign in with email and password. Reset forgotten passwords through a one-time email code.
- Sessions use random opaque tokens stored as hashes in SQLite and HTTP-only, SameSite=Lax cookies with a 7-day lifetime.
- Signed-in orders are attached to the customer account. Guest checkout and reference-based order lookup remain available.
- Profile name and signed-in order history are available from `/account`.

## Product data and attribution

The computer catalog has 10 real products across laptops, PC components, and peripherals. Product details, specifications, and product-specific FAQs are curated from official Lenovo, Acer, AMD, Intel, ASUS, Samsung, MSI, Kingston, Corsair, and Logitech pages linked in `backend/src/db/computer-catalog.json`. The products have no fabricated customer reviews. Prices and stock counts are clearly marked illustrative demo values and are not manufacturer quotes or live inventory.

The storefront is configured for India: prices are displayed in INR, GST is calculated at 18%, standard delivery is ₹49, express delivery is ₹99, and standard delivery is free above ₹999.

Run `npm run seed` from `backend` to replace catalog rows from `backend/src/db/computer-catalog.json`. The seed is transactional: if validation or insertion fails, the prior catalog is retained. Existing order snapshots, accounts, and return/refund records are preserved; product IDs are not reset so historical orders cannot accidentally resolve to a new product.

For local demos, the seed also creates two clearly labeled accounts with delivered orders and pending return requests:

- `demo.customer1@apexstore.local`
- `demo.customer2@apexstore.local`
- Password: `Demo-Account-2026!`

These accounts and records are for testing only. The seed is idempotent and does not create duplicate demo orders or returns.

## API overview

See [docs/API.md](docs/API.md) for route details, authentication, request examples, MCP setup, and tool schemas.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/products` | Search, filter, sort, and paginate products |
| `GET` | `/api/products/:id` | Product details, specifications, FAQs, reviews, and recommendations |
| `POST` | `/api/auth/register` | Create account and send verification code |
| `POST` | `/api/auth/verify-email` | Verify email and start a session |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/request-password-reset` | Request password-reset code |
| `POST` | `/api/auth/reset-password` | Set a new password and revoke sessions |
| `GET` | `/api/auth/me` | Check the current session |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/account/orders` | List orders for the signed-in account |
| `PATCH` | `/api/account/profile` | Update the customer’s name |
| `POST` | `/api/account/orders/:id/refunds` | Request a refund for selected purchased items |
| `GET` | `/api/admin/orders`, `/api/admin/refunds` | Staff order and refund queues (`ADMIN_EMAILS` allowlist required) |
| `PATCH` | `/api/admin/orders/:id/status` | Approve/reject an order or advance fulfillment |
| `PATCH` | `/api/admin/refunds/:id/review` | Approve or reject a refund request |
| `POST` | `/api/admin/refunds/:id/process` | Record that an approved refund was issued externally |
| `POST` | `/api/orders` | Place a guest or authenticated order |
| `GET` | `/api/orders/:id` | Track an order; authenticated orders require their owner’s session |
| `GET` | `/api/categories` | List departments and product counts |
| `GET` | `/api/stats` | Store totals |
