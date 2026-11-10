## [AUTH-CATALOG-001] - Storefront catalog and authentication upgrade
**Timestamp:** 2026-11-03 12:20:33 (Asia/Kolkata)  
**Status:** VERIFIED  
**Objective & Rationale ("Why"):**
- Implement customer accounts with email OTP verification and reset, authenticated order history, guest checkout, and a 2,000-listing catalog with source-backed descriptions, specifications, FAQs, and attribution.

**Architectural Boundaries & Modularity:**
- Kept the Node.js HTTP API, SQLite database, and Next.js app. Added auth/session/email modules, additive catalog sync with a versioned source snapshot, account UI, and source attribution. Imported listings use demo stock and image fallbacks; ratings remain empty where the source provides none.

**Files Touched:**
- `README.md` (Modified - setup, auth, data source, and API documentation)
- `logs.md` (Modified - task progress and verification record)
- `backend/package.json` (Modified - SMTP package, catalog refresh, and test scripts)
- `backend/package-lock.json` (Modified - Nodemailer dependency lock)
- `backend/src/auth.js` (Created - password hashing, OTP, sessions, and rate limits)
- `backend/src/mail.js` (Created - SMTP mail delivery and development OTP output)
- `backend/src/server.js` (Modified - auth/account routes, product fields, order ownership, CORS, active catalog filtering)
- `backend/src/db/database.js` (Modified - product, user, OTP, session, and order schema migrations)
- `backend/src/db/seed.js` (Modified - additive 2,000-product seed and sourced product sync)
- `backend/src/db/download-catalog.js` (Created - deterministic public dataset importer and listing enrichment)
- `backend/src/db/catalog-source.json` (Created - 1,900 source listing snapshot)
- `backend/test/storefront.test.js` (Created - account, OTP, sessions, catalog, and order acceptance checks)
- `frontend/app/account/page.js` (Created - sign-in, registration, verification, reset, profile, order history)
- `frontend/app/page.js` (Modified - catalog count and listing copy)
- `frontend/app/layout.js` (Modified - store metadata)
- `frontend/app/checkout/page.js` (Modified - session prefill and cookie-backed order placement)
- `frontend/app/orders/page.js` (Modified - session-backed order tracking)
- `frontend/app/order-confirmation/[id]/page.js` (Modified - authenticated order fetch)
- `frontend/app/product/[id]/page.js` (Modified - specs, FAQs, source-data notice, honest ratings)
- `frontend/app/cart/page.js` (Modified - catalog copy)
- `frontend/app/wishlist/page.js` (Modified - catalog copy)
- `frontend/components/Navbar.js` (Modified - account navigation and live session label)
- `frontend/components/ProductCard.js` (Modified - no fabricated ratings or review counts)
- `frontend/components/Footer.js` (Modified - data-source attribution and listing caveat)
- `frontend/components/CartDrawer.js` (Modified - catalog copy)
- `frontend/components/AIAssistant.js` (Modified - catalog copy)

**Verification & Quality Assurance:**
- Commands executed: `npm run seed` (repeat run); `npm test`; `npm run build`; Node syntax checks for backend modules; SQLite catalog-count queries.
- Test results: 1 acceptance test passed with checks for catalog detail fields, registration, valid/invalid/expired OTP, email cooldown, sign-in/out, password reset, session expiry, profile update, account order privacy, guest checkout, and tracking. Production frontend build succeeded. Database remained at exactly 2,000 rows after reseeding: 1,900 sourced listings, 2,000 FAQs, 696 listings with explicit structured specifications, 256 existing reviews, 4 coupons, 8 categories, 0 test users, and 0 test orders.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- None.

## 2026-11-03-docker-recreate - Recreate project containers
**Timestamp:** 2026-11-03 16:14:42 +05:30  
**Status:** COMPLETED  
**Objective & Rationale ("Why"):**  
- Rebuild and recreate the project's Docker services from the current compose configuration.

**Architectural Boundaries & Modularity:**
- Recreated the existing backend and frontend services; retained the named `storefront-data` volume.

**Files Touched:**
- `logs.md` (Action: Modified - recorded container recreation and status)

**Verification & Quality Assurance:**
- Commands executed: `docker compose up --build -d --force-recreate`; `docker compose ps`.
- Results: both images built; backend reports healthy; frontend reports running with ports 3000 and 5000 published. No tests run.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- None.

## [ACCOUNT-UI-001] - Refresh account sign-in page and clarify staff entry
**Timestamp:** 2026-11-03 14:37:18 (Asia/Kolkata)  
**Status:** VERIFIED  
**Objective & Rationale ("Why"):**
- Improve the storefront account sign-in/register experience and make the existing allowlisted staff entry discoverable without weakening admin authorization.

