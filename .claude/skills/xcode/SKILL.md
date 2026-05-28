---
name: xcode
description: >-
  Drive Xcode and the iOS/macOS toolchain through two complementary surfaces:
  the live-IDE bridge (xcode-cli + MCP tools, talks to an open Xcode workspace
  via SourceKit and AppleScript) and the standalone CLI (xcodebuild + xcrun
  simctl, runs headless). Use whenever the user wants to build, run, or test
  an Xcode project, see compiler errors, fix Swift code, render a SwiftUI
  preview, look up an Apple API, manage iOS simulators (boot, install,
  screenshot, log capture), send push notifications or deep links to a
  simulator, build a release archive, or do anything that needs Xcode's
  project context or the iOS Simulator. Trigger on direct mentions — Xcode,
  xcode-cli, xcodebuild, xcrun, simctl, SwiftUI, iOS app, macOS app, Swift
  Package, .xcodeproj, .xcworkspace, scheme, simulator, UDID, #Preview — and
  on indirect cues: "build my app", "what's broken", "fix the build", "run
  tests in MyTarget", "render this SwiftUI view", "boot a simulator",
  "install on iPhone 16 Pro", "take a screenshot of the simulator", "stream
  logs from my app", "what does this API do", "archive for release". Use
  this instead of guessing at xcodebuild flags, fabricating simulator UDIDs,
  or reading project files with plain bash — the bridge is the truth for the
  open project, and the CLI patterns here are verified flag combinations. Do
  NOT use for greenfield Swift with no project, generic iOS/macOS API
  discussion, UI automation / XCUITest, App Store Connect / TestFlight /
  Xcode Cloud, or Fastlane operations.
---

# Xcode

Two complementary surfaces:

1. **Bridge** — `xcode-cli` + MCP tools talking to a live, open Xcode workspace via SourceKit and AppleScript. Sees indexed symbols, navigator issues, the last build's diagnostics, project group membership. Required when you need live IDE state.
2. **CLI** — `xcodebuild` + `xcrun simctl`, standalone Xcode command-line tools. Run headless, no IDE required. Required for simulator lifecycle, screenshots, log streaming, archives, headless builds, and anything scriptable.

Most non-trivial sessions touch both. Pick per operation.

## When to use

**Bridge territory:**
- Build / Run / Test the project currently open in Xcode
- Diagnose compile, type, or link errors
- Inspect symbols, files, or directories as Xcode sees them
- Edit Swift / Objective-C / resource files inside the project group (membership stays correct)
- Render a SwiftUI `#Preview` to a PNG
- Execute a one-shot Swift expression in a file's type context
- Search Apple's documentation indexed locally

**CLI territory:**
- Boot, shutdown, erase, or create iOS simulators
- Build to a specific simulator UDID or OS version, headless or in CI
- Install, launch, terminate apps on a simulator
- Take screenshots, record video, stream app logs
- Send push notifications, set location, override status bar, grant privacy permissions
- Open URLs / deep links in the simulator
- Build archives and export IPAs for distribution

**Do NOT use for:**
- Generating Swift code with no project to anchor it — normal coding task
- App Store Connect, TestFlight, Xcode Cloud, Fastlane — different surfaces
- UI automation / XCUITest — out of scope for this skill
- Generic iOS/macOS API explanation that doesn't need the live IDE or simulator

## Choosing a surface

| Want | Use |
|---|---|
| Live build errors in an open project | Bridge: `BuildProject` + `GetBuildLog` |
| Fast diagnostic on a single file | Bridge: `XcodeRefreshCodeIssuesInFile` |
| Surgical edit to a project file | Bridge: `XcodeUpdate` |
| Render a SwiftUI preview | Bridge: `RenderPreview` |
| Look up an Apple API | Bridge: `DocumentationSearch` |
| Boot or manage a simulator | CLI: `xcrun simctl boot/shutdown/erase` |
| Install a built `.app` on a simulator | CLI: `xcrun simctl install` |
| Screenshot the simulator | CLI: `xcrun simctl io … screenshot` |
| Stream app logs | CLI: `/usr/bin/log stream` |
| Headless build for Release / CI | CLI: `xcodebuild` |
| Build + run loop in the open IDE | Bridge: `xcode-cli run` |
| Build + install + launch in a script | CLI: `xcodebuild` + `simctl` chain |
| Run unit tests | Either — Bridge if iterating, CLI if scripting |
| Push notification / deep link / permission grant | CLI: `xcrun simctl push/openurl/privacy` |
| Build an archive for distribution | CLI: `xcodebuild archive` |

