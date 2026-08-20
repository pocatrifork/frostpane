<#
  Frostpane theme installer (Windows).
    irm https://raw.githubusercontent.com/pocatrifork/frostpane/main/install.ps1 | iex
    .\install.ps1              # colours only - VS Code is never patched
    .\install.ps1 -Blur        # also install the optional frosted-glass layer
  Piping to iex cannot pass -Blur, so set $env:FROSTPANE_BLUR = '1' instead.
#>
param([switch]$Blur)
$ErrorActionPreference = "Stop"

$Repo    = if ($env:FROSTPANE_REPO) { $env:FROSTPANE_REPO } else { "https://raw.githubusercontent.com/pocatrifork/frostpane/main" }
$CuiExt   = "subframe7536.custom-ui-style"
$ThemeDir = "frostpane.frostpane-theme-2.0.0"
$WantBlur = $Blur.IsPresent -or ($env:FROSTPANE_BLUR -eq '1')

function Say ($m)  { Write-Host "[frostpane] $m" -ForegroundColor Cyan }
function Warn($m)  { Write-Host "[frostpane] WARN: $m" -ForegroundColor Yellow }
function Die ($m)  { Write-Host "[frostpane] ERROR: $m" -ForegroundColor Red; exit 1 }

$UserDir = if ($env:FROSTPANE_USER_DIR) { $env:FROSTPANE_USER_DIR } else { Join-Path $env:APPDATA "Code\User" }
$ExtDir  = if ($env:FROSTPANE_EXT_DIR)  { $env:FROSTPANE_EXT_DIR }  else { Join-Path $env:USERPROFILE ".vscode\extensions" }
if (-not (Test-Path $UserDir)) { Die "VS Code user dir not found: $UserDir (set FROSTPANE_USER_DIR)" }
$CuiDir = Join-Path $UserDir "custom-ui-style"
New-Item -ItemType Directory -Force -Path $ExtDir | Out-Null

# --- resolve assets: local clone next to this script, else download ---
$assets = @("settings.frostpane.json","frostpane-theme/package.json","frostpane-theme/extension.js",
            "frostpane-theme/palette.js","frostpane-theme/media/picker.html",
            "frostpane-theme/themes/frostpane-color-theme.json")
if ($WantBlur) { $assets += @("settings.frostpane.blur.json","scripts/menu-glass.js") }

$local = $null
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "installer\assets\settings.frostpane.json"))) {
  $local = Join-Path $PSScriptRoot "installer\assets"; Say "Using local assets: $local"
}
$Src = if ($local) { $local } else { Join-Path ([System.IO.Path]::GetTempPath()) ("frostpane-" + [guid]::NewGuid().ToString("N")) }
if (-not $local) {
  Say "Downloading assets from $Repo ..."
  foreach ($f in $assets) {
    $dst = Join-Path $Src ($f -replace '/','\')
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    irm "$Repo/installer/assets/$f" -OutFile $dst
  }
}

# --- 1. the theme extension (theme + colour picker; no app patching) ---
Say "Installing Frostpane -> $(Join-Path $ExtDir $ThemeDir)"
# Any earlier version has to go, or VS Code registers two themes both called
# "Frostpane" and the colorTheme setting resolves to whichever it saw first.
Get-ChildItem $ExtDir -Directory -Filter "frostpane.frostpane-theme-*" -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.Name -ne $ThemeDir) { Say "  removing older install: $($_.Name)" }
  Remove-Item -Recurse -Force $_.FullName
}
$tgt = Join-Path $ExtDir $ThemeDir
New-Item -ItemType Directory -Force -Path (Join-Path $tgt "themes"), (Join-Path $tgt "media") | Out-Null
Copy-Item (Join-Path $Src "frostpane-theme\package.json"),(Join-Path $Src "frostpane-theme\extension.js"),(Join-Path $Src "frostpane-theme\palette.js") $tgt
Copy-Item (Join-Path $Src "frostpane-theme\themes\frostpane-color-theme.json") (Join-Path $tgt "themes")
Copy-Item (Join-Path $Src "frostpane-theme\media\picker.html") (Join-Path $tgt "media")

