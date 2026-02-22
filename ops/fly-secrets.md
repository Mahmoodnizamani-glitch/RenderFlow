# Fly.io Secrets Configuration

Both `renderflow-api` and `renderflow-worker` require secrets set via `fly secrets set`.

## API Secrets

```bash
fly secrets set \
  DATABASE_URL="postgres://..." \
  REDIS_URL="redis://..." \
  JWT_SECRET="<min-32-char-random-string>" \
  JWT_REFRESH_SECRET="<min-32-char-random-string>" \
  R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY="<r2-access-key>" \
  R2_SECRET_KEY="<r2-secret-key>" \
  R2_BUCKET="renderflow-videos" \
  CORS_ORIGIN="https://app.renderflow.com" \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  REVENUECAT_WEBHOOK_AUTH_KEY="<key>" \
  SENTRY_DSN="https://<key>@sentry.io/<project>" \
  POSTHOG_API_KEY="phc_..." \
  --app renderflow-api
```

## Worker Secrets

```bash
fly secrets set \
  REDIS_URL="redis://..." \
  R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY="<r2-access-key>" \
  R2_SECRET_KEY="<r2-secret-key>" \
  R2_BUCKET="renderflow-videos" \
  SENTRY_DSN="https://<key>@sentry.io/<project>" \
  --app renderflow-worker
```

## Database (Fly Postgres)

```bash
# Create a Fly Postgres cluster
fly postgres create --name renderflow-db --region iad --vm-size shared-cpu-1x

# Attach to the API app (auto-sets DATABASE_URL)
fly postgres attach renderflow-db --app renderflow-api
```

## Redis (Upstash via Fly)

```bash
# Create Upstash Redis
fly redis create --name renderflow-redis --region iad

# The connection string is shown after creation. Set it on both apps.
```

## Secret Rotation

1. Generate new secret: `openssl rand -base64 48`
2. Set on Fly: `fly secrets set JWT_SECRET="<new>" --app renderflow-api`
3. Fly redeploys automatically with zero downtime
4. Old tokens expire naturally (15m access, 7d refresh)
