#!/usr/bin/env bash
# Frostpane theme installer (Linux / macOS).
# Usage:
#   bash install.sh                 # asks whether you want the optional blur layer
#   bash install.sh --blur          # blur, no question asked
#   bash install.sh --no-blur       # colours only, no question asked
#   curl -fsSL https://raw.githubusercontent.com/pocatrifork/frostpane/main/install.sh | bash
# Windows users: use install.ps1 instead (irm https://raw.githubusercontent.com/pocatrifork/frostpane/main/install.ps1 | iex).
set -euo pipefail

# Assets are fetched per file, so a branch install needs the ref too or it would
# mix this script with another branch's assets. FROSTPANE_REPO overrides both.
REF="${FROSTPANE_REF:-main}"
REPO="${FROSTPANE_REPO:-https://raw.githubusercontent.com/pocatrifork/frostpane/$REF}"
CUI_EXT="subframe7536.custom-ui-style"
THEME_DIRNAME="frostpane.frostpane-theme-2.2.0"

BLUR="${FROSTPANE_BLUR:-0}"
BLUR_SET=0
[ -n "${FROSTPANE_BLUR:-}" ] && BLUR_SET=1
for arg in "$@"; do
  case "$arg" in
    --blur) BLUR=1; BLUR_SET=1 ;;
    --no-blur) BLUR=0; BLUR_SET=1 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) printf 'unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

say(){ printf '\033[36m[frostpane]\033[0m %s\n' "$*"; }
ask_blur(){
  if [ "$BLUR_SET" = "1" ]; then return 0; fi
  # Probe the tty in a subshell: a failed redirect on `exec` would kill a
  # non-interactive shell outright, and -r alone lies about openability.
  if ! ( : </dev/tty ) 2>/dev/null; then return 0; fi   # scripted run: colours only
  say "Optional blur layer: frosts dropdowns, menus, the palette and notifications."
  say "It patches VS Code, so expect a one-time 'installation corrupt' banner."
  printf '\033[36m[frostpane]\033[0m Install it? [y/N] '
  reply=""
  read -r -t 60 reply < /dev/tty || true                 # never hang
  case "$reply" in [Yy]*) BLUR=1 ;; *) BLUR=0 ;; esac
  return 0
}
warn(){ printf '\033[33m[frostpane] WARN:\033[0m %s\n' "$*"; }
die(){ printf '\033[31m[frostpane] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# --- locate VS Code dirs (override with FROSTPANE_USER_DIR / FROSTPANE_EXT_DIR) ---
case "$(uname -s)" in
  Darwin) DEF_USER="$HOME/Library/Application Support/Code/User" ;;
  *)      DEF_USER="$HOME/.config/Code/User" ;;
esac
USER_DIR="${FROSTPANE_USER_DIR:-$DEF_USER}"
EXT_DIR="${FROSTPANE_EXT_DIR:-$HOME/.vscode/extensions}"
[ -d "$USER_DIR" ] || die "VS Code user dir not found: $USER_DIR (set FROSTPANE_USER_DIR)"
mkdir -p "$EXT_DIR"
CUI_DIR="$USER_DIR/custom-ui-style"

command -v python3 >/dev/null 2>&1 || die "python3 is required for the settings merge."

# --- resolve assets: local clone next to this script, else download ---
ask_blur

ASSETS="settings.frostpane.json
frostpane-theme/package.json
frostpane-theme/extension.js
frostpane-theme/palette.js
frostpane-theme/media/picker.html
frostpane-theme/themes/frostpane-color-theme.json"
if [ "$BLUR" = "1" ]; then
  ASSETS="$ASSETS
settings.frostpane.blur.json
scripts/menu-glass.js"
fi

SRC=""
if [ -n "${BASH_SOURCE:-}" ] && [ -f "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/installer/assets/settings.frostpane.json" ]; then
  SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/installer/assets"
  say "Using local assets: $SRC"
else
  SRC="$(mktemp -d)"
  say "Downloading assets from $REPO ..."
  # raw.githubusercontent caches each path for five minutes, so right after a
  # push the script and its assets can come from different revisions. A varying
  # query string sidesteps the edge cache and keeps the set consistent.
  CB="$(date +%s)"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    mkdir -p "$SRC/$(dirname "$f")"
    curl -fsSL "$REPO/installer/assets/$f?cb=$CB" -o "$SRC/$f" || die "download failed: $f"
  done <<< "$ASSETS"