**Architectural Boundaries & Modularity:**
- Login, registration, OTP verification, password-reset, and account APIs are unchanged. Store staff continue signing in through the same verified customer account; API authorization still depends on `ADMIN_EMAILS`.

**Files Touched:**
- `frontend/app/account/page.js` (Modified - responsive storefront-style sign-in/register screen and staff order-management link)
- `logs.md` (Modified - this task record)

**Verification & Quality Assurance:**
- Commands executed: `docker compose up --build -d`; in-app browser opened `http://localhost:3000/account` and read rendered page accessibility state.
- Test results: Docker production build passed and the rendered sign-in page contains the new branded layout, sign-in/register switch, password recovery, and order-management link.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- Add the store staff verified email address to `ADMIN_EMAILS` in local `.env` and recreate the backend to grant dashboard access.

## [SMTP-LOCAL-001] - Enable local OTP flow without SMTP
**Timestamp:** 2026-11-03 13:00:48 (Asia/Kolkata)  
**Status:** VERIFIED  
**Objective & Rationale ("Why"):**
- Resolve local Docker registration/reset failures when SMTP credentials are not available while retaining SMTP as the production email delivery path.

**Architectural Boundaries & Modularity:**
- Compose now accepts `NODE_ENV` from `.env`. Local development mode uses the existing mail adapter's development-only OTP log output; production mode still requires SMTP.

**Files Touched:**
- `docker-compose.yml` (Modified - allow local/prod Node environment configuration)
- `.env` (Modified locally - enabled development OTP logging; ignored by Git)
- `.env.example` (Modified - documents local development mode)
- `README.md` (Modified - explains local OTP log and production SMTP needs)
- `logs.md` (Modified - this task record)

**Verification & Quality Assurance:**
- Commands executed: `docker compose up -d`; `docker compose ps`; `docker compose exec -T backend node -p "process.env.NODE_ENV"`; `Invoke-RestMethod http://localhost:5000/api/stats`.
- Test results: backend reports `development`, is healthy, and API reports 2,000 products. OTP values were not requested or exposed during verification.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- Add real SMTP credentials to `.env` and set `NODE_ENV=production` when email delivery or deployment is required.

## [ORDERS-REFUNDS-001] - Add protected order operations and refund workflow
**Timestamp:** 2026-11-03 14:24:12 (Asia/Kolkata)  
**Status:** VERIFIED  
**Objective & Rationale ("Why"):**
- Provide customers with their account orders and per-product refund requests, and give explicitly allowlisted staff a protected dashboard to review orders, manage fulfillment statuses, and review/record refunds.

**Architectural Boundaries & Modularity:**
- `ADMIN_EMAILS` is an environment allowlist; customer signup cannot grant staff permissions. API authorization is checked on each admin request.
- SQLite stores order status audit events and refund requests. Refund amount calculation uses purchased-item snapshots and prorates order discounts/tax while excluding shipping.
- Staff must send approved refunds through their payment provider separately, then record the action in the dashboard; no payment processor is connected.

**Files Touched:**
- `backend/src/db/database.js` (Modified - additive status-history and refund-request tables and indexes; backfill existing order states)
- `backend/src/server.js` (Modified - staff authorization, status transitions, refund request/review/processing APIs, order audit history)
- `docker-compose.yml` (Modified - pass `ADMIN_EMAILS` into backend)
- `.env.example` (Modified - document optional staff allowlist)
- `frontend/app/admin/orders/page.js` (Created - staff order/refund dashboard)
- `frontend/app/account/page.js` (Modified - customers can see refund states and request refunds for selected quantities)
- `frontend/app/orders/page.js` (Modified - show actual order progress and status history)
- `frontend/components/Navbar.js` (Modified - show management link to allowlisted staff)
- `README.md` (Modified - describe staff access, refunds, and endpoint behavior)
- `logs.md` (Modified - this task record)

**Verification & Quality Assurance:**
- Commands executed: `node --check backend/src/server.js`; `node --check backend/src/db/database.js`; `npm run build` from `frontend`; `docker compose up --build -d`; `docker compose ps`; API stats/status smoke requests; SQLite schema query in backend container.
- Test results: production frontend build succeeded and includes `/admin/orders`; both Compose services are running with backend healthy; SQLite has `orders`, `order_status_history`, and `refund_requests`; product stats remain 2,000; unauthenticated admin API responds 401. Automated tests were not run.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- Set the verified staff account email in local `.env` as `ADMIN_EMAILS=...`, recreate the backend, and sign in to use `/admin/orders`.