Rule of thumb: bridge if Xcode is open and you want fast iteration; CLI if scripting or you need simulator state.

## Operating principles

Rules of thumb that minimize wasted bridge calls, redundant builds, and false confidence. Each comes up repeatedly across the workflows below.

- **Cheapest tool that answers the question.** `XcodeRefreshCodeIssuesInFile` before `BuildProject` for single-file work. `XcodeUpdate` before `XcodeWrite`. `GetBuildLog --severity error` before reading the whole log. A full build is 20–60s; an indexer call is under a second.
- **Project-relative paths in the bridge, absolute paths in the CLI.** The bridge resolves against the project group, not the filesystem. `xcodebuild`/`simctl` resolve against the filesystem and don't know about project groups.
- **Pin the UDID.** Always select a simulator by UDID, not by name. Names like "iPhone 16 Pro" repeat across iOS versions and pick non-deterministically. Resolve once with `xcrun simctl list devices --json | jq …` and reuse the variable for the rest of the session.
- **Read before edit.** `XcodeRead` the region you intend to change before constructing the `old` string for `XcodeUpdate`. Reconstructing from memory is how surgical edits become destructive ones.
- **Cap the build/fix loop at 3–4 attempts.** If the same error keeps recurring, surface the situation and your current hypothesis rather than churning. Loops that don't converge usually need information the bridge doesn't have (intent, missing dependency, scheme misconfig).
- **Trust ground truth over diagnostics.** Navigator issues from the indexer can be stale on partially-loaded projects. When correctness matters, run `BuildProject` and read `GetBuildLog`.
- **File ops through the right surface.** Bridge file ops (`XcodeWrite`, `XcodeMV`, `XcodeRM`) update `.xcodeproj` membership; bash `mv`/`rm` from the CLI side do not. If a file needs to be part of the Xcode project, edit it through the bridge.

## Prerequisites

**Bridge:**
1. Xcode 26.3+ installed and the target project open in at least one tab.
2. `xcode-cli` on PATH: `npm install -g xcode-cli`.
3. Bridge running: `xcode-cli-ctl install` (background LaunchAgent) or `xcode-cli-ctl run` (foreground).
4. For Run-via-keystroke: Terminal/iTerm has Accessibility permission in **System Settings → Privacy & Security → Accessibility**.

**CLI:**
1. Xcode installed; `xcodebuild -version` should print a version.
2. Command-line tools selected: `xcode-select -p` should print a path. If it prints `/Library/Developer/CommandLineTools`, point it at Xcode: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
3. `jq` available for parsing `simctl --json` output.

Quick health checks: `xcode-cli windows` (bridge alive), `xcrun simctl list devices --json | jq '.devices | length'` (CLI alive).

## Bridge — tool ↔ command reference

| Action | MCP tool | CLI |
|---|---|---|
| List open Xcode tabs/workspaces | `XcodeListWindows` | `xcode-cli windows` |
| Quick status (windows + issue counts) | — | `xcode-cli status` |
| Build project | `BuildProject` | `xcode-cli build` |
| Get last build log | `GetBuildLog` | `xcode-cli build-log [--severity error\|warning\|all]` |
| Build then run | — (compose `BuildProject` + run) | `xcode-cli run` |
| Run without building | — | `xcode-cli run-without-build` |
| List navigator issues | `XcodeListNavigatorIssues` | `xcode-cli issues [--severity error]` |
| Refresh single-file diagnostics | `XcodeRefreshCodeIssuesInFile` | `xcode-cli file-issues "path"` |
| List available tests | `GetTestList` | `xcode-cli test list [--json]` |
| Run all tests | `RunAllTests` | `xcode-cli test all` |
| Run specific tests | `RunSomeTests` | `xcode-cli test some "Target::Class/method()"` |
| Render SwiftUI preview | `RenderPreview` | `xcode-cli preview "path" --out ./out` |
| Execute snippet in file context | `ExecuteSnippet` | `xcode-cli snippet "path" "expr" --purpose "why"` |
| Search Apple documentation | `DocumentationSearch` | `xcode-cli doc "query" [--frameworks SwiftUI UIKit]` |
| Read file | `XcodeRead` | `xcode-cli read "path"` |
| List directory | `XcodeLS` | `xcode-cli ls [-r] "path"` |
| Search text in files | `XcodeGrep` | `xcode-cli grep "pattern"` |
| Find files by glob | `XcodeGlob` | `xcode-cli glob "**/*.swift"` |
| Write file (create/overwrite) | `XcodeWrite` | `xcode-cli write "path" "content"` |
| Surgical edit (find/replace) | `XcodeUpdate` | `xcode-cli update "path" "old" "new" [--replace-all]` |
| Move/rename file | `XcodeMV` | `xcode-cli mv "Old" "New"` |
| Create directory | `XcodeMakeDir` | `xcode-cli mkdir "path"` |
| Delete file | `XcodeRM` | `xcode-cli rm "path"` |

