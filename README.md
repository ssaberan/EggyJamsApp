# EggyJams Studio

EggyJams Studio is a free desktop app for making your own games — no coding required. You design
your game as a visual flowchart, drop in your own art and music, connect scenes together, and hit
play to test it instantly. When it's ready, share it as a link anyone can play in their browser.

It runs on **Windows, macOS, and Linux**, works completely offline, and you don't need an account
to start creating.

## Download

Grab the latest version from the [**Releases page**](https://github.com/ssaberan/EggyJamsApp/releases/latest):

- **Windows** — `EggyJams-windows.zip`
- **macOS** — `EggyJams-mac.dmg`
- **Linux** — `EggyJams-linux.AppImage`

On macOS, open the `.dmg` and drag EggyJams into your Applications folder. On Windows, unzip the
download and double-click the EggyJams app.

Because the app is new and isn't registered with Apple or Microsoft yet, your computer may warn you
the first time you open it. It's safe to continue:

- **Windows** — if you see *"Windows protected your PC"*, click *More info → Run anyway*.
- **macOS** — recent macOS versions no longer offer "Open" from the warning dialog. Instead, after
  the *"cannot be opened because the developer cannot be verified"* message appears, open
  *System Settings → Privacy & Security*, scroll to the *Security* section, and click *Open Anyway*
  next to EggyJams (then confirm with *Open*). You only need to do this once. Advanced users can
  instead run `xattr -dr com.apple.quarantine /Applications/EggyJams.app` in Terminal.

## What you can make

EggyJams is built for **story-driven games**, and you can mix and match different kinds of scenes
in a single project:

- **Dialogue scenes** — characters, sprites, and text for visual-novel-style storytelling.
- **Branching choices** — let players make decisions that change where the story goes, with
  optional conditions (e.g. only show a choice if a variable is high enough).
- **Cinematic cutscenes** — a timeline editor for animating backgrounds, characters, camera moves,
  audio, and text.
- **Point-and-click scenes** — draw clickable hotspots on a background for puzzles, exploration,
  and mystery games.
- **Gameplay scenes** — simple side-view (platformer) or top-down movement with physics,
  obstacles, and interactive hotspots.
- **Custom scenes** — write your own JavaScript for anything else: minigames, quizzes, puzzles, and
  more (built-in starter templates included).

Because scenes connect freely on the graph, you can build pure visual novels, branching adventures,
point-and-click mysteries, games with short action segments, or hybrids that combine all of these.

## How it works

1. **Story Graph** — your game is a canvas of scene nodes you connect together to control the flow.
2. **Assets** — upload your own images (backgrounds, characters, props) and audio (music, sound
   effects). Files are stored right inside your project.
3. **Variables** — track game state (numbers, text, true/false) to drive choices, branching, and
   logic.
4. **Play** — test your whole game at any time, with save slots while you're working on the desktop.

Your work auto-saves, and there's full undo/redo.

## Sharing your game

From the editor you can export your finished game:

- **Download Offline (`.zip`)** — a self-contained bundle that plays in any modern web browser. This
  is the file you upload to the **EggyJams web platform** to publish your game for everyone.
- **Download for Windows / Mac** — a standalone player so people can play your game without
  installing EggyJams.

---

## For developers

This folder is the EggyJams desktop app (an Electron + React + TypeScript project). It lives inside
the EggyJams monorepo; the repo **root** is the web platform and this folder is the desktop studio.
The sections below are for building and contributing to the app itself.

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20+ recommended)
- npm (comes with Node)

### Development

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

#### Scripts

| From `desktop-app/` | From repo root | Purpose |
|---------------------|----------------|---------|
| `npm run dev` | — | Vite only (browser at `http://localhost:5173`; limited without Electron APIs) |
| `npm run build` | `npm run desktop:build` | Production React + offline runner + Electron bundles |
| `npm run electron:dev` | `npm run desktop:dev` | Build Electron main, start Vite, open the app |
| `npm run dist` | `npm run desktop:dist` | Build the Linux AppImage (and host-OS installers) into `desktop-app/release/` |
| `npm run dist:win:zip` | `npm run desktop:dist:win` | Windows portable `.zip` |
| `npm run dist:mac` | `npm run desktop:dist:mac` | macOS `.dmg` |
| `npm run build:game-player:win` | `npm run desktop:shells:win` | Build the Windows player shell |
| `npm run build:game-player:mac` | `npm run desktop:shells:mac` | Build the macOS player shell |
| `npm run lint` | — | ESLint |

### Build installers

```bash
npm run desktop:dist        # from repo root  (artifacts in desktop-app/release/)
```

Packaged artifacts depend on the OS you build on. The released downloads use the version-less names
`EggyJams-windows.zip`, `EggyJams-mac.dmg`, and `EggyJams-linux.AppImage` (configured via
`artifactName` in `package.json`) so the website's download links stay stable across releases. The
macOS `.dmg` ships with an instructional background (`build/dmg-background.png`) that shows users how
to drag the app to Applications and get past the first-launch Gatekeeper warning. See
[electron-builder](https://www.electron.build/) for cross-compilation requirements.

Executable game exports rely on pre-built player shells in `game-player-shells/`. Build them first:

```bash
npm run desktop:shells:win   # build the Windows shell on Windows
npm run desktop:shells:mac   # build the macOS shell on macOS
```

### Project folder format

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

### Layout

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
