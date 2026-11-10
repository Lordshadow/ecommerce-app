# ApexStore APIs and MCP tools

This document describes the routes and MCP tools currently implemented in this repository. The backend listens on port `5000` by default. The storefront REST API and the assistant API share that backend, but use different authentication and response shapes.

## Contents

- [Base URL and conventions](#base-url-and-conventions)
- [Storefront REST API](#storefront-rest-api)
- [Scoped assistant API](#scoped-assistant-api)
- [MCP server](#mcp-server)
- [Configuration and limits](#configuration-and-limits)
- [Current limitations](#current-limitations)

## Base URL and conventions

Local API base URL: `http://localhost:5000/api`.

- Send JSON request bodies with `Content-Type: application/json`.
- Storefront account and staff routes use the `apex_session` HTTP-only cookie. Browser clients should send requests with credentials enabled.
- The assistant API uses a scoped bearer token in `Authorization: Bearer <token>`.
- `GET /` and `GET /api` return API status and an endpoint summary.
- The backend allows credentialed browser requests from `FRONTEND_ORIGIN` (defaults to `http://localhost:3000`).

## Storefront REST API

These are the storefront, account, checkout, and staff routes implemented in `backend/src/server.js`.

### Catalog and public information

| Method and path | Query/body | Purpose |
|---|---|---|
| `GET /api/categories` | — | Category names, metadata, and active product counts. |
| `GET /api/products` | `search`, `category`, `minPrice`, `maxPrice`, `minRating`, `inStock`, `featured`, `sort`, `page`, `limit` | Search and filter active products. `limit` is clamped to 1–100; default is 12. Sort values include `featured`, `price-asc`, `price-desc`, `rating`, `newest`, and `title-asc`. |
| `GET /api/products/{id}` | — | Product information, specifications, FAQs, reviews, and related products. |
| `GET /api/assistant/v1/catalog/export` | `page`, `limit` (1–100) | Token-protected read-only export of active product IDs, names, descriptions, and FAQs for knowledge indexing (`catalog:read`). |
| `GET /api/coupons/validate?code=CODE` | — | Validate an active coupon and return its discount and minimum spend. |
| `GET /api/stats` | — | Store product, order, revenue, and category totals. |
| `POST /api/reviews` | JSON body | Submit a product review. |

Example catalog request:

```sh
curl 'http://localhost:5000/api/products?search=headphones&inStock=true&page=1&limit=12'
```

Product detail example:

```sh
curl 'http://localhost:5000/api/products/42'
```

Review body:

```json
{
  "product_id": 42,
  "author": "Alex",
  "rating": 5,
  "comment": "Works well"
}
```

### Authentication and account

| Method and path | Purpose |
|---|---|
| `POST /api/auth/register` | Register and send an email verification code. Body: `{ "name", "email", "password" }`. |
| `POST /api/auth/verify-email` | Verify the code. Body: `{ "email", "code" }`. Starts a session and returns a signed `customer_token`. |
| `POST /api/auth/login` | Sign in. Body: `{ "email", "password" }`. Sets the session cookie and returns a signed `customer_token`. |
| `POST /api/auth/request-password-reset` | Request a reset code. Body: `{ "email" }`. |
| `POST /api/auth/reset-password` | Reset password. Body: `{ "email", "code", "password" }`. |
| `GET /api/auth/me` | Return the current account and a fresh signed `customer_token`, or `user: null`. |
| `POST /api/auth/logout` | Revoke the current session and clear the cookie. |
| `PATCH /api/account/profile` | Update the signed-in customer name. Body: `{ "name" }`. |
| `GET /api/account/orders` | List the signed-in customer's orders, status history, and refunds. |
| `POST /api/account/orders/{order_id}/refunds` | Create a refund request for selected purchased quantities. Body includes `items: [{ "product_id", "quantity" }]` and a `reason`. This customer-facing route creates a `Requested` refund for staff review. |

Register and verify example:

```sh
curl -i -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alex Customer","email":"alex@example.com","password":"a-long-password"}'

curl -i -X POST http://localhost:5000/api/auth/verify-email \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","code":"123456"}'
```

For browser requests to account routes, include the session cookie (`credentials: 'include'` in `fetch`). The signed customer token is a separate one-hour RS256 JWT used by the assistant API and widget integrations.

### Orders and checkout

| Method and path | Purpose |
|---|---|
| `POST /api/orders` | Place an order. Body fields include customer name/email, shipping address, and `items: [{ "id", "quantity" }]`; optional fields include phone, city, postal code, payment method, and coupon code. The backend reads product prices and validates stock before creating the order. A signed-in order is attached to the account; checkout also supports guest orders. |
| `GET /api/orders/{order_id}` | Return order details and status history. Signed-in orders are hidden from anyone other than their owner; guest orders are looked up by ID. |

Example checkout body:

```json
{
  "customer_name": "Alex Customer",
  "customer_email": "alex@example.com",
  "customer_phone": "+15555550123",
  "shipping_address": "1 Main Street",
  "city": "Example City",
  "postal_code": "12345",
  "items": [{ "id": 42, "quantity": 1 }],
  "coupon_code": "SAVE20"
}
```

### Staff order and refund management

All `/api/admin/*` endpoints require a valid session for an email listed in `ADMIN_EMAILS`. Non-GET requests also validate the request origin.

| Method and path | Purpose |
|---|---|
| `GET /api/admin/orders` | Staff order queue with item snapshots, history, and refund summaries. |
| `GET /api/admin/refunds` | Staff refund queue with customer/order summaries and requested items. |
| `PATCH /api/admin/orders/{order_id}/status` | Advance an allowed order status. Body: `{ "status", "note?" }`. Moving an order to `Delivered` records its delivery time. |
| `PATCH /api/admin/refunds/{refund_id}/review` | Staff decision. Body: `{ "status": "Approved" | "Rejected", "note?" }`. `Approved` sends the refund immediately through the configured payment adapter; `Rejected` requires a reason. |
| `POST /api/admin/refunds/{refund_id}/process` | Legacy/manual recording route for an already-approved refund. The current dashboard approval flow issues the refund during the review call. |

## Scoped assistant API

Base URL: `http://localhost:5000/api/assistant/v1`.

### Local demo payment provider

`POST /api/test/payment-refunds` simulates the provider adapter response without moving money. It is available only when `ENABLE_TEST_REFUND_ENDPOINT=true` and `NODE_ENV` is not `production`, and it requires `Authorization: Bearer <PAYMENT_API_KEY>` plus an `Idempotency-Key` header. The request uses the provider refund payload fields (`order_id`, `amount`, `currency`, `items`, and `refund_id`). A successful response contains a deterministic `test_refund_…` ID, `test_mode: true`, and `money_moved: false`; reuse of an idempotency key with a different payload returns HTTP 409. Idempotency records are held in memory for this demo endpoint. Configure `PAYMENT_REFUND_URL=http://127.0.0.1:5000/api/test/payment-refunds` to exercise existing automatic and staff refund flows locally. Production mode always hides this route.

The assistant API returns reduced fields and enforces machine credential scopes. Protected routes require a bearer token configured in `SHOP_API_KEYS`. Every order lookup requires `customer_id`; order reads also require a valid signed `customer_token` whose subject matches that customer. An order owned by another customer returns `NOT_FOUND`.

### Public assistant endpoints

| Method and path | Purpose |
|---|---|
| `GET /.well-known/jwks.json` | Publish the customer token verification key. Full path: `/api/assistant/v1/.well-known/jwks.json`. |
| `GET /health` | API liveness check. |

### Protected catalog endpoints (`catalog:read`)

| Method and path | Query | Purpose |
|---|---|---|
| `GET /products` | `query`, `category`, `min_price`, `max_price` | Search or browse up to 50 candidates. Includes price, offer price, and stock flag. |
| `GET /products/{product_id}` | — | Minimal product description and specifications. |
| `GET /products/{product_id}/price` | — | Current price, offer price, and in-stock flag. |
| `GET /catalog/export?page=1&limit=100` | `page`, `limit` (1–100) | Stable paginated export of active catalog entries and FAQs for server-side knowledge indexing. |

Example:

```sh
curl 'http://localhost:5000/api/assistant/v1/products?query=headphones&min_price=20&max_price=200' \
  -H 'Authorization: Bearer YOUR_SHOP_API_TOKEN'
```

### Protected order endpoints (`orders:read`)

| Method and path | Required inputs | Purpose |
|---|---|---|
| `GET /customers?phone=...` | Phone number | Return zero or more masked customer candidates. |
| `GET /customers/{customer_id}/orders` | `limit`, `customer_token` query parameters | List up to 50 recent orders belonging to that customer. |
| `GET /orders/{order_id}` | `customer_id`, `customer_token` query parameters | Return status, purchased item summary, expected delivery, and payment summary. |
| `GET /orders/{order_id}/tracking` | `customer_id`, `customer_token` query parameters | Return status events. |

Example owner-scoped order request:

```sh
curl 'http://localhost:5000/api/assistant/v1/orders/ORD-20261102-4821?customer_id=17&customer_token=SIGNED_CUSTOMER_TOKEN' \
  -H 'Authorization: Bearer YOUR_SHOP_API_TOKEN'
```

### Refund endpoints

| Method and path | Scope | Inputs and behavior |
|---|---|---|
| `GET /orders/{order_id}/refund-eligibility` | `refunds:read` | Query parameters: `customer_id`, `customer_token`, and URL-encoded JSON `items`, e.g. `[{"product_id":42,"quantity":1}]`. Returns `{ "eligible", "reason", "amount", "currency" }`. |
| `POST /orders/{order_id}/otp` | `refunds:create` | Body: `{ "customer_id", "customer_token" }`. Sends a one-time code to the order email and returns a masked address. |
| `POST /orders/{order_id}/otp/verify` | `refunds:create` | Body: `{ "customer_id", "customer_token", "code" }`. Returns an order-bound `verification_token`. |
| `POST /refunds` | `refunds:create` | Requires `Idempotency-Key` header (or `idempotency_key` in body), customer/order IDs, selected items, and the verified token. The server computes the amount from the order; callers do not choose it. |
| `GET /refunds/{refund_id}` | `refunds:read` | Query parameters: `customer_id`, `customer_token`. Returns the current refund state only for the owner. |

Refund creation body:

```json
{
  "customer_id": 17,
  "order_id": "ORD-20261102-4821",
  "items": [{ "product_id": 42, "quantity": 1 }],
  "verification_token": "ORDER_BOUND_OTP_TOKEN",
  "idempotency_key": "refund-ORD-20261102-4821-request-1"
}
```

The automatic assistant refund path requires a delivered order within the 30-day return window, unreserved purchased quantities, INR currency, and a server-computed refund no greater than ₹2,000. The provider adapter must be configured before funds can be issued. Repeating a request with the same idempotency key returns the same refund record.

Assistant API errors use a stable envelope, for example:

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "The requested resource was not found." }
}
```

Codes include `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `NOT_ELIGIBLE`, `RATE_LIMITED`, `TEMPORARILY_UNAVAILABLE`, and `INVALID_REQUEST`. Eligibility denials from the GET eligibility route are returned as HTTP 200 with `eligible: false`; a denied refund POST returns HTTP 409.

## MCP server

The MCP server is `backend/src/mcp-server.js`. It uses **stdio JSON-RPC**, not a network-hosted MCP endpoint. An MCP client starts it as a child process; the server calls only the scoped shop API and does not connect to SQLite.

### Client configuration

For an MCP client that supports stdio servers, configure a server entry similar to:

```json
{
  "mcpServers": {
    "apexstore": {
      "command": "node",
      "args": ["E:/ecommerce-app/backend/src/mcp-server.js"],
      "env": {
        "SHOP_API_URL": "http://localhost:5000/api/assistant/v1",
        "SHOP_API_TOKEN": "YOUR_SHOP_API_TOKEN"
      }
    }
  }
}
```

Alternatively, run it manually from `backend`:

```sh
SHOP_API_URL=http://localhost:5000/api/assistant/v1 \
SHOP_API_TOKEN=YOUR_SHOP_API_TOKEN \
npm run mcp
```

The MCP client should send `initialize`, then `tools/list`, and invoke tools through `tools/call`. `SHOP_API_TOKEN` must have the scopes required by the tools you expose. Keep this credential in the MCP host environment; do not put it in frontend JavaScript.

### Available tools

| Tool | Inputs | Required scope / notes |
|---|---|---|
| `search_products` | Optional `query`, `category`, `min_price`, `max_price` | `catalog:read` |
| `get_product` | `product_id` | `catalog:read` |
| `get_product_price` | `product_id` | `catalog:read`; use for live price/stock |
| `find_customer_by_phone` | `phone` | `orders:read`; results are masked candidates |
| `list_customer_orders` | `customer_id`, `customer_token`, optional `limit` | `orders:read` plus matching signed token |
| `get_order` | `order_id`, `customer_id`, `customer_token` | `orders:read` plus matching signed token |
| `get_order_tracking` | `order_id`, `customer_id`, `customer_token` | `orders:read` plus matching signed token |
| `check_refund_eligibility` | `order_id`, `customer_id`, `customer_token`, `items` | `refunds:read` plus matching signed token |
| `send_refund_otp` | `order_id`, `customer_id`, `customer_token` | `refunds:create`; sends email OTP |
| `verify_refund_otp` | `order_id`, `customer_id`, `customer_token`, `code` | `refunds:create`; returns order-bound verification token |
| `create_refund` | `order_id`, `customer_id`, `items`, `verification_token`, `idempotency_key` | `refunds:create`; server validates amount and eligibility |
| `get_refund` | `refund_id`, `customer_id`, `customer_token` | `refunds:read` plus matching signed token |

## Configuration and limits

- `SHOP_API_KEYS` is a JSON object mapping each high-entropy bearer token to a label and its scopes. Example value:

  ```json
  {"replace-with-a-long-random-token":{"name":"mcp","scopes":["catalog:read","orders:read","refunds:read","refunds:create"]}}
  ```

- Read calls are limited to 120 per minute per credential; refund creation is limited to 10 per minute per credential. OTP code issuance additionally has a one-minute cooldown and a five-per-hour limit per email/purpose.
- MCP HTTP calls time out after 10 seconds. Payment provider calls time out after `PAYMENT_TIMEOUT_MS` (default 8000 ms).
- Set a persistent RSA PEM in `CUSTOMER_TOKEN_PRIVATE_KEY` and issuer in `CUSTOMER_TOKEN_ISSUER` in production. The public key endpoint is the JWKS route above.
- Set `PAYMENT_REFUND_URL` and `PAYMENT_API_KEY` to enable refund issuance. The adapter sends `POST` JSON containing `order_id`, `amount`, `currency`, `items`, and `refund_id`, plus a bearer credential and `Idempotency-Key` header. The configured provider endpoint must honor idempotency.

## Current limitations

- The normal storefront catalog detail route includes FAQs. The scoped assistant product detail route currently returns description and specifications, but does not yet include FAQs or a bulk catalog export/change feed.
- Checkout currently records USD orders. Those orders do not qualify for the assistant's automatic INR refund path; they must be handled by staff/provider policy.
- The widget's signed customer token comes from `/api/auth/me`; the Gateway's tenant origin allowlist is configured in the separate Gateway application.
- The old `POST /api/ai/chat` endpoint only returns general navigation guidance. Live shop operations are exposed as MCP tools.
- The stdio MCP server is not directly usable as a remote HTTP MCP service without a hosting/transport adapter.