# --- 2. the optional blur layer (this is the part that patches VS Code) ---
if ($WantBlur) {
  New-Item -ItemType Directory -Force -Path $CuiDir | Out-Null
  if (Get-Command code -ErrorAction SilentlyContinue) {
    Say "Installing Custom UI Style (required for blur) ..."
    try { code --install-extension $CuiExt --force | Out-Null } catch { Warn "could not install $CuiExt (install it manually)" }
  } else {
    Warn "'code' CLI not found - install the '$CuiExt' extension manually from the Marketplace."
  }
  Say "Copying blur script -> $CuiDir"
  Copy-Item (Join-Path $Src "scripts\menu-glass.js") $CuiDir
} else {
  # Superseded by the extension; an old copy would keep injecting a picker.
  foreach ($s in "theme-customizer.js","panel-anim.js","menu-glass.js") {
    $p = Join-Path $CuiDir $s; if (Test-Path $p) { Remove-Item -Force $p }
  }
}

# --- 3. merge settings (back up first) ---
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
foreach ($p in $frag.PSObject.Properties) {
  $cur | Add-Member -Force -NotePropertyName $p.Name -NotePropertyValue $p.Value
}
$written = @($frag.PSObject.Properties).Count

# The colours are derived by the extension now, so a block written by an older
# Frostpane would fight it. Other themes' overrides are left alone.
$cc = $cur.'workbench.colorCustomizations'
if ($cc -and ($cc.PSObject.Properties.Name -contains '[Frostpane]')) {
  $cc.PSObject.Properties.Remove('[Frostpane]')
  if (-not $cc.PSObject.Properties.Name) { $cur.PSObject.Properties.Remove('workbench.colorCustomizations') }
  Say "  removed the [Frostpane] block an older version wrote (the extension derives it now)"
}

$ours = @("theme-customizer.js","menu-glass.js","panel-anim.js")
$imports = @($cur.'custom-ui-style.external.imports') | Where-Object { $_ }
$importsAreOurs = (@($imports).Count -gt 0) -and -not ($imports | Where-Object {
  $entry = [string]$_
  -not ($ours | Where-Object { $entry -like "*$_*" })
})

if ($WantBlur) {
  $bfrag = Get-Content -Raw (Join-Path $Src "settings.frostpane.blur.json") | ConvertFrom-Json
  # [string[]] so a single import still serialises as a JSON array.
  [string[]]$imp = @("file:///" + ((Join-Path $CuiDir "menu-glass.js") -replace '\\','/'))
  $bfrag.'custom-ui-style.external.imports' = $imp
  foreach ($p in $bfrag.PSObject.Properties) {
    $cur | Add-Member -Force -NotePropertyName $p.Name -NotePropertyValue $p.Value
  }
  $written += @($bfrag.PSObject.Properties).Count
  Say ("  blur layer enabled ({0} CSS rules)" -f @($bfrag.'custom-ui-style.stylesheet'.PSObject.Properties).Count)
} elseif ($importsAreOurs) {
  $cur.PSObject.Properties.Remove('custom-ui-style.stylesheet')
  $cur.PSObject.Properties.Remove('custom-ui-style.external.imports')
  Say "  removed the Custom UI Style keys an older Frostpane wrote"
} elseif ($cur.PSObject.Properties.Name -contains 'custom-ui-style.stylesheet') {
  Say "  NOTE: custom-ui-style keys are present but are not Frostpane's - left untouched"
}

($cur | ConvertTo-Json -Depth 100) | Set-Content -Encoding UTF8 $settings
Say "  wrote $written keys"

Say "Done."
if ($WantBlur) {
@"

Next steps:
  1. Restart VS Code.
  2. Run 'Custom UI Style: Reload' (Ctrl+Shift+P) and confirm the restart.
     The blur layer patches the app, so VS Code shows an 'installation appears
     to be corrupt' banner - dismiss it with the gear, 'Don't show again'.
     It can come back after a VS Code update, which is the cost of the blur.
  3. Theme is set to 'Frostpane'; the picker button is on the status bar.
"@ | Write-Host
} else {
@"

Next steps:
  1. Restart VS Code. That is it - nothing was patched, so there is no
     'installation appears to be corrupt' banner and nothing to redo after a
     VS Code update.
  2. Theme is set to 'Frostpane'; the picker button is on the status bar
     (or run 'Frostpane: Pick Colours').

  Want the frosted dropdowns and top bar back? Re-run with -Blur.
  If a previous version left the '$CuiExt' extension installed, uninstall it
  and run 'Custom UI Style: Restore' - it re-patches the app after every
  VS Code update on its own.
"@ | Write-Host
}