Bridge file paths are **project-relative**. When multiple Xcode workspaces are open, pass `--tab <tabIdentifier>` from `XcodeListWindows`.

## CLI — common patterns

The full `xcodebuild` and `xcrun simctl` reference is in [`references/cli.md`](references/cli.md). The patterns below cover most sessions; reach for the reference for archives, distribution, push notifications, status bar overrides, location simulation, permission grants, pasteboard, keychain, deep linking.

### Resolve a simulator UDID

```bash
UDID=$(xcrun simctl list devices --json \
  | jq -r '.devices | .[].[] | select(.name=="iPhone 16 Pro" and .isAvailable==true) | .udid' \
  | head -1)
```

Reuse `$UDID` for the rest of the session. If the result is empty, the named device isn't available — list with `xcrun simctl list devices available` and pick one that exists.

### Build for a simulator (headless)

```bash
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -destination "platform=iOS Simulator,id=$UDID" \
  -configuration Debug \
  -derivedDataPath /tmp/build \
  build
```

Always pass `-derivedDataPath` for scripted builds. Without it, Xcode picks an opaque path under `~/Library/Developer/Xcode/DerivedData/` that's hard to predict and query.

### Build, install, launch (CLI chain)

```bash
# 1. Boot the simulator (no-op if already booted)
xcrun simctl boot "$UDID" 2>/dev/null || true

# 2. Build
xcodebuild -workspace App.xcworkspace -scheme App \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath /tmp/build build

# 3. Locate the built .app
APP=$(find /tmp/build -name "*.app" -type d | head -1)

# 4. Install and launch
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch --console "$UDID" com.example.bundleid
```

`--console` pipes stdout/stderr to the terminal. Drop it for a fire-and-forget launch.

### Screenshot

```bash
xcrun simctl io "$UDID" screenshot /tmp/shot.png
# JPEG variant
xcrun simctl io "$UDID" screenshot --type=jpeg /tmp/shot.jpg
```

### Stream app logs

```bash
/usr/bin/log stream \
  --predicate 'processImagePath CONTAINS[cd] "AppName"' \
  --style json > /tmp/logs.json &
LOG_PID=$!
# ... interact with the app ...
kill $LOG_PID
```

Filter further with predicates like `eventMessage CONTAINS[cd] "error"` or `subsystem == "com.example.app"`. See `references/cli.md` for the predicate cheatsheet.

### Session variables

CLI is stateless — pin context in env vars at the start of any multi-step script:

```bash
export XCODE_WORKSPACE="$(pwd)/App.xcworkspace"
export XCODE_SCHEME="App"
export SIM_UDID="<resolved UDID>"
export APP_BUNDLE_ID="com.example.app"
```

## Workflows

### Build → diagnose → fix loop (Bridge)

Default when the user says "fix the build" / "what's broken" with Xcode open:

1. `BuildProject`.
2. Success → confirm, done.
3. Failure → `GetBuildLog` with `severity=error` to filter out warnings. Errors come back with file, line, column, message.
4. For each error: `XcodeRead` the offending region, produce a fix, apply with `XcodeUpdate` (surgical), not `XcodeWrite` (full overwrite).
5. Loop back to step 1 to confirm.

Bounded by the 3–4 attempt rule. If it doesn't converge, surface to the user.

### Single-file fast iteration (Bridge)

When the user iterates on one file, **do not run a full build**. Use `XcodeRefreshCodeIssuesInFile` — diagnostics for that file via the indexer in under a second, vs. tens of seconds for a full build.

Pattern: edit with `XcodeUpdate` → `XcodeRefreshCodeIssuesInFile` → only build to verify cross-module wiring once the file is clean.

### Running the app

**Open IDE (Bridge):** `xcode-cli run` builds first via `BuildProject`, returns error JSON on failure with non-zero exit, and on success sends ⌃⌘R to Xcode via AppleScript. Default for interactive work. `xcode-cli run-without-build` skips compilation — useful for asset/plist iteration.

