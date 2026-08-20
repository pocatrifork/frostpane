# Frostpane

A dark colour theme for VS Code with two live knobs — an **accent colour** and a
**background colour** — picked from a button on the status bar.

Frostpane does not touch corner radii, spacing, animation or layout. VS Code owns
its chrome, so UI changes upstream do not break the theme.

It comes in two layers, and the second one is optional:

| Layer | What it does | Patches VS Code? |
|-------|--------------|------------------|
| **Colours** (default) | The theme, the picker, and every workbench colour derived from your two picks | **No** |
| **Blur** (`--blur`) | Frosted glass on dropdowns, menus, the command palette, notifications and the top bar | **Yes** |

The colour layer is a plain extension writing plain settings, so there is no
"installation appears to be corrupt" banner and nothing to redo after a VS Code
update. Blur needs `backdrop-filter`, which only exists in injected CSS — see
[The blur layer](#the-blur-layer) for that trade.

## How the two knobs work

Two settings hold everything:

```jsonc
"frostpane.accent": "#6cb4ff",
"frostpane.background": "#181a1d"
```

The extension expands them into a `workbench.colorCustomizations["[Frostpane]"]`
block — 125 colour keys — and rewrites it whenever either setting changes.
Colour customizations apply instantly, so a pick lands without a reload.

| Knob | Drives |
|------|--------|
| `frostpane.accent` | buttons, badges, links, focus borders, selection, find matches, cursors, progress, modified-file marks, terminal selection |
| `frostpane.background` | editor, sidebar, panel, tabs, title bar, status bar, and — mixed lighter or darker — menus, widgets, quick input, the tab strip |

Three things fall out of deriving colours rather than injecting CSS:

- **Text on the accent picks itself.** A yellow accent gets dark button text, an
  indigo one gets white. CSS cannot do this — `color-contrast()` is not shipped.
- **Canvas-painted surfaces follow.** The terminal, minimap and overview ruler
  read theme colours directly, so they need no special handling.
- **The background is held dark.** A light pick is pulled back into the dark
  range, since every foreground colour in the theme assumes a dark canvas.

Picks are stored in your user settings by default. Choose **This project** in the
picker and they move to the project's `.vscode/settings.json` instead, while your
global pick keeps applying everywhere else.

## Requirements

- VS Code **1.75+** desktop.
- Nothing else for the colour layer. The blur layer additionally needs the
  [Custom UI Style](https://marketplace.visualstudio.com/items?itemName=subframe7536.custom-ui-style)
  extension (the installer installs it).

## Install

> The one-liners fetch assets from this repo. Installing from a branch? Set
> `FROSTPANE_REF` / `$env:FROSTPANE_REF` to the branch name, or the script and the
> assets come from different refs. Forking? Point the installer at your copy with
> `FROSTPANE_REPO` / `$env:FROSTPANE_REPO`. Running from a clone needs neither —
> local files are used when present.

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
bash install.sh                    # colours only
bash install.sh --blur             # colours + the frosted glass layer
```

The installer installs the Frostpane extension and merges two keys into your
`settings.json` (backing it up first and keeping your other settings). It also
clears anything an older Frostpane left behind: previous extension versions, the
old injected scripts, and the settings keys they used.

### After installing

Restart VS Code. The theme is set to **Frostpane** and the picker button sits on
the status bar — or run **`Frostpane: Pick Colours`**.

> **WSL → Windows VS Code:** run the **PowerShell** installer; it targets Windows
> paths. From a WSL shell that means
> `powershell.exe -ExecutionPolicy Bypass -File ./install.ps1`, because scripts on
> the `\\wsl.localhost\…` share are unsigned and blocked by default. The bash
> installer targets native Linux/macOS VS Code.

## The blur layer

Opt in with `--blur` (bash) / `-Blur` (PowerShell), or `FROSTPANE_BLUR=1` when
piping to a shell. Eight surfaces are frosted:

- the command palette and quick input
- menus and context menus, including the editor right-click menu
- select dropdowns
- notification toasts and the notification centre
- the find widget
- the debug toolbar
- the diff/modal editor
- the command centre and agent pill in the top bar

Each one gets a translucent background plus `backdrop-filter`, and a companion
rule that keeps its own children from painting over the frost — a notification
centre whose header and list rows stay opaque is a frosted panel you cannot see.
The find widget's input keeps a dark wash so the field still reads against glass.
Nothing here sets radii, borders or geometry.

Translucency is read from the active `--vscode-*` colour, so the frost follows
whatever the picker last derived.

**The trade.** Blur exists only as injected CSS, which means Custom UI Style, which
means patched app files. `product.json` carries a checksum for each file it
patches, so VS Code shows an "installation appears to be corrupt" banner —
dismissible, but it can return after a VS Code update, since the extension
re-patches the app on its own. If that annoys you, re-run the installer without
`--blur` and uninstall Custom UI Style.

Two notes on what blur can and cannot do:

- The editor right-click menu renders in a shadow root that stylesheets cannot
  reach, so it is frosted by `menu-glass.js`, the one injected script.
- The top bar has nothing behind it but a flat colour, so there is no blur to
  see. Those two pills get the frosted white fill that produced the look.

## What gets installed where

| Item | Location |
|------|----------|
| Frostpane extension (theme + picker) | `<extensions>/frostpane.frostpane-theme-2.0.0/` |
| Blur script (`--blur` only) | `<user>/custom-ui-style/menu-glass.js` |
| Settings (merged) | `<user>/settings.json` (backup: `settings.json.frostpane-backup-<ts>`) |

Merged keys: `workbench.colorTheme` and
`terminal.integrated.minimumContrastRatio` (so VS Code does not rewrite terminal
colours for contrast). With `--blur`, also `custom-ui-style.stylesheet` and
`custom-ui-style.external.imports`. The extension owns
`workbench.colorCustomizations["[Frostpane]"]` and writes it only once you pick
something other than the defaults.

`<user>` = `%APPDATA%\Code\User` (Windows) · `~/.config/Code/User` (Linux) ·
`~/Library/Application Support/Code/User` (macOS). Override with
`FROSTPANE_USER_DIR` / `FROSTPANE_EXT_DIR`.

## Uninstall

Reverts to `Default Dark Modern`, removes the extension, the blur script and
every Frostpane settings key — backing up `settings.json` first and keeping your
other settings, including `workbench.colorCustomizations` blocks for other
themes.

**Windows:**
```powershell
irm https://raw.githubusercontent.com/pocatrifork/frostpane/main/uninstall.ps1 | iex
```
**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/pocatrifork/frostpane/main/uninstall.sh | bash
```

If you had installed the blur layer, also uninstall the Custom UI Style extension
and run **`Custom UI Style: Restore`** to unpatch VS Code — the uninstaller cannot
do that for you, and left installed it keeps re-patching after updates.

## Repo layout

```
install.ps1 / install.sh          installers (entry points)
installer/assets/
  settings.frostpane.json         the two merged settings keys
  settings.frostpane.blur.json    the optional blur stylesheet
  scripts/menu-glass.js           blur for the shadow-DOM editor menu
  frostpane-theme/
    package.json                  theme + picker + the two settings
    extension.js                  picker, status bar item, settings sync
    palette.js                    two colours -> 125 colour keys
    media/picker.html             the picker webview
    themes/                       the colour theme itself
test/extension.test.js            run with: node test/extension.test.js
```

The theme is a fork of [Islands Dark](https://github.com/bwya77/vscode-dark-islands)
(bwya77, MIT).
