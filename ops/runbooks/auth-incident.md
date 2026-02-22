# Auth Incident Runbook

## When to use
- Suspected JWT secret compromise
- Mass unauthorized access detected
- Token leak in logs or third-party service

## Immediate Actions

### 1. Rotate JWT secrets

```bash
# Generate new secrets
NEW_JWT=$(openssl rand -base64 48)
NEW_REFRESH=$(openssl rand -base64 48)

# Set on Fly.io (triggers automatic redeploy)
fly secrets set \
  JWT_SECRET="$NEW_JWT" \
  JWT_REFRESH_SECRET="$NEW_REFRESH" \
  --app renderflow-api
```

**Impact**: All existing access tokens (15m TTL) and refresh tokens (7d TTL) become invalid. All users will need to re-authenticate.

### 2. Revoke all refresh tokens

```bash
# Connect to DB and clear refresh tokens table
fly postgres connect --app renderflow-db -c "
TRUNCATE TABLE refresh_tokens;
"
```

### 3. Force-logout specific user

```bash
fly postgres connect --app renderflow-db -c "
DELETE FROM refresh_tokens WHERE \"userId\" = '<USER_UUID>';
"
```

### 4. Check audit logs

```bash
fly postgres connect --app renderflow-db -c "
SELECT timestamp, action, ip, \"userAgent\"
FROM audit_logs
WHERE \"userId\" = '<SUSPECT_USER_UUID>'
ORDER BY timestamp DESC
LIMIT 50;
"

# Check for unusual login patterns
fly postgres connect --app renderflow-db -c "
SELECT ip, count(*), min(timestamp), max(timestamp)
FROM audit_logs
WHERE action = 'login'
AND timestamp > now() - interval '24 hours'
GROUP BY ip
ORDER BY count DESC
LIMIT 20;
"
```

## Communication
1. Assess scope of breach
2. Notify affected users if PII was accessed
3. File incident report

## Post-Incident
- Review API logs for the affected time window
- Check Sentry for unusual error patterns
- Update JWT_SECRET rotation schedule
- Consider reducing JWT_ACCESS_EXPIRES_IN temporarily
