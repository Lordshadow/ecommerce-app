# Deploy ApexStore on Google Cloud Run

This project deploys two Cloud Run services from `cloudbuild.yaml`:

- `apexstore-api`: Node.js API connected to the `apexstore` database in Cloud SQL PostgreSQL.
- `apexstore-web`: Next.js storefront built with the API service URL.

The API database adapter uses Cloud SQL’s Unix socket. SQLite remains the local development default. Existing SQLite orders and accounts are not imported by this deployment; the first-run seed job loads the checked-in demo catalog and sample demo records.

## Cloud resources and secrets

Use project `ai-support-assistant-2026` and region `asia-south1` as currently configured. Confirm that `ai-support-db` contains the `apexstore` database and the `apexstore-app` user assigned the `apexstore_app_role`. The Cloud SQL instance connection name is configured in `cloudbuild.yaml`.

Create an Artifact Registry Docker repository named `apexstore-images` in `asia-south1` before running Cloud Build.

Create these Secret Manager secrets and add a version to each before deploying:

| Secret name | Secret value |
| --- | --- |
| `apexstore-db-password` | Password for the `apexstore-app` database user; this was already created during setup. |
| `apexstore-auth-secret` | New, random, high-entropy secret used to sign application session codes. |
| `apexstore-customer-token-private-key` | Persistent RSA private key in PEM format for customer JWTs. |
| `apexstore-shop-api-keys` | JSON map of scoped bearer tokens for the assistant API. |
| `apexstore-smtp-user` | SMTP account username/email. |
| `apexstore-smtp-pass` | SMTP password or provider app password. |

Create each missing secret in Secret Manager and add a version. For `apexstore-auth-secret`, use a fresh random value (at least 32 random bytes). For the customer signing key, create a persistent RSA private key in PEM format and store the private key as the secret value; preserve line breaks or use literal `\n` sequences. Store the SMTP provider app password, not an account password where the provider supports app passwords. Do not use the API keys or passwords previously pasted into chat: treat those as exposed, revoke or rotate them first, then save their replacements in Secret Manager.

The `apexstore-shop-api-keys` value should follow this structure, replacing the example key with a newly generated random token:

```json
{"REPLACE_WITH_RANDOM_TOKEN":{"name":"assistant","scopes":["catalog:read","orders:read","refunds:read","refunds:create"]}}
```

Do not commit secrets or paste them into this repository. Rotate any credentials that have been exposed in chat before using them in the deployment.

## IAM setup

Before deploying, enable the Cloud Build, Cloud Run, Artifact Registry, Cloud SQL Admin, and Secret Manager APIs for the project. Create the `apexstore-images` Docker repository in Artifact Registry in `asia-south1`.

Create a dedicated runtime service account:

`apexstore-runtime@ai-support-assistant-2026.iam.gserviceaccount.com`

Grant it:

- **Cloud SQL Client** (`roles/cloudsql.client`) on the project.
- **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`) on each of the six ApexStore secrets above.

The Cloud Build trigger identity needs **Artifact Registry Writer** on the repository, **Cloud Run Admin** on the project, and **Service Account User** (`roles/iam.serviceAccountUser`) on the runtime service account so it can deploy with that identity. In Cloud Build → Triggers, check which service account the trigger uses before granting these roles. The frontend Cloud Run service does not need access to database secrets.

If you need the staff refund/order console, after deployment add the staff email addresses to `ADMIN_EMAILS` on the `apexstore-api` Cloud Run service. The email accounts must first register and verify through the storefront. Staff sign in at `/admin`; the login API is `POST /api/admin/login`, and the order console is `/admin/orders`.

## Connect the GitHub repository to Cloud Build

1. In Google Cloud Console, open **Cloud Build → Repositories** and connect the GitHub repository that contains this ApexStore project.
2. Open **Cloud Build → Triggers** and create a trigger for the deployment branch (currently `main`). Set its build configuration file to `cloudbuild.yaml` at the repository root.
3. In the trigger’s **Substitution variables**, set `_RUN_SEED` to `true` for the first build only, while the `apexstore` database is empty. Run the trigger once. The job creates the demo catalog and sample orders in Cloud SQL.
4. After that build succeeds, edit the trigger and set `_RUN_SEED` back to `false`. The seed replaces catalog/review/category rows, so it must not be run automatically on every code push.

Cloud Build then builds and pushes both container images, deploys the API and storefront, and updates `FRONTEND_ORIGIN` to the deployed storefront URL. It prints both Cloud Run URLs in the build log.

## Connect the support assistant

After both services are deployed:

- Set the assistant’s ApexStore API URL to the API service URL with `/api/assistant/v1` appended.
- Set its catalog/API token to the token represented in `apexstore-shop-api-keys`.
- Set the assistant’s refund callback URL and shared refund secret separately if you want refund decisions synchronized back to the store.

The API is public for the storefront and assistant, but its assistant routes require the configured scoped bearer token. Admin endpoints additionally require a verified account email in `ADMIN_EMAILS`, which can be configured on the API Cloud Run service after deployment.

## Notes

- Cloud Run does not store the store database in its container filesystem. PostgreSQL data remains in Cloud SQL.
- The build does not import local SQLite orders, user accounts, or refunds. It seeds demo data only when `_RUN_SEED=true`.
- The frontend proxies API requests through its own `/api` paths. Cloud Build sets `API_PROXY_TARGET` to the current API URL, keeping browser sessions same-origin.
- If a second Cloud SQL instance named `apexstore` was created accidentally, verify it contains no needed data before deleting it. The deployment uses `ai-support-db`; do not delete that instance.
