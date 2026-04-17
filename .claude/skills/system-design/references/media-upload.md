# Media Upload Architecture

Reference for designing upload systems for photos, videos, and large files. Loaded when triage identifies Media-heavy features — camera uploads, document management, voice messages, file sharing, video platforms.

Grounded in Dropbox's published camera upload architecture (scanner/uploader worker split, 4MB block uploads with separate commit, state machine tracking, explicit Android background constraint handling). The Dropbox rewrite took two engineers two full years for Android alone — an honest signal of the complexity involved.

---

## Why Media Upload Is Hard

Structured data APIs fit neatly into request/response patterns — 1KB JSON, instant. Media uploads break every assumption:

- **Large payloads.** 4MB photos, 50MB HEIC bursts, 500MB+ 4K videos. Single HTTP request at this size is fragile.
- **Long duration.** Upload takes minutes over cellular, sometimes hours. Many chances for network to drop.
- **OS background constraints.** Mobile OS throttles, suspends, or kills apps aggressively to protect battery. "Upload in the background" isn't a guarantee — it's a negotiation with the OS.
- **User expectations.** Users photograph moments, close the app, expect the photo to be backed up. They don't wait for an upload progress bar.
- **Deduplication and idempotency.** Retries can't create duplicate uploads. Device-side triggers (OS photo change notifications) may fire multiple times for the same photo.
- **File mutability.** User may delete or edit a photo mid-upload. Source file may vanish.
- **Content transcoding.** HEIC vs JPG, H.264 vs H.265, different codecs per platform. May need server-side or client-side conversion.

Uploads that "just work" silently require an order of magnitude more engineering than single-shot APIs.

---

## Resumable Upload Pattern

The canonical pattern for any file >1MB. Do not design around single-shot upload.

### Block-Based Upload

Break the file into fixed-size blocks. Upload each block separately. Commit atomically at the end.

**Dropbox's approach:**

1. **Break file into 4MB blocks.**
2. **Compute a hash per block** (SHA-256 or equivalent).
3. **Upload each block to server** — server stores blocks keyed by hash.
4. **Final commit request** contains ordered list of block hashes. Server assembles file from blocks.

```
Client:
  ├── Split file into N blocks of 4MB
  ├── POST /upload/block { hash: abc123, data: [4MB] }
  ├── POST /upload/block { hash: def456, data: [4MB] }
  ├── ...
  └── POST /upload/commit { blocks: [abc123, def456, ...] }

Server:
  ├── Store each block by hash (content-addressable)
  ├── On commit: validate all hashes present, assemble file, persist metadata
  └── Return file ID
```

### Why Block-Based

- **Resumable.** If upload fails at block 47 of 100, retry from 47 — not from 0.
- **Deduplication.** If another user (or same user) uploads identical block, server already has it. Skip re-upload.
- **Parallel uploads.** Multiple blocks can upload concurrently (bounded — 3-5 parallel is typical).
- **Bounded failure recovery.** Network drop affects the current block, not the entire file.

### Block Size Selection

