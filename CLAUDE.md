\# Project: RenderFlow Mobile (Android)



\## Stack

\- Kotlin 1.9+ / Jetpack Compose

\- Room (Database)

\- WorkManager (Background Sync)

\- Hilt (Dependency Injection)



\## Conventions

\- Use MVI/MVVM architecture for Compose state management.

\- All UI state must flow downstream from Room (Single Source of Truth).

\- Use Coroutines and Flows for all asynchronous operations.



\## Commands

\- Test: `./gradlew testDebugUnitTest`

\- Lint: `./gradlew lintDebug`

\- Build: `./gradlew assembleDebug`



\## Rules

\- Output complete code. No placeholders or stubs.

\- Run tests and compile after every architectural change.

\- Never use XML layouts; use Compose exclusively.

