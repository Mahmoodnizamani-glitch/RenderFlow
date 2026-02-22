# Queue Saturation Runbook

## Symptoms
- Alert: `RenderQueueSaturation` (queue depth > 50)
- Users report long wait times for renders
- Grafana: rising `bullmq_queue_waiting` metric

## Diagnosis

```bash
# Check current queue depth
fly ssh console --app renderflow-api -C "node -e \"
const Redis = require('ioredis');
const r = new Redis(process.env.REDIS_URL);
r.llen('bull:render:wait').then(n => { console.log('Waiting:', n); r.quit(); });
\""

# Check active workers
fly status --app renderflow-worker

# Check worker logs for errors
fly logs --app renderflow-worker --no-tail | head -100
```

## Remediation

### 1. Scale workers (immediate)

```bash
# Scale to more machines
fly scale count 5 --app renderflow-worker

# Or auto-scale
fly autoscale set min=2 max=10 --app renderflow-worker
```

### 2. Check for stuck jobs

```bash
# SSH into API and check for stale active jobs
fly ssh console --app renderflow-api -C "node -e \"
const Redis = require('ioredis');
const r = new Redis(process.env.REDIS_URL);
r.llen('bull:render:active').then(n => { console.log('Active:', n); r.quit(); });
\""
```

### 3. Increase worker concurrency

Update `fly.worker.toml`:
```toml
[env]
  WORKER_CONCURRENCY = '3'
```

```bash
fly deploy --config fly.worker.toml
```

### 4. Drain queue (nuclear option)

Only if jobs are corrupted or stuck:

```bash
fly ssh console --app renderflow-api -C "node -e \"
const { Queue } = require('bullmq');
const q = new Queue('render', { connection: { host: '...' } });
q.drain().then(() => console.log('Queue drained'));
\""
```

## Prevention
- Set up auto-scaling based on queue depth
- Monitor `render_job_duration_seconds` for increasing processing times
- Review render job complexity limits
