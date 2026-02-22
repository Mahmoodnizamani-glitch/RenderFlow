# Database Connection Issues Runbook

## Symptoms
- Alert: `DatabaseConnectionFailure`
- API readiness probe (`/api/v1/ready`) returns 503 with `db: "disconnected"`
- Application logs: `Database not initialised` or connection timeout errors

## Diagnosis

```bash
# Check API logs
fly logs --app renderflow-api --no-tail | grep -i "database\|pg\|postgres"

# Check Fly Postgres status
fly postgres connect --app renderflow-db

# Check connection count
fly postgres connect --app renderflow-db -c "SELECT count(*) FROM pg_stat_activity;"

# Check max connections
fly postgres connect --app renderflow-db -c "SHOW max_connections;"
```

## Remediation

### 1. Connection pool exhaustion

```bash
# Check active connections by application
fly postgres connect --app renderflow-db -c "
SELECT application_name, state, count(*)
FROM pg_stat_activity
GROUP BY application_name, state
ORDER BY count DESC;
"

# Kill idle connections if needed
fly postgres connect --app renderflow-db -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '10 minutes';
"
```

### 2. Fly.io proxy timeout

Fly Postgres uses an internal proxy. If connections hang:

```bash
# Restart the API to reset connection pool
fly machines restart --app renderflow-api

# If DB itself is unresponsive, restart it
fly machines restart --app renderflow-db
```

### 3. Storage full

```bash
# Check disk usage
fly postgres connect --app renderflow-db -c "
SELECT pg_size_pretty(pg_database_size('renderflow'));
"

# Extend volume if needed
fly volumes extend <vol-id> -s 20 --app renderflow-db
```

### 4. DNS resolution (Fly internal)

```bash
# Verify internal DNS resolves
fly ssh console --app renderflow-api -C "getent hosts renderflow-db.internal"
```

## Prevention
- API uses `max: 10` connection pool (see `connection.ts`)
- Set `idle_timeout: 20` and `connect_timeout: 10` in postgres.js config
- Monitor `pg_pool_*` metrics in Grafana
- Set up Fly Postgres alerts for disk usage
