# Worker Crash Loop Runbook

## Symptoms
- Alert: `WorkerDown`
- Fly.io shows worker restarting repeatedly
- Render jobs failing immediately

## Diagnosis

```bash
# Check worker status
fly status --app renderflow-worker

# Check recent logs (look for crash patterns)
fly logs --app renderflow-worker --no-tail | head -200

# Check machine events
fly machines list --app renderflow-worker
```

### Common Crash Causes

| Symptom in Logs | Cause | Fix |
|-----------------|-------|-----|
| `ENOMEM` / OOM killed | Memory exhaustion | Increase VM memory or reduce concurrency |
| `SIGKILL` after 30min | Job timeout not working | Check `JOB_TIMEOUT_MS` |
| `Chromium failed to launch` | Binary missing/corrupted | Rebuild Docker image |
| `ECONNREFUSED` to Redis | Redis unreachable | Check Redis status + secrets |
| `R2 access denied` | Credential issue | Rotate R2 keys |

## Remediation

### 1. Check recent changes

```bash
# List recent releases
fly releases --app renderflow-worker

# Rollback to previous release
fly deploy --image <previous-image> --app renderflow-worker
```

### 2. OOM fixes

```bash
# Increase memory
fly scale memory 8192 --app renderflow-worker

# Or reduce concurrency
fly secrets set WORKER_CONCURRENCY=1 --app renderflow-worker
```

### 3. Redis connectivity

```bash
# Check Redis status
fly redis status renderflow-redis

# Verify secret is correct
fly secrets list --app renderflow-worker | grep REDIS
```

### 4. Full rebuild

```bash
# Force clean rebuild
fly deploy --config fly.worker.toml --remote-only --no-cache
```

## Prevention
- Set memory alerts at 80% threshold
- Use `dumb-init` for proper signal handling (already configured)
- Set `JOB_TIMEOUT_MS` to prevent infinite jobs
- Monitor `process_resident_memory_bytes` in Grafana
