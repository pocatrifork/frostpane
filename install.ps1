# Frostpane theme installer (Windows).
# Usage:
#   irm https://raw.githubusercontent.com/pocatrifork/frostpane/main/install.ps1 | iex
#   .\install.ps1            # from a cloned repo (uses local assets)
$ErrorActionPreference = "Stop"

$Repo        = if ($env:FROSTPANE_REPO) { $env:FROSTPANE_REPO } else { "https://raw.githubusercontent.com/pocatrifork/frostpane/main" }
$Ext         = "subframe7536.custom-ui-style"
$ThemeDir    = "frostpane.frostpane-theme-1.0.0"

function Say  ($m){ Write-Host "[frostpane] $m"      -ForegroundColor Cyan }
function Warn ($m){ Write-Host "[frostpane] WARN: $m" -ForegroundColor Yellow }
function Die  ($m){ Write-Host "[frostpane] ERROR: $m" -ForegroundColor Red; exit 1 }

# --- VS Code dirs (override with $env:FROSTPANE_USER_DIR / FROSTPANE_EXT_DIR) ---
$UserDir = if ($env:FROSTPANE_USER_DIR) { $env:FROSTPANE_USER_DIR } else { Join-Path $env:APPDATA "Code\User" }
$ExtDir  = if ($env:FROSTPANE_EXT_DIR)  { $env:FROSTPANE_EXT_DIR }  else { Join-Path $env:USERPROFILE ".vscode\extensions" }
if (-not (Test-Path $UserDir)) { Die "VS Code user dir not found: $UserDir (set FROSTPANE_USER_DIR)" }
$CuiDir = Join-Path $UserDir "custom-ui-style"
New-Item -ItemType Directory -Force -Path $CuiDir, $ExtDir | Out-Null

# --- resolve assets: local clone next to this script, else download ---
$local = $null
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "installer\assets\settings.frostpane.json"))) {
  $local = Join-Path $PSScriptRoot "installer\assets"; Say "Using local assets: $local"
}
$Src = if ($local) { $local } else { Join-Path ([System.IO.Path]::GetTempPath()) ("frostpane-" + [guid]::NewGuid().ToString("N")) }
if (-not $local) {
  Say "Downloading assets from $Repo ..."
  $files = @("settings.frostpane.json","scripts/theme-customizer.js",
             "frostpane-theme/package.json","frostpane-theme/themes/frostpane-color-theme.json")
  foreach ($f in $files) {
    $dst = Join-Path $Src ($f -replace '/','\')
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    irm "$Repo/installer/assets/$f" -OutFile $dst
  }
}

# --- 1. Custom UI Style extension ---
if (Get-Command code -ErrorAction SilentlyContinue) {
  Say "Installing Custom UI Style extension ..."
  & code --install-extension $Ext --force | Out-Null
} else {
  Warn "'code' CLI not found - install the '$Ext' extension manually from the Marketplace."
}

# --- 2. Frostpane color theme (folder extension) ---
$themeTarget = Join-Path $ExtDir $ThemeDir
Say "Installing Frostpane theme -> $themeTarget"
if (Test-Path $themeTarget) { Remove-Item -Recurse -Force $themeTarget }
New-Item -ItemType Directory -Force -Path (Join-Path $themeTarget "themes") | Out-Null
Copy-Item (Join-Path $Src "frostpane-theme\package.json") $themeTarget
Copy-Item (Join-Path $Src "frostpane-theme\themes\frostpane-color-theme.json") (Join-Path $themeTarget "themes")

# --- 3. injected script ---
Say "Copying injected script -> $CuiDir"
Copy-Item (Join-Path $Src "scripts\theme-customizer.js") $CuiDir

# --- 4. merge settings (back up first; compute external.imports) ---
$settings = Join-Path $UserDir "settings.json"
if (Test-Path $settings) {
  $bk = "$settings.frostpane-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss")
  Copy-Item $settings $bk; Say "Backed up settings -> $bk"
}
Say "Merging Frostpane settings ..."
# string-aware JSONC strip: leaves string contents (file:// URLs, commas in
# values) untouched. mode 'c' = drop // and /* */ comments; mode ',' = drop
# trailing commas before } or ].
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
  try { return (Strip-Jsonc (Strip-Jsonc $t 'c') ',') | ConvertFrom-Json } catch { Die "Could not parse existing settings.json ($_). It was backed up; merge the fragment manually." }
}
$cur  = ConvertFrom-Jsonc $settings
$frag = Get-Content -Raw (Join-Path $Src "settings.frostpane.json") | ConvertFrom-Json
$imports = @("file:///" + ((Join-Path $CuiDir "theme-customizer.js") -replace '\\','/'))
$frag.'custom-ui-style.external.imports' = $imports
foreach ($p in $frag.PSObject.Properties) {
  $cur | Add-Member -Force -NotePropertyName $p.Name -NotePropertyValue $p.Value
}
# Frostpane no longer ships a colorCustomizations block (the theme extension
# carries the static colours now), so drop a stale one left by an older install
# while leaving any other theme's overrides alone.
$cc = $cur.'workbench.colorCustomizations'
if ($cc -and ($cc.PSObject.Properties.Name -contains '[Frostpane]')) {
  $cc.PSObject.Properties.Remove('[Frostpane]')
  if (-not $cc.PSObject.Properties.Name) { $cur.PSObject.Properties.Remove('workbench.colorCustomizations') }
  Say "  removed the stale [Frostpane] colorCustomizations block"
}
($cur | ConvertTo-Json -Depth 100) | Set-Content -Encoding UTF8 $settings
Say ("  wrote {0} keys; external.imports -> {1}" -f $frag.PSObject.Properties.Count, $CuiDir)

Say "Done."
@"

Next steps:
  1. Restart VS Code.
  2. Run 'Custom UI Style: Reload' (Ctrl+Shift+P) and confirm the restart.
     (Custom UI Style patches the app; an 'installation corrupt' banner may
      appear once - that is expected, click the gear and 'Don't show again'.)
  3. Theme is set to 'Frostpane'; the customizer button is on the status bar.
"@ | Write-Host
