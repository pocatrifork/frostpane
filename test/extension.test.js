// Stub the vscode module so extension.js can be exercised outside VSCode.
const Module = require("module");
const path = require("path");
const assert = require("assert");

const EXT = path.join(__dirname, "..", "installer", "assets", "frostpane-theme");

const Target = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
let store = { global: {}, workspace: {} };
let folders = [{ name: "myproj" }];
let writes = 0;
const configListeners = [];

function sectionOf(key) { const i = key.indexOf("."); return i < 0 ? [null, key] : [key.slice(0, i), key.slice(i + 1)]; }

function getConfiguration(section) {
  const full = (k) => (section ? section + "." + k : k);
  return {
    get(k) {
      const key = full(k);
      if (folders.length && store.workspace[key] !== undefined) return store.workspace[key];
      if (store.global[key] !== undefined) return store.global[key];
      return DEFAULTS[key];
    },
    inspect(k) {
      const key = full(k);
      return { globalValue: store.global[key], workspaceValue: folders.length ? store.workspace[key] : undefined };
    },
    update(k, value, target) {
      const key = full(k);
      const bucket = target === Target.Workspace ? store.workspace : store.global;
      if (value === undefined) delete bucket[key]; else bucket[key] = value;
      writes++;
      const e = { affectsConfiguration: (s) => key === s || key.startsWith(s + ".") };
      return Promise.resolve().then(() => { configListeners.forEach((fn) => fn(e)); });
    },
  };
}

const DEFAULTS = { "frostpane.accent": "#6cb4ff", "frostpane.background": "#181a1d", "frostpane.statusBarButton": true };

const fake = {
  ConfigurationTarget: Target,
  StatusBarAlignment: { Right: 2 },
  ViewColumn: { Active: -1 },
  Uri: { file: (p) => ({ fsPath: p }) },
  commands: { registerCommand: () => ({ dispose() {} }) },
  window: {
    createStatusBarItem: () => ({ show() {}, dispose() {}, text: "", tooltip: "", command: "", name: "" }),
    createWebviewPanel: () => { throw new Error("not exercised"); },
  },
  workspace: {
    get workspaceFolders() { return folders.length ? folders : undefined; },
    getConfiguration,
    onDidChangeConfiguration: (fn) => { configListeners.push(fn); return { dispose() {} }; },
    onDidChangeWorkspaceFolders: () => ({ dispose() {} }),
  },
};

const origLoad = Module._load;
Module._load = function (request) {
  if (request === "vscode") return fake;
  return origLoad.apply(this, arguments);
};

const ext = require(path.join(EXT, "extension.js"));
const palette = require(path.join(EXT, "palette.js"));
const CC = "workbench.colorCustomizations";
const block = (b) => (store[b][CC] || {})["[Frostpane]"];
const settle = () => new Promise((r) => setTimeout(r, 30));

(async () => {
  // 1. at the defaults, nothing is written to settings
  ext.activate({ subscriptions: [], extensionPath: EXT });
  await settle();
  assert.strictEqual(store.global[CC], undefined, "defaults should write no block");
  console.log("1 ok  defaults leave settings.json alone");

  // 2. a pick derives the block at global scope
  store.global["frostpane.accent"] = "#ffe44d";
  await getConfiguration().update("frostpane.accent", "#ffe44d", Target.Global);
  await settle();
  const b2 = block("global");
  assert.ok(b2, "block should exist after a pick");
  assert.strictEqual(b2["button.background"], "#ffe44d");
  assert.strictEqual(b2["button.foreground"], "#0a1014", "yellow accent gets dark text");
  assert.strictEqual(b2["editor.background"], "#181a1d");
  assert.strictEqual(Object.keys(b2).length, 125);
  console.log("2 ok  pick derives", Object.keys(b2).length, "keys at global scope");

  // 3. an unrelated theme's block survives
  store.global[CC]["[Some Other Theme]"] = { "editor.background": "#123456" };
  await getConfiguration().update("frostpane.background", "#1e0d12", Target.Global);
  await settle();
  assert.deepStrictEqual(store.global[CC]["[Some Other Theme]"], { "editor.background": "#123456" });
  assert.strictEqual(block("global")["editor.background"], "#1e0d12");
  console.log("3 ok  other themes' overrides untouched");

  // 4. re-running sync with nothing changed must not write (no write loop)
  const before = writes;
  const e = { affectsConfiguration: () => true };
  configListeners.forEach((fn) => fn(e));
  await settle();
  assert.strictEqual(writes, before, "sync should be a no-op when nothing differs, got " + (writes - before) + " writes");
  console.log("4 ok  idempotent: no write when nothing changed");

  // 5. a project override adds a workspace block and leaves the global pick be
  store.workspace["frostpane.accent"] = "#21c25e";
  await getConfiguration().update("frostpane.accent", "#21c25e", Target.Workspace);
  await settle();
  assert.ok(block("workspace"), "workspace block should exist");
  assert.strictEqual(block("workspace")["button.background"], "#21c25e");
  assert.strictEqual(block("workspace")["editor.background"], "#1e0d12", "background falls back to the global pick");
  assert.ok(block("global"), "the global pick must survive a project override");
  assert.strictEqual(block("global")["button.background"], "#ffe44d");
  assert.deepStrictEqual(store.global[CC]["[Some Other Theme]"], { "editor.background": "#123456" });
  console.log("5 ok  project override is additive; global pick survives");

  // 5b. dropping the override removes just the workspace block
  delete store.workspace["frostpane.accent"];
  await getConfiguration().update("frostpane.accent", undefined, Target.Workspace);
  await settle();
  assert.strictEqual(block("workspace"), undefined, "workspace block should be gone");
  assert.ok(block("global"), "global block should remain");
  console.log("5b ok back to global clears only the workspace block");

  // 6. back to defaults removes the block entirely
  delete store.workspace["frostpane.accent"];
  delete store.global["frostpane.accent"];
  delete store.global["frostpane.background"];
  await getConfiguration().update("frostpane.background", undefined, Target.Global);
  await settle();
  assert.strictEqual(block("workspace"), undefined, "workspace block gone");
  assert.strictEqual(block("global"), undefined, "global block gone");
  assert.deepStrictEqual(store.global[CC], { "[Some Other Theme]": { "editor.background": "#123456" } });
  console.log("6 ok  reset to defaults removes the block, keeps the rest");

  // 7. a light background is pulled back into the dark range
  assert.strictEqual(palette.clampDark("#ffffff"), "#292929");
  assert.strictEqual(palette.expand("#6cb4ff", "#ffffff")["editor.background"], "#292929");
  console.log("7 ok  light background clamped dark");

  console.log("\nall extension tests passed");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
