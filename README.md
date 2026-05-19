# GTA 5 RP Redux Launcher

A Windows desktop launcher that lets users browse a shared online catalog of GTA 5 RP reduxes (graphics presets, mods, ENBs, etc.) and install or revert them in one click.

![tech](https://img.shields.io/badge/Electron-39-blue)
![tech](https://img.shields.io/badge/React-19-blue)
![tech](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- **Card-based UI** with a dark theme and an in-app accent-color picker (presets + custom HEX).
- **Online catalog** — categories, reduxes, descriptions and cover images are read from a public GitHub repository (`YWaiKa/gta5rp-redux-launcher-data`). Every user sees the same thing without any backend server.
- **One-click install** — downloads the redux `.zip` from a GitHub Release, extracts it into the GTA folder at a configurable subpath.
- **Reversible installs** — every replaced file is renamed to `<file>.reduxbak` before being overwritten. The *Revert* button deletes our additions and restores the originals.
- **Installed list** with revert buttons.
- **Admin panel** for the catalog owner — log in with a GitHub Personal Access Token, create categories, upload reduxes (+ cover + description), set their default install target. The launcher uploads the asset to GitHub Releases and patches `data.json` so other users immediately see the new entry.
- **Offline-friendly** — last fetched catalog is cached locally.

## How the backend works (no paid services)

- `data.json` lives in `YWaiKa/gta5rp-redux-launcher-data` and is served from `raw.githubusercontent.com`. The launcher reads it anonymously, so end-users don't need GitHub at all.
- Each published redux gets its own GitHub Release on that data repo. The `.zip` and `cover.png` are uploaded as release assets — GitHub Releases storage is effectively unlimited and free.
- Only the admin (you) needs a GitHub PAT, and the token is stored locally on your machine, never shipped to other users.

## Project structure

```
src/
  main/         Electron main process — store, installer, GitHub admin
  preload/      Context-isolated bridge exposing window.api to the renderer
  renderer/     React UI (cards, sidebar, settings, admin modal)
  shared/       Types + IPC channel names shared by main and renderer
build/
electron-builder.yml   Windows installer + portable build configuration
electron.vite.config.ts
```

## Development

```bash
npm install
npm run dev          # launches the app with HMR
npm run typecheck
npm run lint
```

## Building a Windows installer

```bash
npm run build:win
```

The output is written to `dist/`. The default electron-builder configuration produces an NSIS installer (`.exe`).

## Configuration

On first launch the user is asked to pick the GTA V root folder (the one containing `GTA5.exe`). All install paths in `data.json` are interpreted relative to this folder.

The default backend repo is `YWaiKa/gta5rp-redux-launcher-data`. It can be changed at any time in **Settings → Backend repository**.

## License

MIT
