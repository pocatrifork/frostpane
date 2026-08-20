// Frostpane popup - the colour picker as an overlay on the workbench.
//
// This script is injected into the workbench by Custom UI Style, so it is part
// of the renderer: it can draw anywhere, but it cannot write settings.json. The
// Frostpane extension owns the two settings and derives every workbench colour
// from them, so the popup is only a face: it asks the extension over loopback
// (see bridge.js) and the extension writes. Nothing here paints colours.
//
// Requires the blur layer, since that is what injects scripts at all. Without
// it the extension's webview picker is what opens instead.
(function () {
  "use strict";

  try {
    if (window.__frostpanePopupLoaded) return;
    window.__frostpanePopupLoaded = true;
  } catch (e) { return; }

  var PORTS = [39847, 39848, 39849, 39850, 39851, 39852, 39853, 39854, 39855, 39856];
  var PATH = "/frostpane";
  var POPUP_ID = "frostpane-popup";
  var STYLE_ID = "frostpane-popup-style";

  var sock = null;
  var state = null;
  var open = false;
  var retryDelay = 1500;

  // ------------------------------------------------------------ which window

  // Every window's extension host listens on its own port, so the popup has to
  // find the one that belongs to this window. The window title carries the
  // folder name - "file - folder - Visual Studio Code" - and each server
  // answers with the folder it has open. Titles are empty at script load, so
  // this is read lazily, and discovery retries until it lines up.
  function folderKey() {
    try {
      var t = (document.title || "").replace(/—/g, "-");
      var parts = t.split(" - ").map(function (s) { return s.trim(); }).filter(Boolean);
      if (parts.length >= 2) return parts[parts.length - 2];
    } catch (e) {}
    return "";
  }

  function isOurWindow(hello) {
    var mine = folderKey();
    if (!hello.hasWorkspace) return mine === "";
    if (!mine) return false;                 // title not resolved yet: retry
    return hello.folder === mine;
  }

  // ---------------------------------------------------------------- transport

  function send(msg) {
    try { if (sock && sock.readyState === 1) sock.send(JSON.stringify(msg)); } catch (e) {}
  }

  function adopt(ws) {
    sock = ws;
    retryDelay = 1500;
    ws.onclose = function () {
      sock = null;
      state = null;
      hide();
      setTimeout(discover, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };
    ws.onmessage = function (e) {
      var msg = null;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (!msg) return;
      if (msg.type === "state") { state = msg; if (open) render(); return; }
      // The status bar button is the extension's, so "open" arrives from there.
      if (msg.type === "open") { toggle(); return; }
    };
  }

  // All ports are tried at once, so a cold start costs one round trip rather
  // than ten. Whichever server says it has this window's folder open wins; the
  // rest are dropped. If none claims it - a custom window.title, say, so the
  // folder cannot be read - a single responding server is unambiguous and is
  // taken anyway.
  var attempts = 0;

  function discover() {
    if (sock) return;
    if (++attempts > 12) return;             // no extension listening; stop
    var settled = false;
    var pending = PORTS.length;
    var others = [];
    var all = [];

    function shutOthers(keep) {
      all.forEach(function (ws) {
        if (ws !== keep) { try { ws.close(); } catch (e) {} }
      });
    }

    function finishRound() {
      if (settled || pending > 0) return;
      if (others.length === 1) {
        settled = true;
        adopt(others[0]);
        shutOthers(others[0]);
        return;
      }
      shutOthers(null);
      setTimeout(discover, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    }

    PORTS.forEach(function (port) {
      var ws;
      try { ws = new WebSocket("ws://127.0.0.1:" + port + PATH); } catch (e) { pending--; return; }
      all.push(ws);
      var counted = false;
      var count = function () {
        if (counted) return;
        counted = true;
        pending--;
        finishRound();
      };
      ws.onerror = count;
      ws.onclose = count;
      ws.onmessage = function (e) {
        var msg = null;
        try { msg = JSON.parse(e.data); } catch (err) { return; }
        if (!msg || msg.type !== "hello") return;
        if (settled) { try { ws.close(); } catch (err) {} return; }
        if (isOurWindow(msg)) {
          settled = true;
          counted = true;
          attempts = 0;
          adopt(ws);
          shutOthers(ws);
          return;
        }
        others.push(ws);                     // a different window's host
        count();
      };
    });
  }

  // --------------------------------------------------------------------- view

  function css() {
    if (document.getElementById(STYLE_ID)) return;
    var s = "#" + POPUP_ID + "{position:fixed;right:14px;bottom:30px;width:294px;z-index:100000;" +
      "padding:14px;border-radius:6px;box-sizing:border-box;" +
      "color:var(--vscode-foreground,#eaf3ff);font-family:var(--vscode-font-family,sans-serif);font-size:12px;" +
      "border:1px solid rgba(255,255,255,0.14);" +
      "background-color:color-mix(in srgb, var(--vscode-quickInput-background,#22242a) 88%, transparent);" +
      "backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);" +
      "box-shadow:0 6px 20px 0 rgba(0,0,0,0.45);}" +
      "#" + POPUP_ID + ".fp-hide{display:none !important;}" +
      "#" + POPUP_ID + " .fp-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px 0;}" +
      "#" + POPUP_ID + " .fp-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.85;}" +
      "#" + POPUP_ID + " .fp-close{cursor:pointer;width:22px;height:22px;display:flex;align-items:center;" +
      "justify-content:center;border-radius:4px;font-size:17px;line-height:1;opacity:0.65;}" +
      "#" + POPUP_ID + " .fp-close:hover{background:rgba(255,255,255,0.12);opacity:1;}" +
      "#" + POPUP_ID + " .fp-sec{margin-bottom:14px;}" +
      "#" + POPUP_ID + " .fp-sec:last-child{margin-bottom:0;}" +
      "#" + POPUP_ID + " .fp-h{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin:0 0 6px 0;}" +
      "#" + POPUP_ID + " .fp-sw-row{display:flex;flex-wrap:wrap;gap:6px;}" +
      "#" + POPUP_ID + " .fp-sw{width:24px;height:24px;padding:0;border-radius:4px;cursor:pointer;" +
      "border:1px solid rgba(255,255,255,0.18);box-sizing:border-box;}" +
      "#" + POPUP_ID + " .fp-bg .fp-sw{width:44px;}" +
      "#" + POPUP_ID + " .fp-sw.sel{outline:2px solid var(--vscode-focusBorder,#6cb4ff);outline-offset:1px;}" +
      "#" + POPUP_ID + " .fp-sw.fp-custom{display:flex;align-items:center;justify-content:center;" +
      "background:rgba(255,255,255,0.08);color:inherit;font-size:13px;line-height:1;}" +
      "#" + POPUP_ID + " .fp-sw.fp-custom:hover{background:rgba(255,255,255,0.16);}" +
      "#" + POPUP_ID + " .fp-seg{display:flex;gap:4px;padding:3px;border:1px solid rgba(255,255,255,0.18);border-radius:4px;}" +
      "#" + POPUP_ID + " .fp-seg button{flex:1;text-align:center;padding:6px 8px;cursor:pointer;font:inherit;" +
      "color:inherit;background:transparent;border:0;border-radius:3px;}" +
      "#" + POPUP_ID + " .fp-seg button:hover:not(:disabled):not(.sel){background:rgba(255,255,255,0.06);}" +
      "#" + POPUP_ID + " .fp-seg button.sel{background:var(--vscode-button-background,#6cb4ff);" +
      "color:var(--vscode-button-foreground,#0a1416);font-weight:600;}" +
      "#" + POPUP_ID + " .fp-seg button:disabled{opacity:0.4;cursor:default;}" +
      "#" + POPUP_ID + " .fp-foot{display:flex;align-items:center;gap:10px;}" +
      "#" + POPUP_ID + " .fp-btn{border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);" +
      "color:inherit;font:inherit;padding:5px 10px;border-radius:4px;cursor:pointer;}" +
      "#" + POPUP_ID + " .fp-btn:hover:not(:disabled){background:rgba(255,255,255,0.12);}" +
      "#" + POPUP_ID + " .fp-btn:disabled{opacity:0.4;cursor:default;}" +
      "#" + POPUP_ID + " .fp-hint{margin:6px 0 0 0;font-size:10px;opacity:0.6;line-height:1.4;}" +
      "#" + POPUP_ID + " .fp-foot .fp-hint{margin:0;}" +
      "#" + POPUP_ID + " .fp-color{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0;margin:0;}";
    var tag = document.createElement("style");
    tag.id = STYLE_ID;
    tag.textContent = s;
    document.head.appendChild(tag);
  }

  // Trusted Types are enforced in the workbench, so innerHTML throws and kills
  // the script. Every node is built by hand.
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "text") n.textContent = props[k];
      else if (k === "class") n.className = props[k];
      else if (k === "style") n.setAttribute("style", props[k]);
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  var refs = {};

  function build() {
    css();
    var accentInput = el("input", { type: "color", class: "fp-color" });
    var bgInput = el("input", { type: "color", class: "fp-color" });

    var accentRow = el("div", { class: "fp-sw-row" });
    var bgRow = el("div", { class: "fp-sw-row" });
    var segGlobal = el("button", { type: "button", text: "Global" });
    var segProject = el("button", { type: "button", text: "This Project" });
    var scopeHint = el("p", { class: "fp-hint" });
    var resetBtn = el("button", { type: "button", class: "fp-btn", text: "Reset" });
    var close = el("div", { class: "fp-close", role: "button", "aria-label": "Close", text: "×" });

    var root = el("div", { id: POPUP_ID, class: "fp-hide" }, [
      el("div", { class: "fp-head" }, [el("div", { class: "fp-title", text: "Frostpane" }), close]),
      el("div", { class: "fp-sec" }, [el("p", { class: "fp-h", text: "Accent" }), accentRow]),
      el("div", { class: "fp-sec fp-bg" }, [
        el("p", { class: "fp-h", text: "Background" }), bgRow,
        el("p", { class: "fp-hint", text: "Shown brighter than they apply - the background is held dark." }),
      ]),
      el("div", { class: "fp-sec" }, [
        el("p", { class: "fp-h", text: "Scope" }),
        el("div", { class: "fp-seg" }, [segGlobal, segProject]),
        scopeHint,
      ]),
      el("div", { class: "fp-sec fp-foot" }, [resetBtn, el("p", { class: "fp-hint", text: "Escape closes" })]),
      accentInput, bgInput,
    ]);

    // The workbench is not guaranteed to exist this early; body always is.
    document.body.appendChild(root);

    refs = {
      root: root, accentRow: accentRow, bgRow: bgRow,
      accentInput: accentInput, bgInput: bgInput,
      segGlobal: segGlobal, segProject: segProject, scopeHint: scopeHint, reset: resetBtn,
    };

    close.addEventListener("click", hide);
    resetBtn.addEventListener("click", function () { send({ type: "reset" }); });
    segGlobal.addEventListener("click", function () { send({ type: "scope", value: "global" }); });
    segProject.addEventListener("click", function () { send({ type: "scope", value: "workspace" }); });

    // Dragging the native picker fires continuously; a trailing debounce keeps
    // that from writing settings on every frame.
    var pending = null;
    function live(msg) {
      if (pending) clearTimeout(pending);
      pending = setTimeout(function () { pending = null; send(msg); }, 160);
    }
    accentInput.addEventListener("input", function () { live({ type: "set", accent: accentInput.value }); });
    bgInput.addEventListener("input", function () { live({ type: "set", background: bgInput.value }); });
  }

  function swatch(fill, title, selected, onClick) {
    var b = el("button", { type: "button", class: "fp-sw" + (selected ? " sel" : ""), title: title });
    b.style.background = fill;
    b.addEventListener("click", onClick);
    return b;
  }

  function customSwatch(input, current, isCustom) {
    var b = el("button", {
      type: "button", class: "fp-sw fp-custom" + (isCustom ? " sel" : ""),
      title: "Custom colour", text: isCustom ? "✎" : "+",
    });
    if (isCustom) b.style.background = current;
    b.addEventListener("click", function () { input.value = current; input.click(); });
    return b;
  }

  function render() {
    if (!state || !refs.root) return;

    refs.accentRow.textContent = "";
    var accentKnown = false;
    (state.accentPresets || []).forEach(function (hex) {
      var sel = hex.toLowerCase() === String(state.accent).toLowerCase();
      if (sel) accentKnown = true;
      refs.accentRow.appendChild(swatch(hex, hex, sel, function () {
        send({ type: "set", accent: hex });
      }));
    });
    refs.accentRow.appendChild(customSwatch(refs.accentInput, state.accent, !accentKnown));

    refs.bgRow.textContent = "";
    var bgKnown = false;
    (state.backgroundPresets || []).forEach(function (p) {
      var sel = p.value.toLowerCase() === String(state.background).toLowerCase();
      if (sel) bgKnown = true;
      refs.bgRow.appendChild(swatch(p.display, p.value, sel, function () {
        send({ type: "set", background: p.value });
      }));
    });
    refs.bgRow.appendChild(customSwatch(refs.bgInput, state.background, !bgKnown));

    refs.segGlobal.classList.toggle("sel", state.scope === "global");
    refs.segProject.classList.toggle("sel", state.scope === "workspace");
    refs.segProject.disabled = !state.hasWorkspace;
    refs.scopeHint.textContent = !state.hasWorkspace
      ? "No folder open, so the pick applies globally."
      : (state.scope === "workspace"
          ? "Stored in " + state.folder + "/.vscode/settings.json."
          : "Stored in your user settings, so it applies everywhere.");
    refs.reset.disabled = !!state.isDefault;
  }

  function show() {
    if (!refs.root) build();
    open = true;
    refs.root.classList.remove("fp-hide");
    send({ type: "state" });
    render();
  }

  function hide() {
    open = false;
    if (refs.root) refs.root.classList.add("fp-hide");
  }

  function toggle() { if (open) hide(); else show(); }

  // The workbench calls stopPropagation on bubbling events, so dismissal has to
  // listen in the capture phase or it never fires. The status bar item is the
  // extension's, and a click there arrives as an "open" message - so a click on
  // it must not also count as clicking away.
  function wireDismiss() {
    document.addEventListener("mousedown", function (e) {
      if (!open) return;
      var t = e.target;
      if (t && t.closest && (t.closest("#" + POPUP_ID) || t.closest(".statusbar-item"))) return;
      hide();
    }, true);
    document.addEventListener("keydown", function (e) {
      if (open && e.key === "Escape") hide();
    }, true);
  }

  build();
  wireDismiss();
  discover();
})();
