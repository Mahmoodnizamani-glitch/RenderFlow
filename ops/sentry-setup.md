# Sentry Setup Guide

## API (Server-Side)

The API integrates Sentry via `apps/api/src/config/sentry.ts`. It uses dynamic imports, so the SDK is optional.

### Install the SDK

```bash
cd apps/api
npm install @sentry/node
```

### Configure

Set the `SENTRY_DSN` environment variable (via `.env` locally, `fly secrets set` in production).

No code changes needed — the API automatically:
- Initialises Sentry at boot (`index.ts`)
- Captures unhandled errors (500s) in the global error handler (`app.ts`)
- Flushes events on shutdown

### Source Maps

Add to CI deploy workflow:

```yaml
- name: Upload source maps
  run: npx @sentry/cli sourcemaps upload --release "api@$VERSION" apps/api/dist
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: renderflow-api
```

## Mobile (React Native)

### Install

```bash
cd apps/mobile
npx expo install @sentry/react-native
```

### Configure

Add to `app.json` plugins:

```json
{
  "plugins": [
    "@sentry/react-native/expo",
    {
      "organization": "your-org",
      "project": "renderflow-mobile"
    }
  ]
}
```

### Initialise in App

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  tracesSampleRate: 0.1,
  environment: __DEV__ ? 'development' : 'production',
});
```

### Error Boundary

Wrap your root layout in `app/_layout.tsx`:

```typescript
export default Sentry.wrap(RootLayout);
```
