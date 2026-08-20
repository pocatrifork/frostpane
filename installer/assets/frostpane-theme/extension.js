"use strict";

// Frostpane keeps two settings - frostpane.accent and frostpane.background -
// and derives workbench.colorCustomizations from them. That is the whole
// extension: a status bar button, a picker, and a sync that keeps the derived
// block in step with the two values.
//
// Deriving into settings rather than injecting CSS is what keeps VSCode
// unpatched, so there is no "installation appears to be corrupt" banner and
// nothing to re-apply after a VSCode update.

var vscode = require("vscode");
var fs = require("fs");
var path = require("path");
var palette = require("./palette.js");

var SECTION = "frostpane";
var SCOPE_KEY = "[Frostpane]";
var CUSTOMIZATIONS = "workbench.colorCustomizations";
var Target = vscode.ConfigurationTarget;

function hasWorkspace() {
  return !!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length);
}

// The colours follow wherever the user put them: set frostpane.accent in
// workspace settings and the derived block is written there too.
function activeTarget() {
  if (!hasWorkspace()) return Target.Global;
  var cfg = vscode.workspace.getConfiguration(SECTION);
  var a = cfg.inspect("accent") || {};
  var b = cfg.inspect("background") || {};
  var scoped = a.workspaceValue !== undefined || b.workspaceValue !== undefined
            || a.workspaceFolderValue !== undefined || b.workspaceFolderValue !== undefined;
  return scoped ? Target.Workspace : Target.Global;
}

function currentColors() {
  var cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    accent: palette.normalizeHex(cfg.get("accent")) || palette.DEFAULTS.accent,
    background: palette.clampDark(cfg.get("background")),
  };
}

function blockAt(target) {
  var info = vscode.workspace.getConfiguration().inspect(CUSTOMIZATIONS) || {};
  var all = (target === Target.Workspace ? info.workspaceValue : info.globalValue) || {};
  return { all: all, mine: all[SCOPE_KEY] };
}

function sameBlock(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i] || a[ka[i]] !== b[kb[i]]) return false;
  }
  return true;
}

// Writes (or clears) our own scoped block at one target, leaving every other
// theme's overrides in that object untouched.
function writeBlock(target, desired) {
  var state = blockAt(target);
  if (sameBlock(state.mine, desired)) return Promise.resolve(false);
  var next = Object.assign({}, state.all);
  if (desired) next[SCOPE_KEY] = desired;
  else delete next[SCOPE_KEY];
  var value = Object.keys(next).length ? next : undefined;
  return Promise.resolve(
    vscode.workspace.getConfiguration().update(CUSTOMIZATIONS, value, target)
  ).then(function () { return true; });
}

// At the defaults the theme extension already paints these colours, so the
// derived block would be redundant noise in settings.json.
function desiredFor(colors) {
  return palette.isDefault(colors.accent, colors.background)
    ? null
    : palette.expand(colors.accent, colors.background);
}

// Called on activation and on every relevant settings change. It is a no-op
// when nothing differs, which is what stops our own writes from looping.
//
// A block belongs at a scope exactly when the two settings are set at that
// scope. A project override therefore adds a workspace block without touching
// the global one, so the global pick still applies in every other project.
function sync() {
  var cfg = vscode.workspace.getConfiguration(SECTION);
  var a = cfg.inspect("accent") || {};
  var b = cfg.inspect("background") || {};

  var global = {
    accent: palette.normalizeHex(a.globalValue) || palette.DEFAULTS.accent,
    background: palette.clampDark(b.globalValue),
  };

  // An override may set only one of the two; the other falls back to global.
  var overridden = a.workspaceValue !== undefined || b.workspaceValue !== undefined;
  var workspace = overridden ? {
    accent: palette.normalizeHex(a.workspaceValue) || global.accent,
    background: b.workspaceValue === undefined ? global.background : palette.clampDark(b.workspaceValue),
  } : null;

  return writeBlock(Target.Global, desiredFor(global)).then(function () {
    if (!hasWorkspace()) return;
    return writeBlock(Target.Workspace, workspace ? desiredFor(workspace) : null);
  }).catch(function (err) {
    console.error("[frostpane] could not update " + CUSTOMIZATIONS, err);
  });
}

function setColors(patch, target) {
  var cfg = vscode.workspace.getConfiguration(SECTION);
  var writes = [];
  if (patch.accent) writes.push(cfg.update("accent", patch.accent, target));
  if (patch.background) writes.push(cfg.update("background", patch.background, target));
  return Promise.all(writes).then(sync);
}

