# Frostpane uninstaller (Windows) — reverts to the default VS Code theme.
#   irm https://raw.githubusercontent.com/pocatrifork/frostpane/main/uninstall.ps1 | iex
$ErrorActionPreference = "Stop"
$ThemeGlob = "frostpane.frostpane-theme-*"
$DefaultTheme  = "Default Dark Modern"

function Say ($m){ Write-Host "[frostpane] $m" -ForegroundColor Cyan }
function Die ($m){ Write-Host "[frostpane] ERROR: $m" -ForegroundColor Red; exit 1 }

function Strip-Jsonc([string]$s, [string]$mode) {
  $sb = [System.Text.StringBuilder]::new(); $i = 0; $n = $s.Length; $instr = $false; $esc = $false
  while ($i -lt $n) {
    $c = $s[$i]
    if ($instr) {
      [void]$sb.Append($c)
      if ($esc) { $esc = $false } elseif ($c -eq [char]92) { $esc = $true } elseif ($c -eq [char]34) { $instr = $false }
      $i++; continue
    }
    if ($c -eq [char]34) { $instr = $true; [void]$sb.Append($c); $i++; continue }
    if ($mode -eq 'c' -and $c -eq '/' -and $i+1 -lt $n -and $s[$i+1] -eq '/') { while ($i -lt $n -and $s[$i] -ne "`n") { $i++ }; continue }
    if ($mode -eq 'c' -and $c -eq '/' -and $i+1 -lt $n -and $s[$i+1] -eq '*') { $i += 2; while ($i+1 -lt $n -and -not ($s[$i] -eq '*' -and $s[$i+1] -eq '/')) { $i++ }; $i += 2; continue }
    if ($mode -eq ',' -and $c -eq ',') {
      $j = $i+1; while ($j -lt $n -and " `t`r`n".Contains([string]$s[$j])) { $j++ }
      if ($j -lt $n -and ($s[$j] -eq '}' -or $s[$j] -eq ']')) { $i++; continue }
    }
    [void]$sb.Append($c); $i++
  }
  return $sb.ToString()
}
function ConvertFrom-Jsonc($p) {
  if (-not (Test-Path $p)) { return [pscustomobject]@{} }
  $t = Get-Content -Raw $p
  if (-not $t -or -not $t.Trim()) { return [pscustomobject]@{} }
  try { return $t | ConvertFrom-Json } catch {}
  try { return (Strip-Jsonc (Strip-Jsonc $t 'c') ',') | ConvertFrom-Json } catch { Die "Could not parse settings.json ($_); it was backed up." }
}

$UserDir = if ($env:FROSTPANE_USER_DIR) { $env:FROSTPANE_USER_DIR } else { Join-Path $env:APPDATA "Code\User" }
$ExtDir  = if ($env:FROSTPANE_EXT_DIR)  { $env:FROSTPANE_EXT_DIR }  else { Join-Path $env:USERPROFILE ".vscode\extensions" }

# 1. theme extension (any version)
Get-ChildItem $ExtDir -Directory -Filter $ThemeGlob -ErrorAction SilentlyContinue | ForEach-Object {
  Remove-Item -Recurse -Force $_.FullName; Say "Removed $($_.Name)."
}
# 2. injected scripts
$cui = Join-Path $UserDir "custom-ui-style"
# menu-glass.js is the blur layer and frostpane-popup.js the colour popup;
# the other two are only shipped by older versions
foreach ($s in "menu-glass.js","frostpane-popup.js","theme-customizer.js","panel-anim.js") {
  $p = Join-Path $cui $s; if (Test-Path $p) { Remove-Item -Force $p }
}
if ((Test-Path $cui) -and -not (Get-ChildItem $cui -Force)) { Remove-Item -Force $cui }
Say "Removed injected scripts."
# 3. settings
$settings = Join-Path $UserDir "settings.json"
if (Test-Path $settings) {
  Copy-Item $settings ("$settings.frostpane-uninstall-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  # Current keys first, then the ones older Frostpane versions also wrote, so an
  # uninstall from any version leaves nothing behind.
  $managed = @("terminal.integrated.minimumContrastRatio",
    "frostpane.accent","frostpane.background","frostpane.statusBarButton",
    "custom-ui-style.stylesheet","custom-ui-style.external.imports",
    "window.titleBarStyle","editor.fontFamily",
    "editor.fontSize","terminal.integrated.fontFamily","terminal.integrated.gpuAcceleration",
    "editor.lineHeight","breadcrumbs.enabled","workbench.tree.indent",
    "workbench.tree.renderIndentGuides","editor.minimap.showSlider","editor.minimap.enabled",
    "workbench.iconTheme","workbench.activityBar.location")
  $d = ConvertFrom-Jsonc $settings
  foreach ($k in $managed) { if ($d.PSObject.Properties[$k]) { $d.PSObject.Properties.Remove($k) } }
  # Only our own scoped block goes; overrides for other themes stay.
  $cc = $d.'workbench.colorCustomizations'
  if ($cc -and ($cc.PSObject.Properties.Name -contains '[Frostpane]')) {
    $cc.PSObject.Properties.Remove('[Frostpane]')
    if (-not $cc.PSObject.Properties.Name) { $d.PSObject.Properties.Remove('workbench.colorCustomizations') }
  }
  $d | Add-Member -Force -NotePropertyName "workbench.colorTheme" -NotePropertyValue $DefaultTheme
  ($d | ConvertTo-Json -Depth 100) | Set-Content -Encoding UTF8 $settings
  Say "Settings reverted -> '$DefaultTheme' (backup written)."
}

Say "Done."
@"

To fully remove the injected layer (Custom UI Style patches the app):
  1. Run 'Custom UI Style: Reload', OR disable/uninstall the
     'subframe7536.custom-ui-style' extension and run 'Custom UI Style: Restore',
     then reload to unpatch VS Code.
  2. Restart VS Code. You are back on '$DefaultTheme'.

Project-scoped picks live in each project's .vscode\settings.json; remove
'frostpane.accent' / 'frostpane.background' there if you used 'This project'.
"@ | Write-Host
