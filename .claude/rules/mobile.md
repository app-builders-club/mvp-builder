---
paths:
  - "**/*.swift"
  - "**/*.kt"
  - "**/*.java"
  - "**/*.dart"
  - "**/*.xcodeproj/**"
  - "**/*.pbxproj"
  - "**/build.gradle*"
  - "**/AndroidManifest.xml"
  - "**/Podfile"
  - "**/Package.swift"
  - "**/pubspec.yaml"
---

# Mobile Standards

Cross-platform rules for native mobile development. Platform-specific APIs (iOS: `ios.md`, Android: forthcoming `android.md`) take precedence for platform-specific concerns.

## Storage Taxonomy

### Storage Categories

| Category | Purpose | Backup | Survives Uninstall | OS Can Purge |
|----------|---------|--------|--------------------|--------------|
| Documents | User-generated irreplaceable data | Yes | No | No |
| Cache | Regeneratable data (API responses, thumbnails) | No | No | Yes |
| Temp | Short-lived intermediate files | No | No | Yes (anytime) |
| Media / Scoped | User photos, videos, downloads | Depends | Configurable | No |
| Secure (Keychain/Keystore) | Credentials, encryption keys | No (by default) | No | No |

### Selection Rules
- User-generated data that cannot be re-downloaded → Documents
- Server-fetched data, derived artifacts, thumbnails → Cache
- Files in active processing only → Temp
- User-authored photos/videos/exports → Media/Scoped with appropriate permissions
- Auth tokens, encryption keys, PII → Secure Storage only

### Non-negotiables
- Never store sensitive data in Cache or Temp
- Never rely on Cache persistence — code must handle cache eviction gracefully
- Never use external/shared storage for app-private data
- Always declare storage intent at write time — don't rely on global defaults

## Secure Storage

### Hierarchy (most to least secure)
1. Hardware-backed secure enclave (StrongBox on Android, Secure Enclave on iOS) — encryption keys only
2. Platform secure store (Keychain on iOS, Keystore + EncryptedSharedPreferences on Android) — tokens, credentials
3. Encrypted database with key from Keystore/Keychain — sensitive structured data
4. Regular storage + field-level encryption — never for secrets alone, only as defense-in-depth

### Non-negotiables
- Never store auth tokens, API keys, or credentials in plain UserDefaults / SharedPreferences
- Never store secrets in app bundle, `Info.plist`, `AndroidManifest.xml`, or source code
- Never log token values, even masked — log presence only (`token: present`)
- Encryption keys live in Keystore/Keychain, never in app memory beyond immediate use
- Biometric-gated decryption for highly sensitive data (payment credentials, health records)

## Network Awareness

### Connection State
- Detect connection type before initiating large transfers (Wi-Fi vs cellular vs no network)
- Respect OS-level data saver mode (Android Data Saver, iOS Low Data Mode)
- Never initiate background data sync on cellular without explicit user opt-in
- Listen for connectivity changes — don't poll network state

### Request Limits
- Cap concurrent network requests (default 4–6 active) — adjust based on device state
- Reduce concurrency on cellular, low battery, or weak signal
- Batch small requests where possible — HTTP request overhead is significant on cellular
- Apply exponential backoff with jitter for retries — never fixed-interval retry loops
- Never retry indefinitely — cap retries (typically 3–5) and surface failure to user

### Request Prioritization
Classify every network request by priority:
- **User-critical** — current screen data, user-initiated actions. No deferral.
- **UI-enhancing** — thumbnails, previews. Deferrable by seconds.
- **Background** — analytics, prefetching, opportunistic sync. Deferrable to Wi-Fi / charging.

Dispatch higher priority requests first. Pause lower priority on network pressure.

### Bandwidth Respect
- Use modern image formats (WebP, AVIF, HEIC) where supported
- Request appropriate resolution — never download 4K when rendering at 320px
- Support server-side thumbnail variants — don't downscale client-side after full download
- Enable HTTP/2 or HTTP/3 where backend supports it

## Background Execution

### Principles
- Treat background time as scarce and revocable — OS can terminate at any moment
- Every background task must be resumable — design for interruption
- Persist progress before suspension — assume app will be killed
- Use platform job scheduling APIs (WorkManager, BackgroundTasks) — never raw threads or timers
- Declare minimum constraints (network type, battery, storage) — let OS optimize execution
- Never block app termination waiting for background work

### Non-negotiables
- Never perform heavy CPU work on the main thread
- Never hold wake locks beyond the minimum required duration
- Never schedule periodic background work more frequent than needed (typical floor: 15 min)
- Respect OS battery optimization / Doze / App Standby — work with it, not around it

## Media Handling

### Upload Strategy
- Files ≤5 MB — single-request upload
- Files >5 MB — chunked / resumable upload with server-side chunk assembly
- Files >50 MB — always chunked, require Wi-Fi by default (user can override)
- Generate client-side content hash — enable server-side deduplication and integrity verification
- Client provides upload ID (UUID) — server maps chunks to upload session

### Resumable Upload Requirements
- Upload session survives app restart — persist session state locally
- Each chunk is independently retryable — no coupling between chunks
- Server acknowledges each chunk before client discards local reference
- Finalize step performs integrity check before committing the assembled file