- **Too small** (e.g., 64KB): overhead per block dominates (HTTP headers, hash computation, round trips). Upload becomes slower for the same file.
- **Too large** (e.g., 64MB): retry cost is high; one failed block means re-uploading significant bytes.
- **4MB is a well-justified sweet spot** (Dropbox's choice). Fits in most network MTU / buffer sizes, balances parallelism with overhead.

For video and larger files, 8MB or 16MB blocks may be better — block count grows linearly with file size.

### Server-Side Storage

Content-addressable storage (keyed by block hash) is a natural fit:

- Identical blocks uploaded by different users share storage
- Hash validation prevents tampered/corrupt blocks from assembling
- Blocks can be cached, replicated, and served independently

This is also how Git, IPFS, and most backup systems work internally.

### Alternative: HTTP Range Uploads

Some platforms use `Content-Range` headers to resume uploads:

- Upload fails at byte 5,242,880
- Client sends `Content-Range: bytes 5242880-.../total_size` to resume

Works for simpler cases but lacks:
- Parallel block upload
- Deduplication
- Content-addressable caching

Use block-based for any serious upload system. Range uploads are a fallback for simpler use cases (uploading a single file to S3 with resumption).

### Tus Protocol

The `tus.io` protocol standardizes resumable uploads. If building from scratch, consider following it — interoperable, battle-tested.

---

## Upload Queue Architecture

Dropbox's camera uploads use **two separate background workers**:

### Scanner

Responsibilities:
- Monitor OS photo change notifications
- Identify photos/videos not yet uploaded
- Queue them for upload
- Maintain metadata about which files have been processed

### Uploader

Responsibilities:
- Read queued items
- Execute the block-based upload for each
- Handle retries, failures, and state transitions
- Update completion status

### Why Two Workers

**Separation of concerns:**
- Scanner runs cheaply and frequently — just checks for changes
- Uploader runs expensively and less frequently — actually does network work
- Scanner doesn't block on slow uploads
- Uploader doesn't waste cycles scanning when nothing's new

**Different constraints:**
- Scanner needs to be responsive to OS notifications
- Uploader needs to respect background network limits, battery state

**Crash recovery:**
- Scanner may find photo, queue it, then app crashes
- On restart, uploader picks up queued items from persistent storage
- Scanner re-scanning is idempotent — already-processed photos aren't re-queued

### Persistence

Queue must persist across app termination:
- Use local database (SQLite, Core Data, Room)
- Each queued item has a stable ID (server-generated UUID for new items, OS asset ID for existing)
- Never rely on in-memory queues for uploads — app kills are routine on mobile

---

## Background Upload Constraints

Mobile OS aggressively restricts background execution. Ignoring this means "camera uploads" that don't work when the app isn't foregrounded.

### Android

From Dropbox's documentation: **App Standby limits background network access** if the app hasn't been recently foregrounded. The app may only get network access for a **10-minute interval every 24 hours** under the strictest bucket.

Techniques:
- **WorkManager** (Android Jetpack) — schedules deferred work that respects Doze, App Standby, network conditions, battery state
- **ForegroundService with notification** — for actively uploading, show persistent notification, gets more execution time
- **JobScheduler** for legacy support
- **Expedited jobs** (Android 12+) for high-priority work

What not to do:
- Don't assume `Service` runs indefinitely — it doesn't
- Don't poll from background threads — kills battery and gets killed by OS
- Don't hold wake locks indefinitely — explicit OS penalty

Dropbox's published lesson: the cross-platform C++ library wasn't equipped for Android-specific background constraints, "was often doomed to fail." Kotlin-native implementation tailored around these constraints.

### iOS

Different but analogous constraints:

- **Background URLSession** — OS manages the upload, survives app termination, resumes after reboot
- **BGProcessingTask** / **BGAppRefreshTask** — scheduled background work (see `ios.md` for detail)
- **Silent push notifications** can wake app briefly for background work — limited in frequency

Background URLSession is particularly powerful — uploads continue even when user force-quits the app. But payload size, task count, and identifier scope all have limits.

### Common Pattern: Opportunistic Execution

- Queue uploads at any time (photo taken, user action)
- Actual execution: when OS allows, when network is available, when battery permits
- User shouldn't experience "uploads start after you reopen the app"
- Users shouldn't notice when uploads happen — just that their photos end up backed up

---

## State Machine for Upload Tracking

Each item in the upload queue has a state. Valid transitions are enforced explicitly.

### Typical States

- **PENDING** — queued, not yet attempted
- **UPLOADING** — currently transferring blocks
- **UPLOADED** — all blocks transferred, awaiting commit
- **COMMITTED** — server confirmed successful receipt
- **FAILED** — permanent failure, not retrying
- **CANCELLED** — user or system cancelled

### Why Enforce Transitions

Dropbox's engineering post documents a specific bug caught by transition validation:

> "We started to see a high volume of exceptions in our logs that were caused when camera uploads tried to transition photos from DONE to DONE. This made us realise we were uploading some photos multiple times!"

Without the check, the system silently re-uploaded completed items. With the check, the first duplicate transition surfaced the deduplication bug in testing.

### Implementation

- Each state has a list of allowed next states
- Transition function validates: `canTransition(current, next) -> bool`
- Throw / log / fail explicitly on invalid transition
- Log all transitions with timestamps for debugging upload lifecycle

Applies to any stateful pipeline, not just uploads. But uploads benefit especially because:
- Multiple concurrent workers may race
- Crash recovery must resume correctly
- Bugs manifest as silent data corruption (extra or missing uploads)

---

## Deduplication

Media uploads must deduplicate at multiple layers.

### Client-Side Deduplication

Before enqueueing:
- Has this photo asset ID been uploaded before? (check local database)
- Is it currently in the queue? (check in-flight state)

OS photo change notifications fire on any modification — edits, moves, metadata changes. Without deduplication, a photo gets re-queued every time it's edited.

### Server-Side Deduplication

At block level:
- Same block (same hash) from different clients → store once, reference from multiple files
- Saves storage at scale dramatically

At file level:
- Same user uploading same file → return existing file ID, skip re-upload
- Identity determined by content hash, not filename

### Idempotency Keys

For the commit request specifically:
- Client generates UUID per upload attempt
- Server stores (UUID → commit response) for 24+ hours
- Retrying a commit with same UUID returns original response, doesn't create duplicate

See `backend.md` for canonical idempotency patterns.

---

## Compression and Format Transcoding

Raw camera files are larger than necessary for most use cases.

### HEIC → JPG Transcoding

Apple's HEIC (High Efficiency Image Coding) is more efficient than JPG but less universally supported. Dropbox transcodes on upload:

- Better compatibility with non-Apple ecosystems
- Smaller actual file size (after re-encoding at target quality)
- User-configurable — some users want to preserve HEIC

Decision: transcode client-side or server-side?

- **Client-side:** uploaded bytes are smaller. User's CPU does the work.
- **Server-side:** original quality preserved in transit. Server does the work at scale.

Dropbox does client-side — optimizes for bandwidth, which is usually the constraint.

### Video Transcoding

H.265/HEVC vs H.264 vs VP9 vs AV1 — similar decisions:

- H.264 is universal but largest
- H.265 is smaller but has licensing/support issues
- AV1 is newest, best compression, limited support
- VP9 is Google's alternative, YouTube uses it

Generally:
- Store originals if user expects full fidelity (photographers, creators)
- Transcode server-side to multiple formats for adaptive delivery
- Never let client device quality limits dictate what's stored

### Quality vs. Original

Explicit user choice:

- "Upload originals" — full fidelity, larger files
- "Upload optimized" — compressed, smaller files

Never silently compress user content. Provide control.

---

## Bandwidth Management

### WiFi vs Cellular

**Default: WiFi-only for non-urgent uploads.** User doesn't expect camera backup to consume their cellular data budget.

Provide explicit opt-in:
- "Use cellular data" toggle, default off
- Separate "Use cellular for urgent items" toggle for smaller uploads
- Show estimated data usage in settings

Dropbox's pattern:
- Camera uploads default to WiFi
- Explicit toggle for cellular
- User can also switch between states mid-upload

### Metered Networks

iOS and Android both signal metered connections. Respect them:

- Don't upload on metered unless user explicitly allowed
- Pause active uploads when network changes to metered
- Resume when WiFi returns

### Bandwidth Throttling

For active uploads, don't saturate the connection:
- User may be trying to browse, stream, make calls
- Limit upload bandwidth to leave headroom (e.g., 50-70% of available)
- Allow user to prioritize — "pause uploads while I'm on a call"

---

## Battery and Thermal Management

Continuous uploads heat the device and drain battery.

### When to Pause

- **Low battery** — below 20% unless charging. User needs battery for phone functions.
- **Device hot** — iOS and Android expose thermal state. Throttle or pause on high thermal state.
- **Not charging** + long-running upload — offer "overnight mode" (Dropbox's pattern: plug in phone, keep WiFi on, uploads run overnight with screen dimmed)

### Explicit User Modes

Dropbox's overnight uploads:
- User explicitly opts in (not automatic)
- Requires phone plugged in
- Requires WiFi
- Dims screen
- Uploads continuously with relaxed constraints

This pattern works well for initial backups of large photo libraries (thousands of photos, gigabytes of data). Not the default mode, but user-discoverable for power users.

### Scheduling

- Defer large uploads to off-peak user time (when device is charging, on WiFi, not being used)
- OS scheduler (WorkManager on Android, URLSession background priority on iOS) handles this when given appropriate constraints
- Don't re-implement OS scheduling logic — configure it

---

## Common Pitfalls

### In-Memory Upload Queue

App crashes mid-upload. Queue lost. User has to manually retrigger uploads.

**Mitigation:** persistent queue in local database. Survives app termination, OS kills, device reboots.

### No State Machine

Photo uploaded successfully, but upload retries anyway because completion wasn't recorded. Server gets duplicate (or wastes bandwidth uploading to idempotent endpoint).

**Mitigation:** explicit state machine. Validate every transition. Log transitions.

### Single-Shot Upload for Large Files

20MB video upload fails at 80%. Client retries from 0%. Fails again. Eventually user gives up.

**Mitigation:** block-based resumable upload. Retry resumes from last completed block.

### Ignoring Android App Standby

App works great in foreground testing. In production, users report "camera uploads don't work" because OS puts app into restricted bucket when not used daily.

**Mitigation:** use WorkManager with correct constraints. Understand App Standby buckets. Test with Doze mode enabled.

### No User Feedback on Long Uploads

Video uploads for 20 minutes silently. User assumes it's broken, force-quits app. Upload lost.

**Mitigation:** visible progress (notification, in-app indicator). Clear state communication ("Uploading 45 of 200 photos").

### Cellular Data Consumption Without Warning

Feature uploads originals by default. User opens phone bill, sees $200 data charges. Uninstalls.

**Mitigation:** WiFi-only by default. Explicit opt-in for cellular. Clear labels in settings.

### Retry Without Backoff

Upload fails. Client retries immediately. Fails again. Retry. Loop.

**Mitigation:** exponential backoff with jitter. Cap total retries. See `offline-sync.md` for canonical retry logic.

### Duplicate Uploads from OS Notifications

OS fires photo-changed notification on every edit. Client queues same photo multiple times. Server receives duplicates.

**Mitigation:** idempotency at queue level (check if already queued before enqueueing). State machine prevents re-upload of completed items.

### File Deleted During Upload

User uploads a photo, then deletes it from the camera roll. Upload fails because source is gone.

**Mitigation:** copy to app-private storage before upload (see `ios.md` Transferable section for iOS pattern). Detect deletion as a valid reason to cancel, not as error.

### Cross-Platform Code Sharing Illusion

Team writes shared C++ upload library for iOS and Android. Android background constraints differ from iOS. Library accumulates platform-specific hacks until rewrite is cheaper than maintenance.

**Mitigation:** Dropbox's lesson — native per platform from the start for anything involving OS integration. See `cross-platform.md`.

---

## Required Behaviors — Templates for Skill Output

When skill produces output for an upload-heavy feature:

| Behavior | Template |
|----------|----------|
| Resumable uploads | `Interrupted uploads resume from last completed block on next attempt (verified by simulated network drop mid-upload)` |
| Queue persistence | `Queued uploads survive app termination and resume on next launch (verified by force-quit-during-upload test)` |
| Background execution | `Uploads continue in background within OS constraints (verified by backgrounded-upload test on low-power mode)` |
| State integrity | `Upload state transitions follow enforced state machine; invalid transitions logged and surfaced (verified by state machine unit test)` |
| Deduplication | `Same file uploaded multiple times results in single server-side stored copy (verified by duplicate upload test)` |
| Cellular respect | `Uploads default to WiFi-only; cellular usage requires explicit user opt-in (verified by metered-network test)` |
| User feedback | `Active uploads display progress to user (notification, in-app indicator) with count remaining and estimated time (verified by UI test)` |
| Battery respect | `Uploads pause when battery below 20% unless device is charging (verified by low-battery simulation)` |
| Upload idempotency | `Retrying a completed upload returns success without re-uploading bytes (verified by retry-after-completion test)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions involving media upload:

```
Upload protocol: block-based resumable uploads with 4MB blocks, per-block SHA-256 hashes, final commit request with ordered block list. Rationale: enables resumption mid-upload, parallel block transfer, content-addressable server storage with deduplication. Source: Dropbox camera uploads architecture.

Upload worker architecture: scanner worker (identifies new items, queues them) separate from uploader worker (executes transfers, handles retries). Persistent queue in local database. Rationale: separation of concerns, different execution frequencies, crash recovery resumes from persistent state. Source: Dropbox camera uploads architecture.

Background execution (Android): WorkManager with network and charging constraints, respects App Standby and Doze. ForegroundService with notification for actively-uploading state. Rationale: Android's background restrictions make naive persistent services unreliable; WorkManager is the OS-blessed scheduling API. Source: Dropbox Android rewrite documentation.

Background execution (iOS): Background URLSession for resumption across app suspension and termination. Rationale: Background URLSession is OS-managed, survives force-quit, integrates with iOS power management. See ios.md Background Tasks section.

State machine: explicit states (PENDING, UPLOADING, UPLOADED, COMMITTED, FAILED, CANCELLED) with enforced transitions. Invalid transitions logged and surfaced as errors. Rationale: silent state corruption causes duplicate uploads, missed items, and debugging nightmares; explicit enforcement catches bugs in development. Source: Dropbox camera uploads state machine pattern.

Deduplication: OS asset ID checked before queueing; queue-level idempotency prevents re-queueing in-flight items; server-side content-addressable storage deduplicates at block level; idempotency keys on commit requests. Rationale: OS notifications may fire multiple times per asset; retries at multiple layers must not create duplicates.

Bandwidth policy: WiFi-only by default, cellular opt-in via explicit setting. Pause on metered connection changes. Rationale: user data cost sensitivity is real; silent cellular consumption causes immediate user backlash. Source: Dropbox camera uploads cellular handling.

Battery policy: pause uploads below 20% battery unless charging. Respect thermal state. Optional user-triggered "overnight mode" for large backfill uploads (charging + WiFi + dimmed screen). Rationale: continuous uploads thermal-throttle the device and drain battery; user experience depends on phone remaining usable for primary functions. Source: Dropbox overnight uploads pattern.

Format transcoding: HEIC to JPG by default for new users, user-configurable. Client-side transcoding before upload. Rationale: HEIC has patchy ecosystem support; smaller re-encoded bytes save bandwidth; client-side CPU is abundant relative to mobile network. Source: Dropbox camera uploads HEIC handling.

Quality preservation: store uploaded originals at full fidelity; generate compressed variants server-side for delivery. Rationale: photographers and creators expect originals; display clients fetch appropriate variants for their needs. Source: standard pattern across Dropbox, Google Photos, iCloud Photos.
```

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers:

- **User described photo or video upload feature** → full reference applies: resumable block uploads, state machine, background constraints
- **User described document upload (PDFs, smaller files)** → simpler resumable upload, less emphasis on background constraints
- **User described voice messages or short audio clips** → queue + retry + idempotency, can simplify to single-shot for files <1MB
- **User described large file sharing (hundreds of MB)** → full block-based upload, parallel transfers, progressive UI
- **User described camera/photo backup specifically** → entire Dropbox pattern applies, expect two-year implementation scope for production quality
- **User described "upload with progress bar"** → foreground-only upload is simpler; apply subset of this reference
- **MVP with one-time uploads, no background requirement** → simplified single-shot upload with retry can suffice initially

---

## Invariants

- Every upload >1MB uses block-based resumable protocol, not single-shot
- Upload queue persists to local database, never in-memory only
- Explicit state machine enforces upload lifecycle; invalid transitions are errors
- Background execution respects OS scheduling APIs (WorkManager on Android, BGTaskScheduler/URLSession on iOS), never circumvents them
- Idempotency prevents duplicate uploads at multiple layers: queue dedup, server-side hash dedup, commit idempotency keys
- Cellular usage is opt-in, WiFi-only is default for auto-upload features
- Active uploads surface progress to user
- Battery and thermal state throttle or pause uploads
- Media originals are preserved; variants generated separately for delivery