# Datadog Compatibility

Short answer: **you cannot run RenderFlow "on Datadog"**, because Datadog is an observability platform, not an app hosting platform.

You can run RenderFlow on your infrastructure (Fly.io, Kubernetes, VMs, etc.) and monitor it with Datadog.

## Recommended Setup

1. Deploy API and worker normally (for this repo, see `fly.toml` and `fly.worker.toml`).
2. Run a Datadog Agent in the same environment.
3. Send container/process logs from the API and worker to Datadog.
4. (Optional) Enable trace/log correlation with:
   - `DD_SERVICE`
   - `DD_ENV`
   - `DD_VERSION`

These environment variables are documented in `ops/environment-variables.md`.