**Headless (CLI):** for "build and run on iPhone 16 Pro without me clicking anything": resolve `$UDID`, run `xcodebuild ... build`, find the `.app`, `xcrun simctl install` then `xcrun simctl launch`. See the build/install/launch chain in the CLI common patterns section above.

### Tests

**Bridge (interactive):**

1. `GetTestList` first. Output includes `targetName` and `identifier` per test — use these literal strings; paraphrasing them silently fails because the match is exact.
2. `RunAllTests` for the full suite, `RunSomeTests` for a subset.
3. `RunSomeTests` only runs tests from the **active scheme's active test plan**. If a target is missing, switch scheme or edit the test plan inside Xcode — no CLI override exists.

**CLI (scripting / CI):**

```bash
# All tests in the scheme
xcodebuild -workspace App.xcworkspace -scheme App \
  -destination "platform=iOS Simulator,id=$UDID" test

# Specific class or method
xcodebuild ... -only-testing "AppTests/UserServiceTests" test
xcodebuild ... -only-testing "AppTests/UserServiceTests/testLogin" test

# Skip slow tests
xcodebuild ... -skip-testing "AppTests/SlowTests" test

# With code coverage and result bundle
xcodebuild ... -enableCodeCoverage YES \
  -resultBundlePath /tmp/TestResults.xcresult test
```

### SwiftUI preview rendering (Bridge)

`RenderPreview` / `xcode-cli preview "MyApp/Views/HomeView.swift" --out ./out`:
- The file needs at least one `#Preview { ... }` macro — that's what the renderer iterates over. Legacy `PreviewProvider` types from the old API also work, but `#Preview` is the supported path going forward.
- Output is one PNG per preview block, written into `--out`.
- Empty result almost always means the previewed view doesn't compile. Run `XcodeRefreshCodeIssuesInFile` on it first to surface why.

### Execute snippet (Bridge)

`ExecuteSnippet` / `xcode-cli snippet "MyApp/Sources/AuthService.swift" "AuthService.shared.currentUser?.id" --purpose "verify session restored after relaunch"`:
- Runs the expression in the type-context of the given file: that file's imports, same-module visibility.
- For inspection of computed state, not side-effecting code (the bridge is not a REPL).
- Always pass `--purpose` — the bridge logs it, and explicit intent makes review easier later.

### Documentation search (Bridge)

`DocumentationSearch` / `xcode-cli doc "NavigationStack init" --frameworks SwiftUI`:
- Queries the local DocC index Xcode has on disk. Canonical Apple docs, not search-engine results.
- Pass `--frameworks` to scope (`SwiftUI`, `UIKit`, `AppKit`, `Foundation`, `Combine`, `Observation`).
- Reach for this instead of recalling Apple API signatures from memory — names and availability change between SDKs.

### File operations (Bridge)

`XcodeRead`, `XcodeWrite`, `XcodeUpdate`, `XcodeMV`, `XcodeRM`, `XcodeMakeDir` operate on the project's group structure as Xcode sees it. They correctly update `.xcodeproj` membership when adding/removing files. Plain `cat`/`echo`/`mv` from bash would create orphan files Xcode doesn't index — use the bridge tools when files need to stay in the project.

Prefer `XcodeUpdate` over `XcodeWrite` for any change short of full restructuring. If `XcodeUpdate` fails because `old` isn't unique, widen the `old` string with more surrounding context. Avoid `--replace-all` unless every occurrence should change.

### Simulator management (CLI)

```bash
# Boot / shutdown / erase
xcrun simctl boot $UDID
xcrun simctl shutdown $UDID
xcrun simctl shutdown all              # all booted sims
xcrun simctl erase $UDID               # reset to clean state

# App lifecycle
xcrun simctl listapps $UDID
xcrun simctl uninstall $UDID com.example.app
xcrun simctl terminate $UDID com.example.app

# Status bar override (useful before screenshots)
xcrun simctl status_bar $UDID override --time "9:41" --batteryLevel 100 --batteryState charged
xcrun simctl status_bar $UDID clear
```

For deep links, push notifications, location, privacy permissions, pasteboard, and keychain — see `references/cli.md`.

### Archives and distribution (CLI)

```bash
# Create archive
xcodebuild -workspace App.xcworkspace -scheme App \
  -destination "generic/platform=iOS" \
  -archivePath /tmp/App.xcarchive archive

# Export IPA
xcodebuild -exportArchive \
  -archivePath /tmp/App.xcarchive \
  -exportPath /tmp/export \
  -exportOptionsPlist /path/to/ExportOptions.plist
```

