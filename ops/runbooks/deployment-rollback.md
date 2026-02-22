# Deployment Rollback Runbook

## When to use
- Smoke tests fail after production deploy
- Critical error rate spike after deploy
- User-reported regression after deploy

## API Rollback

### 1. List recent releases

```bash
fly releases --app renderflow-api
```

Output shows version numbers and image references.

### 2. Rollback to previous version

```bash
# Deploy using the previous image
fly deploy --image registry.fly.io/renderflow-api:deployment-<VERSION> --app renderflow-api
```

Or use the Fly dashboard: Apps → renderflow-api → Releases → Rollback.

### 3. Verify rollback

```bash
# Check health
curl https://renderflow-api.fly.dev/api/v1/health

# Check readiness
curl https://renderflow-api.fly.dev/api/v1/ready

# Check logs
fly logs --app renderflow-api --no-tail | head -50
```

## Worker Rollback

```bash
fly releases --app renderflow-worker
fly deploy --image registry.fly.io/renderflow-worker:deployment-<VERSION> --app renderflow-worker
```

## Database Migration Rollback

> [!CAUTION]
> Database rollbacks are destructive. Only proceed if you understand the migration being reversed.

Drizzle ORM does not auto-generate down migrations. If a migration needs reversal:

1. Write a manual SQL rollback script
2. Test on staging first

```bash
# Connect to production DB
fly postgres connect --app renderflow-db

# Run reversal (example)
ALTER TABLE projects DROP COLUMN IF EXISTS new_column;
```

3. Deploy the code rollback (previous API version) after DB rollback

## Mobile Rollback

### OTA Update (fast)
```bash
cd apps/mobile
eas update --branch production --message "Rollback to v1.x.x"
```

### Full Build Rollback
1. Go to Google Play Console / App Store Connect
2. Halt the current release
3. Re-promote the previous version

## Staging Rollback

```bash
fly deploy --image registry.fly.io/renderflow-api:deployment-<VERSION> --app renderflow-api-staging
```

## Post-Rollback
1. Investigate the root cause
2. Write a fix with tests
3. Deploy fix through the normal pipeline (staging → smoke → production)
4. File post-mortem if user-facing impact > 5 minutes
