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
| `frostpane.background` | every surface, through the three tones below |

### Three tones

Your pick lands on the windows — the surfaces you work in — and everything else
steps up from there, so a chosen background reads as depth rather than one flat
wash:

| Tone | | Surfaces |
|------|--|----------|
| **window** | your pick, exactly | editor, sidebar, panel, terminal, breadcrumbs, active tab |
| **chrome** | +5% white | title bar, status bar, activity bar, tab strip, inactive tabs |
| **elevated** | +8% again | menus, widgets, quick input, dropdowns, notifications |

Lifting the chrome rather than darkening the windows is deliberate: a near-black
pick has no room left to go darker, so the separation would vanish exactly where
you most want it.

The active tab carries the window colour, so it reads as the opening into the
editor below it, and its label brightens. There is no accent line on top — the
whole tab is the indicator.

### Changing them

Click **Frostpane** on the status bar, or run **`Frostpane: Pick Colours`**. A
popup offers accent, background, scope and reset; choosing accent or background
lists every preset **with its colour swatch** — `QuickPickItem.iconPath` takes a
generated one-rect SVG per colour, written once into the extension's storage.

**Arrow through the list and the workbench repaints as you go.** Applying *is*
the preview, since these are only settings — Enter keeps the colour, Escape puts
back the one you started with, and `Custom hex...` takes anything you type.

Prefer swatches? **`Frostpane: Open Grid Picker`** is the same thing as a tab
with a colour grid and a native colour input. Its background swatches are drawn
*brighter than they apply*, because a grid of near-black squares is unreadable.

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

One command, either platform. It asks whether you want the optional blur layer.

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
bash install.sh                    # or:  .\install.ps1  on Windows
```

To skip the question — in a script, or because you already know — pass `--blur` /
`--no-blur` (bash) or `-Blur` / `-NoBlur` (PowerShell), or set `FROSTPANE_BLUR` to
`1` or `0`. A non-interactive run never prompts and installs colours only.

The installer installs the Frostpane extension and merges two keys into your
`settings.json` (backing it up first and keeping your other settings). It also
clears anything an older Frostpane left behind: previous extension versions, the
old injected scripts, the settings keys they used, and any stale `.obsolete`
entry that would otherwise make VS Code ignore the new install.

> Installing from a branch? Set `FROSTPANE_REF` / `$env:FROSTPANE_REF` to the
> branch name, or the script and the assets come from different refs. Forking?
> Point the installer at your copy with `FROSTPANE_REPO` / `$env:FROSTPANE_REPO`.
> Running from a clone needs neither — local files are used when present.

### After installing

Restart VS Code. The theme is set to **Frostpane** and the picker button sits on
the status bar — or run **`Frostpane: Pick Colours`**.

> **WSL → Windows VS Code:** run the **PowerShell** installer; it targets Windows
> paths. From a WSL shell that means
> `powershell.exe -ExecutionPolicy Bypass -File ./install.ps1`, because scripts on
> the `\\wsl.localhost\…` share are unsigned and blocked by default. The bash
> installer targets native Linux/macOS VS Code.

### Remotes

The extension is declared `"extensionKind": ["ui"]`, so it runs only on the local
side and VS Code never offers to install it into WSL, SSH or a container. Install
it once locally and every remote window is themed.

The remote indicator itself (`WSL: Ubuntu` in the status bar) ships as a filled
block in the accent colour, which reads like a warning badge. Frostpane sets
`statusBarItem.remoteBackground` transparent so it sits flat on the status bar.

## The blur layer

Answer yes when the installer asks, or pass `--blur` / `-Blur` up front. Seven
surfaces are frosted:

- the command palette and quick input
- menus and context menus, including the editor right-click menu
- select dropdowns
- notification toasts and the notification centre
- the find widget
- the debug toolbar
- the diff/modal editor

The layer does two things and nothing else: it frosts a floating surface, and it
clears the background off children that **span** that surface and would hide the
frost — a notification centre whose header and list rows stay opaque is a frosted
panel you cannot see. Inputs, buttons and rows are not spanning children, so they
keep the theme's own colours. No radii, borders, shadows or geometry.

Translucency is read from the active `--vscode-*` colour, so the frost follows
whatever the picker last derived.

Things that stay exactly as the theme paints them, on purpose: the title bar and
the command centre. Nothing sits behind them to blur, so there is no frost to
add — pressing the command centre opens the quick input, and *that* is frosted.

**The trade.** Blur exists only as injected CSS, which means Custom UI Style, which
means patched app files. `product.json` carries a checksum for each file it
patches, so VS Code shows an "installation appears to be corrupt" banner —
dismissible, but it can return after a VS Code update, since the extension
re-patches the app on its own. If that annoys you, re-run the installer without
`--blur` and uninstall Custom UI Style.

Two limits worth knowing:

- The editor right-click menu renders in a shadow root that stylesheets cannot
  reach, so it is frosted by `menu-glass.js`, the one injected script.
- **Submenus are not frosted.** A submenu is a descendant of the menu it opens
  from, and `backdrop-filter` makes that ancestor a *backdrop root* — a nested
  blur has nothing left to sample, and past the parent's edge there is nothing
  there at all. Submenus keep the theme's opaque menu colour instead.

## What gets installed where

| Item | Location |
|------|----------|
| Frostpane extension (theme + picker) | `<extensions>/frostpane.frostpane-theme-2.1.0/` |
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

## The syntax palette

The theme is authored here — 343 workbench colours and 60 token rules, all from
one 13-colour syntax palette. It leans cool, with a single warm tone reserved for
escapes and regex so they stand out inside a string:

| Role | | Role | |
|------|--|------|--|
| comment | `#6b7480` | tag | `#7fb3ff` |
| string | `#8fd6a9` | attribute | `#b3a0ff` |
| number, constant | `#7fd1c8` | keyword, storage | `#9a8cff` |
| type, class, namespace | `#5ec8d8` | function, method | `#74b1f0` |
| variable | `#c8cdd6` | property, parameter | `#a9b4c4` |
| operator, punctuation | `#8b93a1` | escape, regex | `#e8c07d` |
| invalid, deleted | `#ff6b7a` | | |

The 125 workbench keys `palette.js` derives are written into the theme file too,
so the static theme and a fresh pick at the defaults are byte-identical.
