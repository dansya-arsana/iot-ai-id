# Local desktop installers

Build with `npm run desktop:package`. Native macOS builds produce a DMG in `dist/desktop/installers/`. Native Windows x64 builds produce an NSIS `.exe` installer there. The current Mac architecture is packaged in `dist/desktop/IOT AI ID-darwin-arm64/IOT AI ID.app` (or `darwin-x64` on Intel). Open the app normally. The app is a local prototype, unsigned and not notarized; it is not a public distribution release.

The bundle includes Electron, a standalone Node runtime, Arduino CLI, production web assets, backend sources and runtime dependencies. It does not require the development server or a separately installed Node runtime. Packaging rejects Node or Arduino CLI binaries that depend on non-system macOS libraries. Build on the target architecture. Windows downloads official binaries and verifies their SHA256 against release checksum manifests before extraction. Mac packaging currently requires Node v24.13.1 and Arduino CLI 1.5.1 so the bundled license notices match the binaries.

The app owns a loopback backend at `http://127.0.0.1:8788`. A second launch focuses the existing window. A port conflict or backend startup failure stops launch and displays an error. Closing the window quits the app and stops backend/runtime/compiler processes. External navigation, popups, renderer Node access and browser permission requests are disabled.

SQLite, firmware compilation output and logs live in `~/Library/Application Support/IOT AI ID/`. The app never writes into its installed bundle. Existing repository development data is not migrated or bundled.

## Host requirements

AI planning uses the host Jev installation at `~/.local/bin/jev-codex` and authenticated Codex at `/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex`. Overrides `JEV_CODEX_BIN` and `CODEX_BIN` are supported by the backend. An explicitly configured `OPENAI_API_KEY` can replace authenticated Codex, but Jev remains required. No credentials, home configuration or API keys are bundled. The app opens even when AI is unavailable, and the workbench reports the missing provider configuration. Catalogs and existing project evidence remain readable; new AI planning/chat fail explicitly until configured. There is no silent fixture fallback.

Arduino CLI is bundled. ESP32 core and recipe libraries still use the host Arduino installation, normally `~/Library/Arduino15` and `~/Documents/Arduino`. Install the `esp32:esp32` core and the BME280/SSD1306 recipe libraries before a physical run. Existing `ARDUINO_DIRECTORIES_DATA`, `ARDUINO_DIRECTORIES_DOWNLOADS` and `ARDUINO_DIRECTORIES_USER` environment overrides remain supported. Finder PATH includes Homebrew, `/usr/local/bin` and `~/.local/bin`.

USB detection lists serial candidates. Selecting and authorizing a detected port is required before flashing. A detected candidate is not physical verification; successful upload and identity-bound serial evidence are required. Unsupported board/recipe requests retain existing validation gates. Simulation remains explicitly labeled and does not prove hardware success.

Optional OpenViking, coordinator and Wokwi services are not bundled. Their unavailable status remains visible. Read `backend.log` in the application support directory for startup diagnostics. Never publish that log without checking for private project content.

## Verification

Run `npm run check` and `npm run desktop:package`. Launch the packaged app, verify API status and USB inventory, create a project, quit, then reopen to verify persistence. A physical flash test requires connected supported hardware and explicit port authorization. Packaging or USB discovery alone does not verify a physical run.

## Windows release

Run the `Native desktop installers` GitHub Actions workflow, or `npm ci && npm run desktop:package` on Windows x64 with Node 24.13.1. The workflow builds an unsigned NSIS installer, tests descendant shutdown, and starts the bundled backend with an explicit fixture provider for readiness/status verification. That fixture smoke test does not establish AI or physical hardware readiness. Download the workflow artifact after successful completion. The installer is per-user; selecting an installation directory is supported.

Windows production AI requires host Jev and Codex installations configured via `JEV_CODEX_BIN` and `CODEX_BIN` (or `OPENAI_API_KEY` plus Jev). ESP32 core and recipe libraries remain host requirements. No silent fixture fallback is enabled in installed apps. Windows PATH uses the OS delimiter, bundled executables use `.exe`, and shutdown/timeout uses the Windows process-tree terminator. Writable state lives in the Electron user-data directory.

Both installers are unsigned testing artifacts. macOS is not notarized; Windows does not have an Authenticode signature. Native Windows workflow execution is required before claiming the Windows installer verified; generating workflow configuration alone does not verify installation or launch.
