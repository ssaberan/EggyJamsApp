# EggyJams Desktop Studio

The desktop creation tool for EggyJams: build visual-novel-style games locally. No cloud account
is required to create. When you're ready to share, export an offline `.zip` and publish it on the
[EggyJams web platform](../README.md).

> This package lives inside the EggyJams monorepo. The repo **root** is the web platform; this
> folder is the desktop app. Every script below can be run **from the repo root** via the
> `desktop:*` delegation scripts, or **from this folder** directly.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20+ recommended)
- npm (comes with Node)

## Development

From the repo root:

```bash
npm run desktop:install   # installs desktop-app/ dependencies
npm run desktop:dev       # compiles Electron main, starts Vite, opens the app
```

Or from inside `desktop-app/`:

```bash
npm install
npm run electron:dev
```

After changing files under `electron/`, restart the dev command.

### Scripts

| From `desktop-app/` | From repo root | Purpose |
|---------------------|----------------|---------|
| `npm run dev` | — | Vite only (browser at `http://localhost:5173`; limited without Electron APIs) |
| `npm run build` | `npm run desktop:build` | Production React + offline runner + Electron bundles |
| `npm run electron:dev` | `npm run desktop:dev` | Build Electron main, start Vite, open the app |
| `npm run dist` | `npm run desktop:dist` | Build installers into `desktop-app/release/` |
| `npm run dist:win:zip` | `npm run desktop:dist:win` | Windows portable `.zip` |
| `npm run dist:mac:zip` | `npm run desktop:dist:mac` | macOS `.zip` |
| `npm run build:game-player:win` | `npm run desktop:shells:win` | Build the Windows player shell |
| `npm run build:game-player:mac` | `npm run desktop:shells:mac` | Build the macOS player shell |
| `npm run lint` | — | ESLint |

### WSL2 notes

- **Input lag:** Electron on WSL2 uses WSLg, which is often slower than a native Windows browser.
  For responsive UX work, run Electron on Windows or compare with `npm run electron:build`.
- **D-Bus errors** (`Failed to connect to the bus`) in the terminal are harmless on WSL2.
- **`[WARN:COPY MODE]` / invisible window:** This comes from WSLg, not EggyJams. Quit Electron,
  wait ~1-2 minutes after opening WSL, then try again; or `wsl --shutdown` from an Admin PowerShell
  and reopen.
- Optional flags: `ELECTRON_OZONE_PLATFORM=x11`, `ELECTRON_OPEN_DEVTOOLS=1`,
  `ELECTRON_FORCE_NATIVE_FRAME=1`, `ELECTRON_FORCE_CUSTOM_FRAME=1`.

## Build installers

```bash
npm run desktop:dist        # from repo root  (artifacts in desktop-app/release/)
```

Packaged artifacts (`.dmg`, `.exe`/NSIS, `.AppImage`) depend on the OS you build on. See
[electron-builder](https://www.electron.build/) for cross-compilation requirements.

## Sharing games

The editor has these export options:

- **Download Offline (.zip)** — a self-contained, browser-playable bundle. **This is the file you
  upload to the EggyJams web platform** to publish it for everyone.
- **Download for Windows / Mac** — a portable executable for players without EggyJams installed.

Executable exports rely on pre-built player shells in `game-player-shells/`. Build them first:

```bash
npm run desktop:shells:win   # build the Windows shell on Windows
npm run desktop:shells:mac   # build the macOS shell on macOS
```

## Project folder format

Each game is a **directory** the user chooses via Save As:

```
MyGame/
├── project.json       # metadata, story graph (graph_data), thumbnail path
├── thumbnail.webp     # optional
├── assets/
│   ├── manifest.json
│   └── <image/audio files>
└── saves/
    ├── slot-1.json
    └── ...
```

App metadata (outside the project folder): recent projects + default save location in
`userData/registry.json`; theme/display preferences in `userData/preferences.json`.

## Layout

```
desktop-app/
├── electron/          # main process, preload, filesystem IPC, export packaging
├── src/               # React UI (editor, player, stores)
├── game-player/       # standalone player shell project (for executable exports)
├── game-player-shells/# prebuilt shells (gitignored)
├── dist/              # Vite build output incl. offline-runner (gitignored)
├── dist-electron/     # compiled main/preload (gitignored)
└── release/           # installers from electron-builder (gitignored)
```