fi

# --- 1. the theme extension (theme + colour picker; no app patching) ---
say "Installing Frostpane -> $EXT_DIR/$THEME_DIRNAME"
# Any earlier version has to go, or VSCode registers two themes both called
# "Frostpane" and the colorTheme setting resolves to whichever it saw first.
for old in "$EXT_DIR"/frostpane.frostpane-theme-*; do
  [ -e "$old" ] || continue
  [ "$(basename "$old")" = "$THEME_DIRNAME" ] || say "  removing older install: $(basename "$old")"
  rm -rf "$old"
done
# VSCode records the folder name of an uninstalled extension in .obsolete and
# then ignores any folder with that exact name, so reinstalling the same version
# would copy the files in and never load them.
OBS="$EXT_DIR/.obsolete"
if [ -f "$OBS" ]; then
  OBS="$OBS" python3 - <<'PYOBS'
import json, os
p = os.environ["OBS"]
try:
    d = json.load(open(p, encoding="utf-8"))
except Exception:
    d = None
if isinstance(d, dict):
    stale = [k for k in d if k.startswith("frostpane.frostpane-theme-")]
    for k in stale:
        del d[k]
    if stale:
        open(p, "w", encoding="utf-8").write(json.dumps(d, separators=(",", ":")))
        print("  cleared %d stale .obsolete entry(ies) so the install is seen" % len(stale))
PYOBS
fi

TGT="$EXT_DIR/$THEME_DIRNAME"
mkdir -p "$TGT/themes" "$TGT/media"
cp "$SRC/frostpane-theme/package.json" "$SRC/frostpane-theme/extension.js" "$SRC/frostpane-theme/palette.js" "$TGT/"
cp "$SRC/frostpane-theme/themes/frostpane-color-theme.json" "$TGT/themes/"
cp "$SRC/frostpane-theme/media/picker.html" "$TGT/media/"

# --- 2. the optional blur layer (this is the part that patches VSCode) ---
if [ "$BLUR" = "1" ]; then
  mkdir -p "$CUI_DIR"
  if command -v code >/dev/null 2>&1; then
    say "Installing Custom UI Style (required for blur) ..."
    code --install-extension "$CUI_EXT" --force >/dev/null || warn "could not install $CUI_EXT (install it manually)"
  else
    warn "'code' CLI not found - install the '$CUI_EXT' extension manually from the Marketplace."
  fi
  say "Copying blur script -> $CUI_DIR"
  cp "$SRC/scripts/menu-glass.js" "$CUI_DIR/"
else
  # Superseded by the extension; an old copy would keep injecting a picker.
  rm -f "$CUI_DIR/theme-customizer.js" "$CUI_DIR/panel-anim.js" "$CUI_DIR/menu-glass.js" 2>/dev/null || true
fi

# --- 3. merge settings (back up first) ---
SETTINGS="$USER_DIR/settings.json"
if [ -f "$SETTINGS" ]; then
  BK="$SETTINGS.frostpane-backup-$(date +%Y%m%d-%H%M%S)"
  cp "$SETTINGS" "$BK"; say "Backed up settings -> $BK"
fi
say "Merging Frostpane settings ..."
FRAG="$SRC/settings.frostpane.json" BLURFRAG="$SRC/settings.frostpane.blur.json" \
BLUR="$BLUR" CUI="$CUI_DIR" SET="$SETTINGS" python3 - <<'PY'
import json, os, sys
frag_path=os.environ["FRAG"]; settings=os.environ["SET"]
blur=os.environ["BLUR"]=="1"; blur_path=os.environ["BLURFRAG"]; cui=os.environ["CUI"]

