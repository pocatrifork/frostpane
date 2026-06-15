# Frostpane

A frosted-glass dark theme for VS Code: translucent panels, animated chrome, a
blue accent, and an in-workbench customizer for the accent + background colour.

It is two layers:

- **Frostpane** — the base colour theme (syntax/token colours), shipped as a small
  bundled extension (forked from [Islands Dark](https://github.com/bwya77/vscode-dark-islands), MIT).
- **The glass layer** — CSS + three injected scripts delivered through the
  [Custom UI Style](https://marketplace.visualstudio.com/items?itemName=subframe7536.custom-ui-style)
  extension (`subframe7536.custom-ui-style`).

## Requirements

- VS Code **desktop** (Custom UI Style patches the app, so it cannot work on vscode.dev / web).
- The **Custom UI Style** extension (the installer installs it).
- Optional fonts for the intended look: **IBM Plex Mono** (editor) and
  **FiraCode Nerd Font Mono** (terminal). Fallbacks (Consolas / Courier) apply otherwise.

## Install

> The one-liners fetch assets from this repo. Forking? Point the installer at
> your copy with `FROSTPANE_REPO` (bash) / `$env:FROSTPANE_REPO` (PowerShell),
> or just run from a clone — local files are used when present.

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/pocatrifork/frostpane/main/install.ps1 | iex
```

**Linux / macOS (bash):**
```bash
curl -fsSL https://raw.githubusercontent.com/pocatrifork/frostpane/main/install.sh | bash
```

**From a clone (either OS):**
```bash
git clone https://github.com/pocatrifork/frostpane && cd frostpane
bash install.sh        # or:  .\install.ps1  on Windows
```

The installer: installs Custom UI Style, installs the Frostpane theme, copies the
three scripts into `…/Code/User/custom-ui-style/`, and **merges** the theme
settings into your `settings.json` (backing it up first, keeping your other
settings, and computing the script paths for your machine).

### After installing

1. Restart VS Code.
2. Run **`Custom UI Style: Reload`** (Ctrl/Cmd+Shift+P) and confirm the restart.
   Custom UI Style modifies the app; a one-time "installation corrupt" banner is
   expected — dismiss it (gear → "Don't show again").
3. The theme is set to **Frostpane**; the customizer button sits on the status bar.

## What gets installed where

| Item | Location |
|------|----------|
| Frostpane theme extension | `<extensions>/frostpane.frostpane-theme-1.0.0/` |
| Injected scripts | `<user>/custom-ui-style/{menu-glass,panel-anim,theme-customizer}.js` |
| Settings (merged) | `<user>/settings.json` (backup: `settings.json.frostpane-backup-<ts>`) |

`<user>` = `%APPDATA%\Code\User` (Windows) · `~/.config/Code/User` (Linux) ·
`~/Library/Application Support/Code/User` (macOS). Override with
`FROSTPANE_USER_DIR` / `FROSTPANE_EXT_DIR`.

> **WSL → Windows VS Code:** run the **PowerShell** installer (it targets Windows
> paths and builds correct `file:///C:/…` script URLs). The bash installer targets
> native Linux/macOS VS Code.

## Uninstall

Reverts to the default VS Code theme (`Default Dark Modern`): removes the
Frostpane theme + scripts and the Frostpane settings keys (backing up
`settings.json` first; your other settings are kept).

**Windows:**
```powershell
irm https://raw.githubusercontent.com/pocatrifork/frostpane/main/uninstall.ps1 | iex
```
**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/pocatrifork/frostpane/main/uninstall.sh | bash
```

Then run **`Custom UI Style: Restore`** (or disable/uninstall the extension) and
reload to unpatch VS Code.

## Repo layout

```
install.ps1 / install.sh          installers (entry points)
installer/assets/
  settings.frostpane.json         theme-only settings fragment (merged in)
  scripts/*.js                    the three injected scripts
  frostpane-theme/                the bundled colour-theme extension
settings.snapshot.json            full working settings snapshot (dev reference)
*.js                              working copies of the scripts (dev)
```