## [ORDERS-PAGE-001] - Show customer order list without manual ID lookup
**Timestamp:** 2026-11-03 14:34:06 (Asia/Kolkata)  
**Status:** VERIFIED  
**Objective & Rationale ("Why"):**
- Let signed-in customers find and track their account orders directly from the Orders page, without copying an order reference, while preserving guest lookup.

**Architectural Boundaries & Modularity:**
- The page checks the current customer session and loads only orders from the existing owner-scoped account API. Guest visitors keep the order-ID lookup.

**Files Touched:**
- `frontend/app/orders/page.js` (Modified - automatically list signed-in customer orders with item summaries, statuses, refund indicators, and one-click tracking)
- `README.md` (Modified - document signed-in and guest order discovery)
- `logs.md` (Modified - this task record)

**Verification & Quality Assurance:**
- Commands executed: `docker compose up --build -d`; `docker compose ps`; `Invoke-WebRequest http://localhost:3000/orders`; `Invoke-RestMethod http://localhost:5000/api/stats`.
- Test results: container frontend production build succeeded; services are running; Orders page returned HTTP 200; API continues reporting 2,000 catalog products. Local Next.js build was blocked by a Windows `.next` directory EPERM error, so Docker build was used successfully instead.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- None.

## [DOCKER-001] - Containerize storefront and API
**Timestamp:** 2026-11-03 12:46:37 (Asia/Kolkata)  
**Status:** VERIFIED  
**Objective & Rationale ("Why"):**
- Provide repeatable Docker images and Compose startup for the Next.js storefront and SQLite-backed API, with persistent catalog/order/account data.

**Architectural Boundaries & Modularity:**
- Separate frontend and backend images; Compose wires the public ports and API origin. SQLite is stored in a named volume at `/data`, and the backend runs the existing additive catalog seed on startup.

**Files Touched:**
- `backend/Dockerfile` (Created - production Node API image and seed-on-start command)
- `backend/.dockerignore` (Created - exclude local dependencies, database, and env files)
- `backend/src/db/database.js` (Modified - allow configurable persistent database path)
- `frontend/Dockerfile` (Created - multi-stage Next.js production image)
- `frontend/.dockerignore` (Created - exclude local dependencies, build output, and env files)
- `docker-compose.yml` (Created - frontend/API services, health check, and persistent volume)
- `.dockerignore` (Created - exclude local development artifacts)
- `.gitignore` (Created - keep generated secrets, local dependencies, build output, and SQLite files out of source control)
- `.env` (Created locally - generated session secret; ignored by Git and Docker build context)
- `.env.example` (Created - documented Docker runtime configuration)
- `README.md` (Modified - Docker setup/run instructions)
- `logs.md` (Modified - this task record)

**Verification & Quality Assurance:**
- Commands executed: `docker compose up --build -d`; `docker compose ps`; `Invoke-RestMethod http://localhost:5000/api/stats`; `Invoke-WebRequest http://localhost:3000`; Node syntax checks and `npm run seed` from the earlier setup.
- Test results: backend and frontend images built; both containers started, backend is healthy, storefront returned HTTP 200, and API stats returned 2,000 products and 8 categories. Docker Engine access required an elevated command after launching Docker Desktop. SMTP is not configured in the local `.env`, so email verification and password recovery need SMTP settings before those mail flows can deliver messages.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- None.


## [2026-11-03-03] - Configure local demo admin password
**Timestamp:** 2026-11-03 14:53 Asia/Calcutta  
**Status:** VERIFIED  
**Objective & Rationale ("Why"):**
- Enable reliable staff sign-in for a local application demo without putting the plaintext password into tracked source code or requiring email OTP for the initial admin account.

**Architectural Boundaries & Modularity:**
- Added an opt-in development-only startup initializer. It derives and stores salted password hashes in the existing users table, and marks allowlisted demo admins email-verified. Production startup rejects this local-only setting.
- The configured demo password is held in ignored `.env`; backend restart resets allowlisted demo account passwords to that configured value.

**Files Touched:**
- `backend/src/server.js` (Modified - initialize local allowlisted demo accounts on startup)
- `docker-compose.yml` (Modified - pass local demo password to backend)
- `.env.example` (Modified - document the optional local-only setting)
- `README.md` (Modified - document behavior and production restriction)
- `.env` (Modified locally, ignored - configured the requested demo password; value intentionally not recorded here)
- `logs.md` (Modified - this task record)

