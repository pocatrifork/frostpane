(function () {
  "use strict";

  try { console.log("[theme-customizer] script executing (v7, color-only)"); } catch (e) {}

  try {
    if (window.__itcThemeCustomizerLoaded) return;
    window.__itcThemeCustomizerLoaded = true;
  } catch (e) { return; }

  var DEFAULTS = {
    accent: "#6cb4ff",
    bgColor: "#111111",
  };
  var MAX_L = 0.16;
  var MAX_S = 0.6;
  var LS = {
    accent: "itc.accent",
    bgColor: "itc.bgColor",
    bgColorRaw: "itc.bgColorRaw",
  };

  // document.title is empty at script load, so the folder key is resolved
  // lazily on first use (ensureFolderKey), never eagerly at load.
  function getFolderKey() {
    try {
      var t = (document.title || "").replace(/—/g, "-");
      var parts = t.split(" - ").map(function (s) { return s.trim(); }).filter(Boolean);
      if (parts.length >= 2) return parts[parts.length - 2];
      if (parts.length === 1) return parts[0];
    } catch (e) {}
    return "";
  }
  var folderKey = "";

  function ensureFolderKey() { if (!folderKey) folderKey = getFolderKey(); return folderKey; }
  var perFolder = false;
  function fEnabledKey() { return "itc.f." + folderKey + ".enabled"; }
  function scopedKey(name) {
    return (perFolder && folderKey) ? ("itc.f." + folderKey + "." + name) : LS[name];
  }

  var ACCENT_PRESETS = [
    "#6cb4ff", "#8fc7ff", "#6c7bff", "#39c5cf", "#14c8a0",
    "#21c25e", "#7ee787", "#c3e645", "#ffe44d", "#c8a17a",
    "#ffa657", "#ff7b72", "#de2b55","#ff6ac1", "#c46bff",
    "#9d6bff", "#d2a8ff", "#a5adba", "#ffffff",
  ];

  var DARK_SWATCHES = [
    "#080808", "#10131a", "#1e0d12", "#0f1714",
    "#161a10", "#0a1a0e", "#0a1f1e", "#1d100a",
    "#110f24", "#170f20", "#1c0d1e",
  ];

  function clampHex(h) {
    if (typeof h !== "string") return null;
    h = h.trim();
    if (h[0] !== "#") h = "#" + h;

    if (/^#[0-9a-fA-F]{3}$/.test(h)) {
      h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    }
    return /^#[0-9a-fA-F]{6}$/.test(h) ? h.toLowerCase() : null;
  }

  function hexToRgb(h) {
    var c = clampHex(h);
    if (!c) return null;
    return {
      r: parseInt(c.slice(1, 3), 16),
      g: parseInt(c.slice(3, 5), 16),
      b: parseInt(c.slice(5, 7), 16),
    };
  }

  function rgbToHex(r, g, b) {
    function p(n) {
      var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    return "#" + p(r) + p(g) + p(b);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    var d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h, s: s, l: l };
  }

  function hslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }

  function clampDark(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return DEFAULTS.bgColor;
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.min(hsl.l, MAX_L);
    hsl.s = Math.min(hsl.s, MAX_S);
    var out = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(out.r, out.g, out.b);
  }

  // Display-only lift: swatches are near-black, so brighten them for the
  // picker. The applied background always uses the original dark value.
  function brightenForDisplay(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    if (hsl.s < 0.12) {
      hsl.l = 0.18 + (Math.min(hsl.l, MAX_L) / MAX_L) * 0.48;
    } else {
      hsl.l = 0.52;
      hsl.s = Math.min(1, hsl.s * 2.2);
    }
    var out = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(out.r, out.g, out.b);
  }

  function lsGet(key, dflt) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? dflt : v;
    } catch (e) { return dflt; }
  }
  function lsSet(key, val) {
    try {
      window.localStorage.setItem(key, val);
      return true;
    } catch (e) { return false; }
  }

  var state = {
    accent: DEFAULTS.accent,
    bgColor: DEFAULTS.bgColor,
    bgColorRaw: DEFAULTS.bgColor,
  };

  function scrubLegacyImageState() {
    try {
      for (var i = window.localStorage.length - 1; i >= 0; i--) {
        var k = window.localStorage.key(i);
        if (k && /^itc\.(f\..*\.)?(bgMode|bgImage)$/.test(k)) {
          window.localStorage.removeItem(k);
        }
      }
    } catch (e) {}
  }

  function loadState() {
    ensureFolderKey();
    perFolder = folderKey ? (lsGet(fEnabledKey(), "") === "1") : false;
    state.accent = clampHex(lsGet(scopedKey("accent"), DEFAULTS.accent)) || DEFAULTS.accent;
    state.bgColor = clampDark(clampHex(lsGet(scopedKey("bgColor"), DEFAULTS.bgColor)) || DEFAULTS.bgColor);
    state.bgColorRaw = clampHex(lsGet(scopedKey("bgColorRaw"), state.bgColor)) || state.bgColor;
  }

  function persist() {
    lsSet(scopedKey("accent"), state.accent);
    lsSet(scopedKey("bgColor"), state.bgColor);
    lsSet(scopedKey("bgColorRaw"), state.bgColorRaw);
  }

  function setScope(projectScoped) {
    ensureFolderKey();
    if (!folderKey) return;
    if (projectScoped) {
      perFolder = true;
      lsSet(fEnabledKey(), "1");
      persist();
    } else {
      try {
        ["accent", "bgColor", "bgColorRaw"].forEach(function (n) {
          window.localStorage.removeItem("itc.f." + folderKey + "." + n);
        });
        window.localStorage.removeItem(fEnabledKey());
      } catch (e) {}
      perFolder = false;
      loadState();
      applyState();
    }
    refreshSelections();
  }

  function workbench() {
    try { return document.querySelector(".monaco-workbench"); } catch (e) { return null; }
  }

  function applyState() {
    try {
      try { document.documentElement.style.setProperty("--frostpane-accent", state.accent); } catch (e) {}
      var wb = workbench();
      if (!wb) return;
      wb.style.setProperty("--frostpane-accent", state.accent);
      wb.style.setProperty("--frostpane-bg-canvas", state.bgColor);
      wb.style.setProperty("--frostpane-window-fill", "rgba(255,255,255,0.08)");

      wb.style.removeProperty("--frostpane-bg-image");
      wb.style.removeProperty("--frostpane-window-blur");
      wb.classList.remove("itc-bg-image");
    } catch (e) {  }
  }

  var BTN_ID = "itc-button";
  var POPUP_ID = "itc-popup";
  var STYLE_ID = "itc-style";
  var popupOpen = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =

      "#" + BTN_ID + "{display:flex;align-items:center;gap:5px;height:100%;padding:0 7px;" +
      "cursor:pointer;color:var(--vscode-foreground, #bcbec4);font-size:12px;line-height:1;" +
      "-webkit-app-region:no-drag;}" +
      "#" + BTN_ID + ":hover{background-color:var(--vscode-statusBarItem-hoverBackground, rgba(255,255,255,0.12));}" +
      "#" + BTN_ID + " svg{width:14px;height:14px;display:block;}" +
      "#" + BTN_ID + " .itc-sb-text{font-family:inherit;}" +

      "#" + POPUP_ID + "{position:fixed;right:14px;bottom:30px;width:294px;z-index:100000;" +
      "padding:14px;border-radius:var(--frostpane-widget-radius, 10px);color:#eaf3ff;" +
      "font-family:'Bear Sans UI', sans-serif;font-size:12px;" +
      "border:1px solid rgba(255,255,255,0.18);" +
      "background-color:color-mix(in srgb, var(--frostpane-bg-surface, #181a1d) 38%, transparent);" +
      "backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);" +
      "box-shadow:inset 0 1px 0 0 rgba(255,255,255,0.12), 0 12px 32px 0 rgba(0,0,0,0.55);}" +
      "#" + POPUP_ID + " .itc-h{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;" +
      "opacity:0.7;margin:0 0 6px 0;}" +
      "#" + POPUP_ID + " .itc-section{margin-bottom:14px;}" +
      "#" + POPUP_ID + " .itc-section:last-child{margin-bottom:0;}" +
      "#" + POPUP_ID + " .itc-row{display:flex;align-items:center;gap:8px;}" +

      "#" + POPUP_ID + " .itc-swatches{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;width:294px;}" +
      "#" + POPUP_ID + " .itc-sw{width:24px;height:24px;border-radius:6px;cursor:pointer;" +
      "border:1px solid rgba(255,255,255,0.18);box-sizing:border-box;}" +

      "#" + POPUP_ID + " .itc-bg-swatches .itc-sw{width:44px;}" +
      "#" + POPUP_ID + " .itc-sw.sel{outline:2px solid var(--frostpane-accent, #6cb4ff);outline-offset:1px;}" +

      "#" + POPUP_ID + " .itc-hidden-color{position:absolute;width:1px;height:1px;" +
      "opacity:0;pointer-events:none;border:0;padding:0;margin:0;}" +

      "#" + POPUP_ID + " .itc-sw.itc-custom{display:flex;align-items:center;justify-content:center;" +
      "background:rgba(255,255,255,0.08);color:#eaf3ff;}" +
      "#" + POPUP_ID + " .itc-sw.itc-custom:hover{background:rgba(255,255,255,0.16);}" +
      "#" + POPUP_ID + " .itc-sw.itc-custom .itc-ic{width:13px;height:13px;display:block;" +
      "filter:drop-shadow(0 0 1px rgba(0,0,0,0.55));}" +
      "#" + POPUP_ID + " .itc-sw.itc-custom .itc-ic-edit{display:none;}" +
      "#" + POPUP_ID + " .itc-sw.itc-custom.has-color .itc-ic-plus{display:none;}" +
      "#" + POPUP_ID + " .itc-sw.itc-custom.has-color .itc-ic-edit{display:block;}" +
      "#" + POPUP_ID + " .itc-sw.itc-custom.has-color:hover{filter:brightness(1.08);}" +
      "#" + POPUP_ID + " .itc-btn{border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);" +
      "color:#eaf3ff;font:inherit;padding:6px 10px;border-radius:var(--frostpane-input-radius, 8px);cursor:pointer;}" +
      "#" + POPUP_ID + " .itc-btn:hover{background:rgba(255,255,255,0.12);}" +
      "#" + POPUP_ID + " .itc-seg{display:flex;gap:4px;padding:3px;border:1px solid rgba(255,255,255,0.18);" +
      "border-radius:var(--frostpane-input-radius, 8px);}" +
      "#" + POPUP_ID + " .itc-seg-btn{flex:1;text-align:center;padding:6px 8px;cursor:pointer;" +
      "font:inherit;color:#eaf3ff;background:transparent;border:0;border-radius:6px;" +
      "transition:background 0.12s, color 0.12s;}" +
      "#" + POPUP_ID + " .itc-seg-btn:hover{background:rgba(255,255,255,0.06);}" +
      "#" + POPUP_ID + " .itc-seg-btn.sel{background:var(--frostpane-accent, #6cb4ff);color:#0a1416;font-weight:600;}" +
      "#" + POPUP_ID + " .itc-seg-btn:disabled{opacity:0.4;cursor:default;}" +
      "#" + POPUP_ID + " .itc-seg-btn:disabled:hover{background:transparent;}" +
      "#" + POPUP_ID + " .itc-hint{margin:6px 0 0 0;font-size:10px;opacity:0.6;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#" + POPUP_ID + " label{display:flex;align-items:center;gap:6px;cursor:pointer;}" +
      "#" + POPUP_ID + " .itc-header{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px 0;}" +
      "#" + POPUP_ID + " .itc-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.85;}" +
      "#" + POPUP_ID + " .itc-close{cursor:pointer;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:17px;line-height:1;opacity:0.65;}" +
      "#" + POPUP_ID + " .itc-close:hover{background:rgba(255,255,255,0.12);opacity:1;}" +
      "#" + POPUP_ID + " .itc-hide{display:none !important;}" +
      "#" + POPUP_ID + ".itc-hide{display:none !important;}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function svgEl(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  // Build all DOM via createElement/textContent: VSCode enforces Trusted
  // Types, so assigning to innerHTML throws and silently kills the script.
  function el(tag, props, children) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "style") n.setAttribute("style", props[k]);
      else if (k === "class") n.className = props[k];
      else if (k === "text") n.textContent = props[k];
      else n.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function statusHost() {
    return document.querySelector(".part.statusbar .right-items")
        || document.querySelector(".statusbar .right-items")
        || document.querySelector(".part.statusbar")
        || document.querySelector(".statusbar");
  }

  function buildStatusItem() {
   try {
    if (document.getElementById(BTN_ID)) return true;
    var host = statusHost();
    if (!host) return false;
    injectStyle();
    var btn = el("div", {
      id: BTN_ID, class: "statusbar-item right", title: "Customize theme",
      role: "button", "aria-label": "Customize theme",
    });

    var svg = svgEl("svg", { viewBox: "0 0 24 24", fill: "none" });
    svg.appendChild(svgEl("path", {
      d: "M12 3a9 9 0 0 0 0 18c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.8-1.6 1.7-1.6H16a5 5 0 0 0 5-5c0-3.9-4-7.5-9-7.5Z",
      stroke: "currentColor", "stroke-width": "1.6",
    }));
    svg.appendChild(svgEl("circle", { cx: "7.5", cy: "11", r: "1.1", fill: "currentColor" }));
    svg.appendChild(svgEl("circle", { cx: "10", cy: "7.5", r: "1.1", fill: "currentColor" }));
    svg.appendChild(svgEl("circle", { cx: "14.5", cy: "7.5", r: "1.1", fill: "currentColor" }));
    svg.appendChild(svgEl("circle", { cx: "17", cy: "11", r: "1.1", fill: "currentColor" }));
    btn.appendChild(svg);
    btn.appendChild(el("span", { class: "itc-sb-text", text: "Frostpane" }));
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      togglePopup();
    });

    host.insertBefore(btn, host.firstChild);
    return true;
   } catch (e) {
    try { console.error("[theme-customizer] buildStatusItem failed:", e); } catch (_) {}
    return false;
   }
  }

  var refs = {};

  function refreshSelections() {
    if (refs.accentSwatches) {
      refs.accentSwatches.forEach(function (sw) {
        if (sw.dataset.color.toLowerCase() === state.accent.toLowerCase()) sw.classList.add("sel");
        else sw.classList.remove("sel");
      });
    }
    if (refs.accentInput) refs.accentInput.value = state.accent;

    if (refs.bgSwatches) {
      refs.bgSwatches.forEach(function (sw) {
        if (sw.dataset.color.toLowerCase() === state.bgColor.toLowerCase()) sw.classList.add("sel");
        else sw.classList.remove("sel");
      });
    }
    if (refs.bgColorInput) refs.bgColorInput.value = state.bgColor;

    var accentCustom = !ACCENT_PRESETS.some(function (c) { return c.toLowerCase() === state.accent.toLowerCase(); });
    refreshCustomSquare(refs.accentCustom, accentCustom, state.accent);
    var bgCustom = !DARK_SWATCHES.some(function (c) { return c.toLowerCase() === state.bgColor.toLowerCase(); });

    refreshCustomSquare(refs.bgCustom, bgCustom, state.bgColorRaw);

    if (refs.segGlobal) refs.segGlobal.classList.toggle("sel", !perFolder);
    if (refs.segProject) refs.segProject.classList.toggle("sel", perFolder);
    if (refs.scopeHint) {
      refs.scopeHint.textContent = !folderKey
        ? "No folder open — Global only"
        : (perFolder ? ("Stored just for: " + folderKey) : "Applied to all folders");
    }
  }

  function setAccent(hex) {
    var c = clampHex(hex);
    if (!c) return;
    state.accent = c;
    applyState();
    persist();
    refreshSelections();
  }

  function setBgColor(hex) {
    var raw = clampHex(hex);
    if (raw) state.bgColorRaw = raw;
    state.bgColor = clampDark(hex);
    applyState();
    persist();
    refreshSelections();
  }

  function buildCustomSquare(input, title) {
    var sq = el("div", { class: "itc-sw itc-custom", title: title });
    var plus = svgEl("svg", { class: "itc-ic itc-ic-plus", viewBox: "0 0 24 24", fill: "none" });
    plus.appendChild(svgEl("path", {
      d: "M12 5v14M5 12h14", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
    }));
    var edit = svgEl("svg", { class: "itc-ic itc-ic-edit", viewBox: "0 0 24 24", fill: "none" });
    edit.appendChild(svgEl("path", {
      d: "M14.5 6.5l3 3M4 20l1-4 9.5-9.5 3 3L8 19l-4 1z",
      stroke: "currentColor", "stroke-width": "1.6", "stroke-linejoin": "round", "stroke-linecap": "round",
    }));
    sq.appendChild(plus);
    sq.appendChild(edit);

    sq.addEventListener("click", function (e) { e.stopPropagation(); try { input.click(); } catch (_) {} });
    return sq;
  }

  function refreshCustomSquare(sq, isCustom, color) {
    if (!sq) return;
    if (isCustom) {
      sq.classList.add("has-color", "sel");
      sq.style.background = color;
    } else {
      sq.classList.remove("has-color", "sel");
      sq.style.background = "";
    }
  }

  function buildPopup() {
    if (document.getElementById(POPUP_ID)) return document.getElementById(POPUP_ID);
    refs = {};
    ensureFolderKey();
    var pop = el("div", { id: POPUP_ID });
    pop.addEventListener("click", function (e) { e.stopPropagation(); });

    var closeBtn = el("div", { class: "itc-close", title: "Close", text: "×" });
    closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closePopup(); });
    var header = el("div", { class: "itc-header" }, [
      el("span", { class: "itc-title", text: "Customize theme" }),
      closeBtn,
    ]);

    refs.accentInput = el("input", { type: "color", value: state.accent, class: "itc-hidden-color" });
    refs.accentInput.addEventListener("input", function () { setAccent(refs.accentInput.value); });
    var accentSwWrap = el("div", { class: "itc-swatches" });
    refs.accentSwatches = ACCENT_PRESETS.map(function (c) {
      var sw = el("div", { class: "itc-sw", title: c, style: "background:" + c });
      sw.dataset.color = c;
      sw.addEventListener("click", function () { setAccent(c); });
      accentSwWrap.appendChild(sw);
      return sw;
    });
    refs.accentCustom = buildCustomSquare(refs.accentInput, "Custom color");
    accentSwWrap.appendChild(refs.accentCustom);
    var accentSection = el("div", { class: "itc-section" }, [
      el("p", { class: "itc-h", text: "Accent color" }),
      accentSwWrap,
      refs.accentInput,
    ]);

    refs.bgColorInput = el("input", { type: "color", value: state.bgColor, class: "itc-hidden-color" });
    refs.bgColorInput.addEventListener("input", function () { setBgColor(refs.bgColorInput.value); });
    var bgSwWrap = el("div", { class: "itc-swatches itc-bg-swatches" });
    refs.bgSwatches = DARK_SWATCHES.map(function (c) {
      var sw = el("div", { class: "itc-sw", title: c, style: "background:" + brightenForDisplay(c) });
      sw.dataset.color = c;
      sw.addEventListener("click", function () { setBgColor(c); });
      bgSwWrap.appendChild(sw);
      return sw;
    });
    refs.bgCustom = buildCustomSquare(refs.bgColorInput, "Custom dark color (clamped)");
    bgSwWrap.appendChild(refs.bgCustom);
    var bgSection = el("div", { class: "itc-section" }, [
      el("p", { class: "itc-h", text: "Background" }),
      bgSwWrap,
      refs.bgColorInput,
    ]);

    refs.segGlobal = el("button", { type: "button", class: "itc-seg-btn", text: "Global" });
    refs.segGlobal.addEventListener("click", function () { if (perFolder) setScope(false); });
    refs.segProject = el("button", { type: "button", class: "itc-seg-btn", text: "This Project" });
    if (!folderKey) refs.segProject.disabled = true;
    refs.segProject.addEventListener("click", function () { if (folderKey && !perFolder) setScope(true); });
    refs.scopeHint = el("p", { class: "itc-hint" });
    var scopeSection = el("div", { class: "itc-section" }, [
      el("p", { class: "itc-h", text: "Scope" }),
      el("div", { class: "itc-seg" }, [refs.segGlobal, refs.segProject]),
      refs.scopeHint,
    ]);

    pop.appendChild(header);
    pop.appendChild(scopeSection);
    pop.appendChild(accentSection);
    pop.appendChild(bgSection);
    document.body.appendChild(pop);
    refreshSelections();
    return pop;
  }

  function openPopup() {
    injectStyle();
    buildPopup();
    var pop = document.getElementById(POPUP_ID);
    if (pop) pop.classList.remove("itc-hide");
    popupOpen = true;
    refreshSelections();
  }
  function closePopup() {
    var pop = document.getElementById(POPUP_ID);
    if (pop) pop.classList.add("itc-hide");
    popupOpen = false;
  }
  function togglePopup() {
    if (popupOpen) closePopup(); else openPopup();
  }

  try {
    // Dismissal runs in the CAPTURE phase: the workbench calls stopPropagation
    // on bubbling events, so a bubble-phase listener would never fire.
    document.addEventListener("mousedown", function (e) {
      if (!popupOpen) return;
      try {
        if (e.target && e.target.closest && e.target.closest("#" + POPUP_ID + ", #" + BTN_ID)) return;
      } catch (_) {}
      closePopup();
    }, true);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && popupOpen) closePopup();
    }, true);
  } catch (e) {}

  try {
    // Cross-window sync: localStorage is shared and storage fires only in the
    // OTHER windows. Skip while the popup is open so it cannot clobber a pick.
    window.addEventListener("storage", function (e) {
      try {
        if (e && e.key && e.key.indexOf("itc.") !== 0) return;
        if (popupOpen) return;
        loadState();
        applyState();
      } catch (_) {}
    }, false);
  } catch (e) {}

  function boot(tries) {
    var built = buildStatusItem();
    try { applyState(); } catch (e) {}
    if (!built && tries > 0) {
      requestAnimationFrame(function () { boot(tries - 1); });
      return;
    }

    try {
      var obs = new MutationObserver(function () {
        if (!document.getElementById(BTN_ID)) buildStatusItem();
        applyState();
      });
      obs.observe(document.body || document.documentElement, { childList: true });
    } catch (e) {}

    try {
      var sb = document.querySelector(".part.statusbar") || document.querySelector(".statusbar");
      if (sb) {
        var sbObs = new MutationObserver(function () {
          if (!document.getElementById(BTN_ID)) buildStatusItem();
        });
        sbObs.observe(sb, { childList: true, subtree: true });
      }
    } catch (e) {}
  }

  try { scrubLegacyImageState(); } catch (e) {}
  try { loadState(); } catch (e) {}

  function reloadIfSettled() {
    try { if (!popupOpen) { loadState(); applyState(); } } catch (e) {}
  }
  try {
    setTimeout(reloadIfSettled, 400);
    setTimeout(reloadIfSettled, 1200);
    setTimeout(reloadIfSettled, 3000);
  } catch (e) {}
  boot(180);
})();