### Image Caching (L1/L2 model)
- **L1 (memory)** — decoded bitmaps ready for display. Sized proportional to available RAM (typical heuristic: 15–25%)
- **L2 (disk)** — encoded bytes. Typical budget: 200–500 MB with LRU eviction
- Cache key includes target dimensions and format — never cache original at display size
- Downsample at decode time — never decode full resolution for thumbnail display
- Decode on background thread — never on main thread
- Cancel pending loads when target view is recycled or detached

### Non-negotiables
- Never upload or download large media without progress indication
- Never cache encoded responses when decoded form will be reused — wastes CPU on re-decode
- Never keep decoded bitmaps beyond display need — decoded memory dominates mobile RAM

## Permissions

### Request Strategy
- Request at point of use, never at app launch
- Provide pre-prompt rationale for non-obvious permissions
- Request minimum necessary scope — coarse location before fine, photo picker before gallery access
- Handle denial gracefully — provide alternative flow or clear explanation of lost functionality
- Never re-prompt after denial without clear user action indicating reconsideration
- Detect auto-reset permissions (unused app hibernation) — re-request on next relevant use

### Delegation Over Permission
Prefer OS-provided pickers that require no permission:
- Photo Picker (iOS 14+, Android Photo Picker) over full gallery access
- Document Picker over storage access
- Share Sheet / Activity over contact access
- System camera intent over direct camera permission

### Non-negotiables
- Never request permissions the app doesn't immediately use
- Never access protected resources on app launch or before user action
- Never treat permission grant as permanent — check status on each access

## App Integrity & Attestation

### When Required
- Backends handling payments, sensitive user data, or proprietary business logic must verify requests originate from a genuine, untampered app binary
- Client-side anti-tamper is insufficient alone — server must validate attestation tokens

### Implementation Principles
- Use platform attestation APIs (Play Integrity API on Android, App Attest on iOS) — not third-party SDKs as sole mechanism
- Attestation tokens are short-lived — refresh per session or per sensitive operation
- Never ship API keys or secrets in the app binary expecting them to remain secret — treat them as public
- Use attestation for rate limiting and abuse detection, not primary authentication

## Privacy

### Data Minimization
- Collect only data directly required for current feature functionality
- Prefer on-device processing over sending raw data to backend (ML inference, analytics aggregation)
- Anonymize or aggregate before transmission where feature allows
- Use resettable pseudo-IDs, not persistent device identifiers

### Sensitive Surfaces
- Mark screens displaying sensitive content to prevent OS app-switcher screenshots
- Hide sensitive fields when app backgrounds
- Never log PII, credentials, tokens, payment details, or health data
- Redact sensitive fields before sending to crash reporters / analytics SDKs

### Retention
- Delete cached data when corresponding server data is deleted
- Provide user-accessible data clearing — app settings must expose "clear cache" and "clear data"
- Honor account deletion — remove all local data on sign-out for sensitive apps

### Third-Party SDKs
- Treat every third-party SDK as a potential data exfiltration path
- Gate each SDK behind a feature flag — must be remotely disableable without app release
- Audit SDK network behavior — not just documented behavior, actual traffic
- Avoid SDKs that cannot be disabled per-user for GDPR/CCPA opt-out

## Resilience & Offline Behavior

### Offline-First Principle
- UI reads from local database as single source of truth — never directly from network
- Writes update local state immediately (optimistic UI), queue for background sync
- Sync engine reconciles with server — decoupled from UI
- Every sync failure has a retry plan — transient errors retry, permanent errors surface to user

### Queue Persistence
- Pending mutations survive app termination — persist queue in database, not memory
- Each queued mutation carries a client-generated idempotency key
- On successful server response, remove from queue — never assume success without ack
- On permanent failure (400-level), revert optimistic UI state and notify user

### State Restoration
- UI state survives process death — save navigation stack, scroll positions, form inputs
- Restore to exact prior state on relaunch — never dump user to home screen
- Never rely on in-memory singletons for user-visible state

## Device & Release Safety

### Device Diversity
- Test on minimum supported OS version — not just latest
- Test on low-memory device class — not just flagship
- Never assume 5G / Wi-Fi network conditions — test throttled network profiles
- Support minimum 2 major OS versions back — typical industry practice

### Release Non-negotiables
- Never ship without crash reporting + symbolication configured
- Never ship new SDK integrations without staged rollout (typical: 1% → 10% → 50% → 100%)
- Every user-facing feature gated behind a remote flag — instant disable capability
- Never remove flag until feature has been at 100% for at least one release cycle
- Assume releases are final — rollback is slow (app store review) and partial (user update behavior)

## Non-negotiable Rules

### Main Thread
- No blocking I/O on main thread — no disk reads, no network, no heavy computation
- No synchronous decoding of images, audio, video on main thread
- No main-thread CoreData / Realm / Room queries beyond trivial reads

### Memory
- Never hold references to Views / ViewControllers / Activities / Fragments beyond their lifecycle
- Release heavy resources on low-memory warnings
- Decoded bitmap memory dominates — size to display, not to source

### Sensitive Output
- Never log auth tokens, API keys, passwords, PII, payment data, health data
- Never include secrets in crash reports or analytics payloads
- Never display sensitive data in exception messages shown to user

### Error Handling
- Every network call has explicit timeout — never rely on OS default (too long)
- Every async operation has cancellation path — tied to UI lifecycle
- Never swallow errors silently — log, surface, or explicitly document why ignored