Beyond this, App Store Connect / TestFlight upload is out of scope — that's a different surface (`xcrun altool` / Transporter / Fastlane).

## Worked examples

**User**: "the build's broken, can you fix it" (Xcode open with the project)
→ Bridge. `BuildProject` → fails. → `GetBuildLog --severity error` → 2 errors: `AuthService.swift:42` ("missing argument label 'username:'"), `Models.swift:88` ("cannot find 'UserDTO' in scope"). → `XcodeRead AuthService.swift` lines 30–60 → identify call site → `XcodeUpdate` to add the label. → `XcodeRead Models.swift`; `UserDTO` is in `Models/UserDTO.swift` but not imported. → `XcodeUpdate` to add the import. → `BuildProject` → green. Report fixes succinctly.

**User**: "i'm tweaking HomeView, just check it still compiles"
→ Bridge. Skip `BuildProject` (operating principle: cheapest tool). → `XcodeRefreshCodeIssuesInFile MyApp/Views/HomeView.swift` → one warning about an unused binding, no errors. Report directly. Under a second vs. ~30s.

**User**: "boot iPhone 16 Pro and run my app on it, take a screenshot when it's up"
→ CLI. Resolve UDID with the `jq` query. → `xcrun simctl boot $UDID`. → `xcodebuild ... -derivedDataPath /tmp/build build`. → Find the `.app` with `find`. → `xcrun simctl install $UDID "$APP"`. → `xcrun simctl launch $UDID com.example.app`. → `sleep 2` to let the launch settle. → `xcrun simctl io $UDID screenshot /tmp/launched.png`. → Present the screenshot.

**User**: "stream logs from my running app to a file while i poke around in the simulator, then stop when i say"
→ CLI. `/usr/bin/log stream --predicate 'processImagePath CONTAINS[cd] "MyApp"' --style json > /tmp/logs.json &`. → Capture `LOG_PID=$!`. → Tell the user logging started. → Wait for the user to signal stop. → `kill $LOG_PID`. → Offer to grep / summarize `/tmp/logs.json`.

## Common gotchas

**Bridge:**
- Project-relative paths only. Absolute paths silently miss.
- Bridge silent or hangs → `xcode-cli-ctl status`, then `xcode-cli-ctl uninstall && xcode-cli-ctl install`. If still broken, confirm Xcode is open with a project loaded.
- `run` does nothing visible → Accessibility permission missing on the parent shell.
- Preview returns empty → file doesn't compile, or no `#Preview` macro. Run `XcodeRefreshCodeIssuesInFile` first.
- `GetBuildLog` is stale — it returns the last build's log. `BuildProject` first if you need current state.
- Navigator issues ≠ build errors. The indexer can be wrong on partially-loaded projects; ground truth is `BuildProject` + `GetBuildLog`.
- `XcodeUpdate` matches literally, including whitespace and indentation. Copy `old` from a fresh `XcodeRead`.
- Multi-workspace ambiguity → resolve `tabIdentifier` once via `XcodeListWindows` and pin it.

**CLI:**
- "No matching destination" → `xcodebuild ... -showDestinations` and use a destination string from the output verbatim.
- Simulator by name is ambiguous when multiple iOS versions are installed. Always use UDID.
- The built `.app` lands under `<derivedDataPath>/Build/Products/<Config>-<platform>/`. If `-derivedDataPath` is unset, it's under `~/Library/Developer/Xcode/DerivedData/<workspace-hash>/`.
- `simctl boot` errors if already booted. Use `xcrun simctl boot $UDID 2>/dev/null || true` in scripts.
- File operations from bash (`mv`, `rm`, `mkdir`) don't update `.xcodeproj` membership. Use bridge tools for files Xcode needs to know about.
- `simctl push` requires the app's bundle ID to be installed and registered for push.
- `xcode-select -p` pointing at `/Library/Developer/CommandLineTools` (not Xcode.app) means many commands quietly use a different toolchain than Xcode. Fix with `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

## Escape hatches

**Bridge:** any MCP tool not listed above can be invoked via:

```bash
xcode-cli call <ToolName> --args '{"key":"value"}'
```

**CLI:** anything not covered here — full xcodebuild flag matrix, all simctl subcommands (push notifications, privacy permissions, status bar, deep links, pasteboard, keychain, location simulation, diagnostics, recordVideo), `/usr/bin/log` predicate cheatsheet, archive export options — is in `references/cli.md`.