def _strip(s, mode):
    # string-aware pass over JSONC; mode 'c' removes // and /* */ comments,
    # mode ',' removes trailing commas before } or ]. Strings are left untouched
    # so file:// URLs and commas inside values survive.
    out=[]; i=0; n=len(s); instr=False; esc=False
    while i<n:
        c=s[i]
        if instr:
            out.append(c)
            if esc: esc=False
            elif c=='\\': esc=True
            elif c=='"': instr=False
            i+=1; continue
        if c=='"': instr=True; out.append(c); i+=1; continue
        if mode=='c' and c=='/' and i+1<n and s[i+1]=='/':
            while i<n and s[i]!='\n': i+=1
            continue
        if mode=='c' and c=='/' and i+1<n and s[i+1]=='*':
            i+=2
            while i+1<n and not (s[i]=='*' and s[i+1]=='/'): i+=1
            i+=2; continue
        if mode==',' and c==',':
            j=i+1
            while j<n and s[j] in ' \t\r\n': j+=1
            if j<n and s[j] in '}]': i+=1; continue
        out.append(c); i+=1
    return ''.join(out)

def parse_jsonc(p):
    if not os.path.exists(p): return {}
    s=open(p,encoding="utf-8").read()
    if not s.strip(): return {}
    try: return json.loads(s)                 # fast path: already strict JSON
    except Exception: pass
    try: return json.loads(_strip(_strip(s,'c'),','))
    except Exception as e:
        sys.exit("Could not parse existing settings.json (%s). It was backed up; merge the fragment manually." % e)

cur=parse_jsonc(settings)
frag=json.load(open(frag_path,encoding="utf-8"))
cur.update(frag)
written=len(frag)

# The colours are derived by the extension now, so a block written by an older
# Frostpane would fight it. Other themes' overrides are left alone.
cc=cur.get("workbench.colorCustomizations")
if isinstance(cc,dict) and "[Frostpane]" in cc:
    del cc["[Frostpane]"]
    if not cc: cur.pop("workbench.colorCustomizations",None)
    print("  removed the [Frostpane] block an older version wrote (the extension derives it now)")

OURS=("theme-customizer.js","menu-glass.js","panel-anim.js")
def imports_are_ours():
    v=cur.get("custom-ui-style.external.imports")
    items=v if isinstance(v,list) else ([v] if isinstance(v,str) else [])
    return bool(items) and all(any(name in str(i) for name in OURS) for i in items)

if blur:
    bfrag=json.load(open(blur_path,encoding="utf-8"))
    bfrag["custom-ui-style.external.imports"]=["file://%s/menu-glass.js" % cui]
    cur.update(bfrag)
    written+=len(bfrag)
    print("  blur layer enabled (%d CSS rules)" % len(bfrag["custom-ui-style.stylesheet"]))
else:
    if imports_are_ours():
        cur.pop("custom-ui-style.stylesheet",None)
        cur.pop("custom-ui-style.external.imports",None)
        print("  removed the Custom UI Style keys an older Frostpane wrote")
    elif "custom-ui-style.stylesheet" in cur or "custom-ui-style.external.imports" in cur:
        print("  NOTE: custom-ui-style keys are present but are not Frostpane's - left untouched")

open(settings,"w",encoding="utf-8").write(json.dumps(cur,indent=2)+"\n")
print("  wrote %d keys" % written)
PY

say "Done."
if [ "$BLUR" = "1" ]; then
cat <<EOF

Next steps:
  1. Restart VS Code.
  2. Run 'Custom UI Style: Reload' (Ctrl+Shift+P) and confirm the restart.
     The blur layer patches the app, so VS Code shows an 'installation appears
     to be corrupt' banner - dismiss it with the gear, 'Don't show again'.
     It can come back after a VS Code update, which is the cost of the blur.
  3. Theme is set to 'Frostpane'; the picker button is on the status bar.
EOF
else
cat <<EOF

Next steps:
  1. Restart VS Code. That is it - nothing was patched, so there is no
     'installation appears to be corrupt' banner and nothing to redo after a
     VS Code update.
  2. Theme is set to 'Frostpane'; the picker button is on the status bar
     (or run 'Frostpane: Pick Colours').

  Want the frosted dropdowns, menus and palette back? Re-run with --blur.
  If a previous version left the '$CUI_EXT' extension installed, uninstall it
  and run 'Custom UI Style: Restore' - it re-patches the app after every
  VS Code update on its own.
EOF
fi
