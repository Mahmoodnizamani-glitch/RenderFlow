# Environment Variables Reference

For Datadog compatibility notes, see `ops/datadog-setup.md`.

## API (`@renderflow/api`)

| Variable                      | Required | Default             | Description                                                            |
| ----------------------------- | -------- | ------------------- | ---------------------------------------------------------------------- |
| `PORT`                        | No       | `3001`              | HTTP server port                                                       |
| `HOST`                        | No       | `0.0.0.0`           | HTTP server bind address                                               |
| `NODE_ENV`                    | No       | `development`       | `development`, `test`, or `production`                                 |
| `LOG_LEVEL`                   | No       | `info`              | Pino log level: `fatal`/`error`/`warn`/`info`/`debug`/`trace`/`silent` |
| `DATABASE_URL`                | **Yes**  | —                   | PostgreSQL connection string                                           |
| `REDIS_URL`                   | No       | —                   | Redis connection string (enables Redis rate limiting + BullMQ)         |
| `JWT_SECRET`                  | **Yes**  | —                   | JWT signing secret (min 16 chars)                                      |
| `JWT_REFRESH_SECRET`          | **Yes**  | —                   | Refresh token signing secret (min 16 chars)                            |
| `JWT_ACCESS_EXPIRES_IN`       | No       | `15m`               | Access token TTL                                                       |
| `JWT_REFRESH_EXPIRES_IN`      | No       | `7d`                | Refresh token TTL                                                      |
| `R2_ENDPOINT`                 | No       | —                   | Cloudflare R2 S3-compatible endpoint                                   |
| `R2_ACCESS_KEY`               | No       | —                   | R2 access key                                                          |
| `R2_SECRET_KEY`               | No       | —                   | R2 secret key                                                          |
| `R2_BUCKET`                   | No       | `renderflow-videos` | R2 bucket name                                                         |
| `CORS_ORIGIN`                 | No       | `*`                 | Allowed CORS origins (comma-separated)                                 |
| `RATE_LIMIT_MAX`              | No       | `100`               | Global rate limit (requests per window)                                |
| `RATE_LIMIT_WINDOW_MS`        | No       | `60000`             | Rate limit window (ms)                                                 |
| `STRIPE_WEBHOOK_SECRET`       | No       | —                   | Stripe webhook signing secret                                          |
| `REVENUECAT_WEBHOOK_AUTH_KEY` | No       | —                   | RevenueCat webhook auth key                                            |
| `SENTRY_DSN`                  | No       | —                   | Sentry DSN for error tracking                                          |
| `SENTRY_ENVIRONMENT`          | No       | `NODE_ENV`          | Sentry environment label                                               |
| `POSTHOG_API_KEY`             | No       | —                   | PostHog API key for analytics                                          |
| `DD_SERVICE`                  | No       | `renderflow-api`    | Datadog service name (when Datadog tracing/log correlation is enabled) |
| `DD_ENV`                      | No       | `NODE_ENV`          | Datadog environment tag                                                |
| `DD_VERSION`                  | No       | —                   | Datadog version tag (for release correlation)                          |

## Render Worker (`@renderflow/render-worker`)

| Variable             | Required | Default             | Description                                                            |
| -------------------- | -------- | ------------------- | ---------------------------------------------------------------------- |
| `REDIS_URL`          | **Yes**  | —                   | Redis connection (BullMQ queue)                                        |
| `R2_ENDPOINT`        | **Yes**  | —                   | R2 endpoint for video upload                                           |
| `R2_ACCESS_KEY`      | **Yes**  | —                   | R2 access key                                                          |
| `R2_SECRET_KEY`      | **Yes**  | —                   | R2 secret key                                                          |
| `R2_BUCKET`          | No       | `renderflow-videos` | R2 bucket name                                                         |
| `HEALTH_PORT`        | No       | `3001`              | Worker health check port                                               |
| `WORKER_CONCURRENCY` | No       | `1`                 | Concurrent render jobs per worker                                      |
| `JOB_TIMEOUT_MS`     | No       | `1800000`           | Max job runtime (30 min default)                                       |
| `LOG_LEVEL`          | No       | `info`              | Log level                                                              |
| `SENTRY_DSN`         | No       | —                   | Sentry DSN                                                             |
| `DD_SERVICE`         | No       | `renderflow-worker` | Datadog service name (when Datadog tracing/log correlation is enabled) |
| `DD_ENV`             | No       | `NODE_ENV`          | Datadog environment tag                                                |
| `DD_VERSION`         | No       | —                   | Datadog version tag                                                    |

## Where to Set

| Environment    | Method                                       |
| -------------- | -------------------------------------------- |
| Local dev      | `.env` file in `apps/api/`                   |
| Docker Compose | `environment:` block in `docker-compose.yml` |
| Fly.io         | `fly secrets set KEY=VALUE --app <app-name>` |
| GitHub Actions | Repository settings → Secrets and variables  |
| EAS Build      | `eas.json` `env` block per profile           |
