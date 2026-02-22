// Monorepo root entry point — redirects to the mobile app's entry.
// Required because Expo CLI resolves the project root to the workspace root
// during native Android builds (export:embed).
import './apps/mobile/index';
