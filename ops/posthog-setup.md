# PostHog Setup Guide

## API (Server-Side)

The API integrates PostHog via `apps/api/src/config/posthog.ts`. It uses dynamic imports, so the SDK is optional.

### Install the SDK

```bash
cd apps/api
npm install posthog-node
```

### Configure

Set `POSTHOG_API_KEY` environment variable. The API automatically initialises PostHog at boot.

### Tracked Events

Use the predefined helpers in `posthog.ts`:

| Helper | Event Name | When |
|--------|------------|------|
| `trackRenderSubmitted()` | `render_submitted` | Render job created |
| `trackRenderCompleted()` | `render_completed` | Render job finished |
| `trackRenderFailed()` | `render_failed` | Render job errored |
| `trackCreditPurchase()` | `credit_purchased` | Credits bought |
| `trackSubscriptionStarted()` | `subscription_started` | Sub activated |

Or use `trackEvent(userId, eventName, properties)` for custom events.

## Mobile (React Native)

### Install

```bash
cd apps/mobile
npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
```

### Configure Provider

In `app/_layout.tsx`:

```typescript
import { PostHogProvider } from 'posthog-react-native';

export default function RootLayout() {
  return (
    <PostHogProvider
      apiKey="YOUR_POSTHOG_API_KEY"
      options={{
        host: 'https://us.i.posthog.com',
        enableSessionReplay: true,
      }}
    >
      {/* ... app content */}
    </PostHogProvider>
  );
}
```

### Track Events

```typescript
import { usePostHog } from 'posthog-react-native';

function MyComponent() {
  const posthog = usePostHog();

  const handlePress = () => {
    posthog.capture('button_pressed', { screen: 'editor' });
  };
}
```

### Event Taxonomy

| Event | Properties | When |
|-------|------------|------|
| `user_registered` | `method` | Account created |
| `user_logged_in` | `method` | Login |
| `project_created` | `projectId` | New project |
| `project_edited` | `projectId`, `field` | Code/settings changed |
| `preview_loaded` | `projectId`, `durationMs` | Preview rendered |
| `preview_error` | `projectId`, `error` | Preview failed |
| `render_submitted` | `projectId`, `format` | Render queued |
| `render_completed` | `renderJobId`, `durationMs` | Render finished |
| `credit_purchased` | `amount`, `credits` | Credits bought |
| `subscription_started` | `tier` | Sub activated |
| `feature_used` | `feature` | Feature flag feature used |

### Feature Flags

```typescript
const posthog = usePostHog();
const showBatchRender = posthog.getFeatureFlag('batch-render');
```
