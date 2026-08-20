# Frostpane

A dark colour theme for VS Code with two live knobs: an **accent colour** and a
**background colour**, picked from a button on the status bar and applied without
a reload.

That is the whole scope. Frostpane does not touch corner radii, spacing, blur,
animation or layout — VS Code owns its chrome, so UI changes upstream do not
break the theme.

It is two layers:

- **Frostpane** — the colour theme itself (syntax and workbench colours), shipped
  as a small bundled extension (forked from
  [Islands Dark](https://github.com/bwya77/vscode-dark-islands), MIT). It carries
  the static defaults, so it looks right on its own.
- **The colour layer** — one CSS block plus one injected script, delivered through
  the [Custom UI Style](https://marketplace.visualstudio.com/items?itemName=subframe7536.custom-ui-style)
  extension (`subframe7536.custom-ui-style`). This is what makes the two knobs
  live.

## How the two knobs work

The CSS block defines exactly two variables and maps them onto the `--vscode-*`
colour variables the workbench paints from:

| Variable | Drives |
|----------|--------|
| `--frostpane-accent` | buttons, badges, links, focus borders, selection, find matches, cursors, progress, modified-file marks |
| `--frostpane-bg` | editor, sidebar, panel, tabs, title bar, status bar, and — mixed lighter or darker — menus, widgets, quick input, the tab strip |

`theme-customizer.js` writes those two variables onto `<html>` when you pick a
colour and stores the pick in `localStorage` (globally, or per project folder).
Hovers and selections are white washes rather than fixed greys, so they keep the
hue of whatever background you choose.

The terminal is the one surface CSS cannot reach — xterm resolves its own
colours — so the script writes the accent and the background straight into each
live terminal instead.

## Requirements

- VS Code **desktop** (Custom UI Style patches the app, so it cannot work on
  vscode.dev / web).
- The **Custom UI Style** extension, for the live picker. Without it the theme
  still installs and works; the colours are just fixed at the defaults.

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

The installer: installs Custom UI Style, installs the Frostpane theme, copies
`theme-customizer.js` into `…/Code/User/custom-ui-style/`, and **merges** four
keys into your `settings.json` (backing it up first, keeping your other settings,
and computing the script path for your machine).

### After installing

1. Restart VS Code.
2. Run **`Custom UI Style: Reload`** (Ctrl/Cmd+Shift+P) and confirm the restart.
   Custom UI Style modifies the app; a one-time "installation corrupt" banner is
   expected — dismiss it (gear → "Don't show again").
3. The theme is set to **Frostpane**; the picker button sits on the status bar.

## What gets installed where

| Item | Location |
|------|----------|
| Frostpane theme extension | `<extensions>/frostpane.frostpane-theme-1.0.0/` |
| Injected script | `<user>/custom-ui-style/theme-customizer.js` |
| Settings (merged) | `<user>/settings.json` (backup: `settings.json.frostpane-backup-<ts>`) |

The four merged keys: `workbench.colorTheme`,
`terminal.integrated.minimumContrastRatio`, `custom-ui-style.stylesheet`,
`custom-ui-style.external.imports`. No fonts, no layout, no editor settings.

`<user>` = `%APPDATA%\Code\User` (Windows) · `~/.config/Code/User` (Linux) ·
`~/Library/Application Support/Code/User` (macOS). Override with
`FROSTPANE_USER_DIR` / `FROSTPANE_EXT_DIR`.

> **WSL → Windows VS Code:** run the **PowerShell** installer (it targets Windows
> paths and builds correct `file:///C:/…` script URLs). The bash installer targets
> native Linux/macOS VS Code.

## Uninstall

Reverts to the default VS Code theme (`Default Dark Modern`): removes the
Frostpane theme and script and the Frostpane settings keys (backing up
`settings.json` first; your other settings are kept, including
`workbench.colorCustomizations` blocks for other themes).

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
  settings.frostpane.json         the four settings keys, including the CSS block
  scripts/theme-customizer.js     the injected picker
  frostpane-theme/                the bundled colour-theme extension
theme-customizer.js               working copy of the script (dev)
```