**Verification & Quality Assurance:**
- Commands executed: `node --check backend/src/server.js`; `docker compose up -d --build --force-recreate backend`; `docker compose ps`; filtered backend startup logs.
- Results: syntax check passed; backend image built; backend is healthy; startup log confirms one local demo admin account initialized. Frontend container remains running.
- Tests were not run.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- None.

## [2026-11-03-04] - Allow PATCH in backend CORS policy
**Timestamp:** 2026-11-03 14:57 Asia/Calcutta  
**Status:** VERIFIED  
**Objective & Rationale ("Why"):**
- Fix admin order status updates failing browser preflight because the backend CORS method list omitted PATCH.

**Architectural Boundaries & Modularity:**
- Updated the common API response headers and OPTIONS preflight headers to advertise the PATCH method already used by the admin order status endpoint.

**Files Touched:**
- `backend/src/server.js` (Modified - include PATCH in both CORS method headers)
- `logs.md` (Modified - this task record)

**Verification & Quality Assurance:**
- Commands executed: `node --check backend/src/server.js`; `docker compose up -d --build --force-recreate backend`; OPTIONS preflight via `curl.exe`; `docker compose ps`.
- Results: syntax check passed; preflight returned HTTP 204 and `Access-Control-Allow-Methods` includes PATCH; backend healthy and frontend running.
- Tests were not run.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- None.

## [REFUNDS-2026-11-10-01] - Verify low-value automatic refund path
**Timestamp:** 2026-11-10 16:26 Asia/Calcutta  
**Status:** VERIFIED WITH ENVIRONMENT BLOCKER  
**Objective & Rationale ("Why"):**
- Determine whether refunds at or below ₹2,000 auto-approve and why the recent low-value account return remained Requested.

**Architectural Boundaries & Modularity:**
- The customer account return endpoint intentionally creates `Requested` entries for staff review. A separate assistant API can issue eligible INR refunds up to ₹2,000 after delivery, within 30 days, and OTP verification. Payment issuance requires the configured provider adapter.
- The local `.env` has no `PAYMENT_REFUND_URL` or `PAYMENT_API_KEY`; the provider adapter fails closed when these are absent. No code change was made because changing status without an issuer would falsely represent a refund as approved/paid.

**Files Touched:**
- `logs.md` (Modified - recorded diagnosis and verification)

**Verification & Quality Assurance:**
- Commands executed: `npm test` from `backend`; read-only inspection of return routes and local environment configuration.
- Test results: 2/2 backend tests passed, including assistant refund credential, ownership, and idempotency coverage. Account-return behavior is separate and remains staff-reviewed.

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- Configure a real payment refund endpoint and API key in the local backend environment before attempting provider-backed automatic refunds.

## [REFUNDS-2026-11-10-02] - Add a local test refund provider endpoint
**Timestamp:** 2026-11-10 16:32 Asia/Calcutta  
**Status:** VERIFIED; CONTAINER REBUILD BLOCKED BY DOCKER ENGINE  
**Objective & Rationale ("Why"):**
- Enable a realistic low-value refund demo without a payment processor or movement of funds.

**Architectural Boundaries & Modularity:**
- Added a local-only provider-compatible endpoint requiring an explicit feature flag and bearer credential. It is hidden in production, validates payloads, and honors idempotency within the process. It returns `test_mode: true` and `money_moved: false`.
- Wired Compose and local `.env` to use the test endpoint with a demo-only key. The existing refund flow can now use the configured adapter when the services restart.

**Files Touched:**
- `backend/src/server.js` (Modified - gated simulated refund provider endpoint)
- `backend/test/storefront.test.js` (Modified - test gating, auth, payload validation, idempotency, and production disablement)
- `docker-compose.yml` (Modified - pass the explicit demo endpoint enable flag)
- `.env` (Modified - local development-only mock endpoint settings and fake key)
- `.env.example` (Modified - document disabled-by-default flag)
- `README.md`, `docs/API.md` (Modified - demo setup and endpoint contract)
- `logs.md` (Modified - this task record)

**Verification & Quality Assurance:**
- Commands executed: `node --check src/server.js`; `node --check test/storefront.test.js`; `npm test` from `backend`; `docker compose config --quiet`; `docker info`.
- Test results: 3/3 backend tests passed. Compose configuration validates. Docker rebuild was skipped because `docker info` failed to connect to `npipe:////./pipe/dockerDesktopLinuxEngine` (permission denied).

**Git Commit:**
- Commit Hash & Message: not committed.

**Next Planned Task (Awaiting User Permission):**
- Rebuild and restart the Compose services once Docker Desktop grants access to its engine.
