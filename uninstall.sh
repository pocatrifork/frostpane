#!/usr/bin/env bash
# Frostpane uninstaller (Linux / macOS) — reverts to the default VS Code theme.
#   bash uninstall.sh   |   curl -fsSL https://raw.githubusercontent.com/pocatrifork/frostpane/main/uninstall.sh | bash
set -euo pipefail

THEME_DIRNAME="frostpane.frostpane-theme-1.0.0"
DEFAULT_THEME="Default Dark Modern"

say(){ printf '\033[36m[frostpane]\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m[frostpane] WARN:\033[0m %s\n' "$*"; }
die(){ printf '\033[31m[frostpane] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

case "$(uname -s)" in
  Darwin) DEF_USER="$HOME/Library/Application Support/Code/User" ;;
  *)      DEF_USER="$HOME/.config/Code/User" ;;
esac
USER_DIR="${FROSTPANE_USER_DIR:-$DEF_USER}"
EXT_DIR="${FROSTPANE_EXT_DIR:-$HOME/.vscode/extensions}"
command -v python3 >/dev/null 2>&1 || die "python3 is required to edit settings."

# 1. theme extension
if [ -d "$EXT_DIR/$THEME_DIRNAME" ]; then
  rm -rf "${EXT_DIR:?}/$THEME_DIRNAME"; say "Removed theme extension."
fi
# 2. injected scripts
CUI="$USER_DIR/custom-ui-style"
for s in menu-glass.js panel-anim.js theme-customizer.js; do rm -f "$CUI/$s"; done
[ -d "$CUI" ] && rmdir "$CUI" 2>/dev/null || true
say "Removed injected scripts."
# 3. settings
SETTINGS="$USER_DIR/settings.json"
if [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.frostpane-uninstall-$(date +%Y%m%d-%H%M%S)"
  DEFTHEME="$DEFAULT_THEME" SET="$SETTINGS" python3 - <<'PY'
import json, os, sys
settings=os.environ["SET"]; deftheme=os.environ["DEFTHEME"]
MANAGED=["workbench.colorCustomizations","window.titleBarStyle","editor.fontFamily",
 "editor.fontSize","terminal.integrated.fontFamily","terminal.integrated.gpuAcceleration",
 "editor.lineHeight","breadcrumbs.enabled","workbench.tree.indent",
 "workbench.tree.renderIndentGuides","editor.minimap.showSlider","editor.minimap.enabled",
 "workbench.iconTheme","workbench.activityBar.location",
 "custom-ui-style.stylesheet","custom-ui-style.external.imports"]

def _strip(s, mode):
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

s=open(settings,encoding="utf-8").read()
try: d=json.loads(s) if s.strip() else {}
except Exception:
    try: d=json.loads(_strip(_strip(s,'c'),','))
    except Exception as e: sys.exit("Could not parse settings.json (%s); it was backed up." % e)
for k in MANAGED: d.pop(k, None)
d["workbench.colorTheme"]=deftheme
open(settings,"w",encoding="utf-8").write(json.dumps(d,indent=2)+"\n")
print("  reset colorTheme -> %s; removed %d Frostpane keys" % (deftheme,len(MANAGED)))
PY
  say "Settings reverted (backup written)."
fi

say "Done."
cat <<EOF

To fully remove the glass layer (Custom UI Style patches the app):
  1. Run 'Custom UI Style: Reload' so the injected CSS/scripts drop, OR
     disable/uninstall the 'subframe7536.custom-ui-style' extension and run
     'Custom UI Style: Restore' (then reload) to unpatch VS Code.
  2. Restart VS Code. You are back on '$DEFAULT_THEME'.
EOF
