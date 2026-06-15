#!/usr/bin/env bash
# Frostpane theme installer (Linux / macOS).
# Usage:
#   bash install.sh                 # from a cloned repo (uses local assets)
#   curl -fsSL https://raw.githubusercontent.com/pocatrifork/frostpane/main/install.sh | bash
# Windows users: use install.ps1 instead (irm https://raw.githubusercontent.com/pocatrifork/frostpane/main/install.ps1 | iex).
set -euo pipefail

REPO="${FROSTPANE_REPO:-https://raw.githubusercontent.com/pocatrifork/frostpane/main}"
EXT_VERSION="subframe7536.custom-ui-style"
THEME_DIRNAME="frostpane.frostpane-theme-1.0.0"

say(){ printf '\033[36m[frostpane]\033[0m %s\n' "$*"; }
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
mkdir -p "$CUI_DIR"

command -v python3 >/dev/null 2>&1 || die "python3 is required for the settings merge."

# --- resolve assets: local clone next to this script, else download ---
SRC=""
if [ -n "${BASH_SOURCE:-}" ] && [ -f "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/installer/assets/settings.frostpane.json" ]; then
  SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/installer/assets"
  say "Using local assets: $SRC"
else
  SRC="$(mktemp -d)"
  say "Downloading assets from $REPO ..."
  mkdir -p "$SRC/scripts" "$SRC/frostpane-theme/themes"
  for f in settings.frostpane.json scripts/menu-glass.js scripts/panel-anim.js scripts/theme-customizer.js \
           frostpane-theme/package.json frostpane-theme/themes/frostpane-color-theme.json; do
    curl -fsSL "$REPO/installer/assets/$f" -o "$SRC/$f" || die "download failed: $f"
  done
fi

# --- 1. Custom UI Style extension ---
if command -v code >/dev/null 2>&1; then
  say "Installing Custom UI Style extension ..."
  code --install-extension "$EXT_VERSION" --force >/dev/null || warn "could not install $EXT_VERSION (install it manually)"
else
  warn "'code' CLI not found — install the '$EXT_VERSION' extension manually from the Marketplace."
fi

# --- 2. Frostpane color theme (folder extension) ---
say "Installing Frostpane theme -> $EXT_DIR/$THEME_DIRNAME"
rm -rf "${EXT_DIR:?}/$THEME_DIRNAME"
mkdir -p "$EXT_DIR/$THEME_DIRNAME/themes"
cp "$SRC/frostpane-theme/package.json" "$EXT_DIR/$THEME_DIRNAME/"
cp "$SRC/frostpane-theme/themes/frostpane-color-theme.json" "$EXT_DIR/$THEME_DIRNAME/themes/"

# --- 3. injected scripts ---
say "Copying injected scripts -> $CUI_DIR"
cp "$SRC/scripts/menu-glass.js" "$SRC/scripts/panel-anim.js" "$SRC/scripts/theme-customizer.js" "$CUI_DIR/"

# --- 4. merge settings (back up first; compute external.imports) ---
SETTINGS="$USER_DIR/settings.json"
if [ -f "$SETTINGS" ]; then
  BK="$SETTINGS.frostpane-backup-$(date +%Y%m%d-%H%M%S)"
  cp "$SETTINGS" "$BK"; say "Backed up settings -> $BK"
fi
say "Merging Frostpane settings ..."
FRAG="$SRC/settings.frostpane.json" CUI="$CUI_DIR" SET="$SETTINGS" python3 - <<'PY'
import json, os, sys
frag_path=os.environ["FRAG"]; cui=os.environ["CUI"]; settings=os.environ["SET"]

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
imports=["file://%s/%s" % (cui, n) for n in ("menu-glass.js","panel-anim.js","theme-customizer.js")]
frag["custom-ui-style.external.imports"]=imports
cur.update(frag)
open(settings,"w",encoding="utf-8").write(json.dumps(cur,indent=2)+"\n")
print("  wrote %d keys; external.imports -> %s" % (len(frag), cui))
PY

say "Done."
cat <<EOF

Next steps:
  1. Restart VS Code.
  2. Run 'Custom UI Style: Reload' (Ctrl+Shift+P) and confirm the restart.
     (Custom UI Style patches the app; you may see an 'installation corrupt'
      banner once — that is expected, click the gear and 'Don't show again'.)
  3. Theme is set to 'Frostpane'; the customizer button is on the status bar.
  4. Fonts (optional, for the intended look): install 'IBM Plex Mono' and
     'FiraCode Nerd Font Mono'. Without them, fallbacks (Consolas/Courier) apply.
EOF