// Global <-> This Project. Moving to project scope copies the values in;
// moving back removes them so the global values show through again.
function setScope(scope) {
  var colors = currentColors();
  var cfg = vscode.workspace.getConfiguration(SECTION);
  if (scope === "workspace") {
    if (!hasWorkspace()) return Promise.resolve();
    return Promise.all([
      cfg.update("accent", colors.accent, Target.Workspace),
      cfg.update("background", colors.background, Target.Workspace),
    ]).then(sync);
  }
  return Promise.all([
    cfg.update("accent", undefined, Target.Workspace),
    cfg.update("background", undefined, Target.Workspace),
  ]).then(sync);
}

function reset() {
  var cfg = vscode.workspace.getConfiguration(SECTION);
  var clears = [
    cfg.update("accent", undefined, Target.Global),
    cfg.update("background", undefined, Target.Global),
  ];
  if (hasWorkspace()) {
    clears.push(cfg.update("accent", undefined, Target.Workspace));
    clears.push(cfg.update("background", undefined, Target.Workspace));
  }
  return Promise.all(clears).then(sync);
}

// ---------------------------------------------------------------- status bar

var statusItem = null;

function refreshStatusItem() {
  var show = vscode.workspace.getConfiguration(SECTION).get("statusBarButton") !== false;
  if (!show) {
    if (statusItem) { statusItem.dispose(); statusItem = null; }
    return;
  }
  if (!statusItem) {
    statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
    statusItem.command = "frostpane.pickColors";
    statusItem.name = "Frostpane";
  }
  statusItem.text = "$(symbol-color) Frostpane";
  statusItem.tooltip = "Frostpane: pick the accent and background colour";
  statusItem.show();
}

// -------------------------------------------------------------------- picker

var panel = null;

function nonce() {
  var s = "", chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function pickerState() {
  var colors = currentColors();
  return {
    accent: colors.accent,
    background: colors.background,
    accentPresets: palette.ACCENT_PRESETS,
    backgroundPresets: palette.BACKGROUND_PRESETS.map(function (hex) {
      return { value: hex, display: palette.brightenForDisplay(hex) };
    }),
    scope: activeTarget() === Target.Workspace ? "workspace" : "global",
    hasWorkspace: hasWorkspace(),
    folder: hasWorkspace() ? vscode.workspace.workspaceFolders[0].name : "",
    isDefault: palette.isDefault(colors.accent, colors.background),
  };
}

function postState() {
  if (panel) panel.webview.postMessage({ type: "state", state: pickerState() });
}

function openPicker(context) {
  if (panel) { panel.reveal(); postState(); return; }
  var mediaRoot = vscode.Uri.file(path.join(context.extensionPath, "media"));
  panel = vscode.window.createWebviewPanel("frostpane.picker", "Frostpane", {
    viewColumn: vscode.ViewColumn.Active, preserveFocus: false,
  }, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [mediaRoot],
  });

  var n = nonce();
  var html = fs.readFileSync(path.join(context.extensionPath, "media", "picker.html"), "utf8");
  panel.webview.html = html.replace(/__NONCE__/g, n);

  panel.onDidDispose(function () { panel = null; });
  panel.onDidChangeViewState(function () { if (panel && panel.visible) postState(); });
  panel.webview.onDidReceiveMessage(function (msg) {
    if (!msg) return;
    if (msg.type === "ready") { postState(); return; }
    if (msg.type === "set") {
      var patch = {};
      if (msg.accent) patch.accent = palette.normalizeHex(msg.accent) || undefined;
      // The picker offers a free colour input, so a light pick is pulled back
      // into the dark range here rather than silently painting an unreadable UI.
      if (msg.background) patch.background = palette.clampDark(msg.background);
      setColors(patch, activeTarget()).then(postState);
      return;
    }
    if (msg.type === "scope") { setScope(msg.value).then(postState); return; }
    if (msg.type === "reset") { reset().then(postState); return; }
  });
  postState();
}

// ------------------------------------------------------------------ lifecycle

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("frostpane.pickColors", function () {
      openPicker(context);
    }),
    vscode.commands.registerCommand("frostpane.reset", function () {
      return reset().then(postState);
    }),
    vscode.workspace.onDidChangeConfiguration(function (e) {
      if (e.affectsConfiguration(SECTION + ".statusBarButton")) refreshStatusItem();
      if (e.affectsConfiguration(SECTION + ".accent")
          || e.affectsConfiguration(SECTION + ".background")
          || e.affectsConfiguration(CUSTOMIZATIONS)) {
        sync().then(postState);
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(function () { sync().then(postState); }),
    { dispose: function () { if (statusItem) statusItem.dispose(); } }
  );

  refreshStatusItem();
  sync();
}

function deactivate() {}

module.exports = { activate: activate, deactivate: deactivate };
