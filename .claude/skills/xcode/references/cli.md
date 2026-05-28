# CLI Reference — xcodebuild + xcrun simctl

Comprehensive command reference for the standalone Xcode CLI surface. Read this when the SKILL.md "CLI common patterns" section doesn't cover what you need — archives, push notifications, privacy permissions, status bar overrides, deep linking, pasteboard, keychain, location simulation, diagnostics.

## Contents

- [xcodebuild — Project discovery](#xcodebuild--project-discovery)
- [xcodebuild — Building for iOS Simulator](#xcodebuild--building-for-ios-simulator)
- [xcodebuild — Building for Device](#xcodebuild--building-for-device)
- [xcodebuild — Building for macOS](#xcodebuild--building-for-macos)
- [xcodebuild — Archives and distribution](#xcodebuild--archives-and-distribution)
- [xcodebuild — Testing](#xcodebuild--testing)
- [xcodebuild — Useful flags](#xcodebuild--useful-flags)
- [simctl — Listing simulators](#simctl--listing-simulators)
- [simctl — Extracting UDIDs with jq](#simctl--extracting-udids-with-jq)
- [simctl — Simulator lifecycle](#simctl--simulator-lifecycle)
- [simctl — App management](#simctl--app-management)
- [simctl — Screenshots and video](#simctl--screenshots-and-video)
- [simctl — Location](#simctl--location)
- [simctl — Status bar overrides](#simctl--status-bar-overrides)
- [simctl — Push notifications](#simctl--push-notifications)
- [simctl — Privacy permissions](#simctl--privacy-permissions)
- [simctl — Pasteboard](#simctl--pasteboard)
- [simctl — URL handling and deep links](#simctl--url-handling-and-deep-links)
- [simctl — Keychain](#simctl--keychain)
- [simctl — Diagnostics](#simctl--diagnostics)
- [Logging with /usr/bin/log](#logging-with-usrbinlog)
- [Finding the built .app](#finding-the-built-app)
- [Complete workflow example](#complete-workflow-example)

---

## xcodebuild — Project discovery

```bash
# List all schemes in workspace
xcodebuild -workspace /path/to/App.xcworkspace -list

# List all schemes in project
xcodebuild -project /path/to/App.xcodeproj -list

# Show available SDKs
xcodebuild -showsdks

# Show available destinations for a scheme
xcodebuild -workspace /path/to/App.xcworkspace -scheme SchemeName -showDestinations

# Show all build settings
xcodebuild -workspace /path/to/App.xcworkspace -scheme SchemeName -showBuildSettings

# Get a specific build setting (bundle ID is a common one)
xcodebuild -workspace /path/to/App.xcworkspace -scheme SchemeName \
  -showBuildSettings | grep PRODUCT_BUNDLE_IDENTIFIER
```

## xcodebuild — Building for iOS Simulator

```bash
# Basic build (selects simulator by name)
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,name=iPhone 16 Pro" \
  build

# Build with specific simulator UUID (preferred — avoids ambiguity)
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" \
  -configuration Debug \
  build

# Build with custom derived data path (recommended for scripted builds)
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath /tmp/build \
  build

# Clean build
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=$UDID" \
  clean build

# Build with specific iOS version
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=18.0" \
  build
```

## xcodebuild — Building for Device

```bash
# Build for generic iOS device (no signing required)
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "generic/platform=iOS" \
  -configuration Release \
  build

# Build for a specific connected device
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS,id=DEVICE_UDID" \
  build
```

## xcodebuild — Building for macOS

```bash
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme MacScheme \
  -destination "platform=macOS" \
  build
```

## xcodebuild — Archives and distribution

```bash
# Create archive
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "generic/platform=iOS" \
  -archivePath /tmp/App.xcarchive \
  archive

# Export IPA from archive
xcodebuild \
  -exportArchive \
  -archivePath /tmp/App.xcarchive \
  -exportPath /tmp/export \
  -exportOptionsPlist /path/to/ExportOptions.plist
```

`ExportOptions.plist` is a property list with at minimum a `method` key (`development`, `ad-hoc`, `enterprise`, `app-store`). The plist also controls code signing, provisioning profiles, and upload symbols. App Store Connect upload itself is out of scope for this skill — handled by `xcrun altool`, Transporter, or Fastlane.

## xcodebuild — Testing

```bash
# Run all tests in the scheme
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=$UDID" \
  test

# Run a specific test class
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=$UDID" \
  -only-testing "AppTests/UserServiceTests" \
  test

# Run a specific test method
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=$UDID" \
  -only-testing "AppTests/UserServiceTests/testLoginSuccess" \
  test

# Skip specific tests
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=$UDID" \
  -skip-testing "AppTests/SlowTests" \
  test

# Test with code coverage
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=$UDID" \
  -enableCodeCoverage YES \
  test

# Save test results to a result bundle
xcodebuild \
  -workspace /path/to/App.xcworkspace \
  -scheme SchemeName \
  -destination "platform=iOS Simulator,id=$UDID" \
  -resultBundlePath /tmp/TestResults.xcresult \
  test
```

The `.xcresult` bundle can be opened in Xcode or inspected programmatically with `xcrun xcresulttool`.

## xcodebuild — Useful flags

| Flag | Description |
|------|-------------|
| `-workspace <path>` | Path to `.xcworkspace` |
| `-project <path>` | Path to `.xcodeproj` |
| `-scheme <name>` | Build scheme |
| `-destination <spec>` | Target device/simulator |
| `-configuration <name>` | `Debug` or `Release` |
| `-derivedDataPath <path>` | Where to put build products |
| `-quiet` | Suppress xcodebuild output |
| `-parallelizeTargets` | Build targets in parallel |
| `-jobs <n>` | Number of concurrent build jobs |
| `-enableCodeCoverage YES` | Collect code coverage during tests |
| `-resultBundlePath <path>` | Save `.xcresult` bundle |
| `-only-testing <selector>` | Restrict tests to selector |
| `-skip-testing <selector>` | Exclude tests from selector |

---

## simctl — Listing simulators

```bash
# Human-readable list
xcrun simctl list devices

# JSON (better for parsing)
xcrun simctl list devices --json

# Only available simulators
xcrun simctl list devices available

# Simulators for a specific OS
xcrun simctl list devices "iOS 18"

# Device types and runtimes
xcrun simctl list devicetypes
xcrun simctl list runtimes
```

## simctl — Extracting UDIDs with jq

```bash
# UDID of a specific named simulator
xcrun simctl list devices --json | \
  jq -r '.devices | .[].[] | select(.name=="iPhone 16 Pro") | .udid' | head -1

# All currently booted simulators
xcrun simctl list devices --json | \
  jq -r '.devices | .[].[] | select(.state=="Booted") | .udid'

# Available simulators with name + UDID
xcrun simctl list devices --json | \
  jq -r '.devices | .[].[] | select(.isAvailable==true) | {name, udid}'
```

## simctl — Simulator lifecycle

```bash
# Boot
xcrun simctl boot $UDID

# Shutdown
xcrun simctl shutdown $UDID
xcrun simctl shutdown all              # all booted simulators

# Erase (reset to clean state — wipes all installed apps and data)
xcrun simctl erase $UDID

# Delete (removes the simulator entirely)
xcrun simctl delete $UDID

# Create a new simulator
xcrun simctl create "My iPhone" \
  "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro" \
  "com.apple.CoreSimulator.SimRuntime.iOS-18-0"
```

## simctl — App management

```bash
# Install (path is to the .app bundle on disk)
xcrun simctl install $UDID /path/to/App.app

# Uninstall
xcrun simctl uninstall $UDID com.bundle.identifier

# Launch
xcrun simctl launch $UDID com.bundle.identifier

# Launch with console output piped to terminal
xcrun simctl launch --console $UDID com.bundle.identifier

# Launch with stdout/stderr redirect to files
xcrun simctl launch \
  --stdout=/tmp/stdout.log \
  --stderr=/tmp/stderr.log \
  $UDID com.bundle.identifier

# Launch and wait for debugger to attach
xcrun simctl launch -w $UDID com.bundle.identifier

# Terminate
xcrun simctl terminate $UDID com.bundle.identifier

# List installed apps
xcrun simctl listapps $UDID

# Get app info (bundle ID, version, paths)
xcrun simctl appinfo $UDID com.bundle.identifier

# Get the data container path (sandbox)
xcrun simctl get_app_container $UDID com.bundle.identifier
```

## simctl — Screenshots and video

```bash
# PNG screenshot
xcrun simctl io $UDID screenshot /tmp/screenshot.png

# JPEG screenshot
xcrun simctl io $UDID screenshot --type=jpeg /tmp/screenshot.jpg

# Record video (Ctrl+C in the running terminal to stop)
xcrun simctl io $UDID recordVideo /tmp/recording.mp4

# Specify codec
xcrun simctl io $UDID recordVideo --codec=h264 /tmp/recording.mp4
```

## simctl — Location

```bash
# Set custom coordinates
xcrun simctl location $UDID set 37.7749,-122.4194

# Set by named place
xcrun simctl location $UDID set "San Francisco, CA"

# Clear override
xcrun simctl location $UDID clear
```

## simctl — Status bar overrides

Useful for taking marketing screenshots with a clean status bar.

```bash
# Override the displayed time
xcrun simctl status_bar $UDID override --time "9:41"

# Override battery state
xcrun simctl status_bar $UDID override --batteryLevel 100 --batteryState charged

# Override network indicators
xcrun simctl status_bar $UDID override --dataNetwork wifi --wifiBars 3

# Combine multiple overrides
xcrun simctl status_bar $UDID override \
  --time "9:41" --batteryLevel 100 --batteryState charged \
  --dataNetwork wifi --wifiBars 3 --cellularBars 4

# Clear all overrides
xcrun simctl status_bar $UDID clear
```

## simctl — Push notifications

```bash
# Send a push notification (payload is a JSON file)
xcrun simctl push $UDID com.bundle.identifier /path/to/payload.json
```

Minimal `payload.json`:

```json
{
  "aps": {
    "alert": {
      "title": "Test",
      "body": "Hello from simctl"
    }
  }
}
```

The app must be installed on the simulator and the bundle ID must match. The simulator delivers the payload as if it came from APNs.

## simctl — Privacy permissions

```bash
# Grant permissions
xcrun simctl privacy $UDID grant photos com.bundle.identifier
xcrun simctl privacy $UDID grant camera com.bundle.identifier
xcrun simctl privacy $UDID grant microphone com.bundle.identifier
xcrun simctl privacy $UDID grant location com.bundle.identifier
xcrun simctl privacy $UDID grant contacts com.bundle.identifier
xcrun simctl privacy $UDID grant calendar com.bundle.identifier

# Revoke
xcrun simctl privacy $UDID revoke photos com.bundle.identifier

# Reset every permission for the app
xcrun simctl privacy $UDID reset all com.bundle.identifier
```

## simctl — Pasteboard

```bash
# Inspect current pasteboard contents
xcrun simctl pbinfo $UDID

# Copy text from host into the simulator pasteboard
echo "Hello" | xcrun simctl pbcopy $UDID

# Paste simulator pasteboard contents to host stdout
xcrun simctl pbpaste $UDID
```

## simctl — URL handling and deep links

```bash
# Open a web URL in Mobile Safari
xcrun simctl openurl $UDID "https://example.com"

# Open a custom-scheme deep link
xcrun simctl openurl $UDID "myapp://path/to/screen"

# Open a universal link (requires associated domains configured)
xcrun simctl openurl $UDID "https://example.com/items/42"
```

## simctl — Keychain

```bash
# Add a root certificate to the simulator's trust store
xcrun simctl keychain $UDID add-root-cert /path/to/cert.pem

# Add a CA certificate
xcrun simctl keychain $UDID add-ca-cert /path/to/ca.pem
```

Useful for testing apps that talk to staging environments behind self-signed certs.

## simctl — Diagnostics

```bash
# Collect a diagnostic archive
xcrun simctl diagnose

# Toggle verbose logging
xcrun simctl logverbose $UDID enable
# ... reproduce the issue ...
xcrun simctl logverbose $UDID disable

# Spawn a process inside the simulator (e.g., for log streaming from sim's log subsystem)
xcrun simctl spawn $UDID log stream --predicate 'processImagePath CONTAINS "App"'
```

---

## Logging with /usr/bin/log

```bash
# Stream logs for a specific app
/usr/bin/log stream \
  --predicate 'processImagePath CONTAINS[cd] "AppName"' \
  --level debug

# Stream as JSON (machine-parseable)
/usr/bin/log stream \
  --predicate 'processImagePath CONTAINS[cd] "AppName"' \
  --style json

# Stream with a timeout
/usr/bin/log stream \
  --predicate 'processImagePath CONTAINS[cd] "AppName"' \
  --timeout 60s

# Filter by message content (errors only)
/usr/bin/log stream \
  --predicate 'eventMessage CONTAINS[cd] "error"' \
  --level debug

# Save to a file in the background
/usr/bin/log stream \
  --predicate 'processImagePath CONTAINS[cd] "AppName"' \
  --style json > /tmp/logs.json &
LOG_PID=$!

# Stop later
kill $LOG_PID
```

### Common predicates

| Predicate | Description |
|-----------|-------------|
| `processImagePath CONTAINS[cd] "App"` | Filter by app name (case- and diacritic-insensitive) |
| `eventMessage CONTAINS[cd] "error"` | Filter by message text |
| `category == "network"` | Filter by category |
| `subsystem == "com.apple.xxx"` | Filter by subsystem |
| `messageType == error` | Only error-level messages |

Predicates can be combined with `AND` / `OR` / `NOT`:

```bash
/usr/bin/log stream \
  --predicate '(processImagePath CONTAINS[cd] "MyApp") AND (messageType == error)' \
  --style json
```

---

## Finding the built .app

```bash
# When -derivedDataPath was specified
find /tmp/build -name "*.app" -type d | head -1

# In the default derived data location
find ~/Library/Developer/Xcode/DerivedData -name "*.app" \
  -path "*Debug-iphonesimulator*" | head -1

# Via build settings
xcodebuild -workspace App.xcworkspace -scheme App \
  -showBuildSettings | grep "BUILT_PRODUCTS_DIR"
```

The built `.app` location pattern: `<derivedDataPath>/Build/Products/<Configuration>-<platform>/<ProductName>.app`. For example: `/tmp/build/Build/Products/Debug-iphonesimulator/App.app`.

---

## Complete workflow example

End-to-end build + install + launch script with all the practical guards:

```bash
#!/bin/bash
set -e

# Configuration
WORKSPACE="/path/to/App.xcworkspace"
SCHEME="App"
BUNDLE_ID="com.example.app"
DERIVED_DATA="/tmp/build"

# 1. Resolve simulator UDID
echo "Finding simulator..."
UDID=$(xcrun simctl list devices --json | \
  jq -r '.devices | .[].[] | select(.name=="iPhone 16 Pro" and .isAvailable==true) | .udid' | head -1)

if [ -z "$UDID" ]; then
  echo "Error: No matching simulator found"
  exit 1
fi
echo "Using simulator: $UDID"

# 2. Boot (no-op if already booted)
echo "Booting simulator..."
xcrun simctl boot "$UDID" 2>/dev/null || true
sleep 3   # give the sim a moment to settle before installing

# 3. Build
echo "Building..."
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED_DATA" \
  -configuration Debug \
  build

# 4. Locate the built .app
APP_PATH=$(find "$DERIVED_DATA" -name "*.app" -type d | head -1)
if [ -z "$APP_PATH" ]; then
  echo "Error: Built .app not found under $DERIVED_DATA"
  exit 1
fi
echo "Found app: $APP_PATH"

# 5. Install
echo "Installing..."
xcrun simctl install "$UDID" "$APP_PATH"

# 6. Launch with console output piped to terminal
echo "Launching..."
xcrun simctl launch --console "$UDID" "$BUNDLE_ID"
```

`set -e` ensures the script bails on the first failure. Each step's guard message tells you which stage broke.