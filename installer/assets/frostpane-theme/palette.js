"use strict";

// Frostpane is two colours. This module expands them into the
// workbench.colorCustomizations block that paints the workbench, so the accent
// and the background each live in exactly one place.
//
// Nothing here touches VSCode: it is pure functions over hex strings, which
// keeps it testable with plain node.

var DEFAULTS = { accent: "#6cb4ff", background: "#181a1d" };

// The background stays dark: the theme is a dark theme, and a light canvas
// would leave every foreground colour in the theme file unreadable.
var MAX_L = 0.16;
var MAX_S = 0.6;

function normalizeHex(input) {
  if (typeof input !== "string") return null;
  var h = input.trim();
  if (h[0] !== "#") h = "#" + h;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
  return h.toLowerCase();
}

function hexToRgb(hex) {
  var h = normalizeHex(hex) || "#000000";
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
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
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h, s: s, l: l };
}

function hslToRgb(h, s, l) {
  if (s === 0) { var v = l * 255; return { r: v, g: v, b: v }; }
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
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

// Pull any picked background down into the dark range, keeping its hue.
function clampDark(hex) {
  var n = normalizeHex(hex);
  if (!n) return DEFAULTS.background;
  var rgb = hexToRgb(n);
  var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (hsl.l <= MAX_L && hsl.s <= MAX_S) return n;
  hsl.l = Math.min(hsl.l, MAX_L);
  hsl.s = Math.min(hsl.s, MAX_S);
  var out = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(out.r, out.g, out.b);
}

// amount is how much of `b` ends up in the result, 0..1.
function mix(a, b, amount) {
  var x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex(
    x.r + (y.r - x.r) * amount,
    x.g + (y.g - x.g) * amount,
    x.b + (y.b - x.b) * amount
  );
}

// VSCode colour keys take #rrggbbaa, so alpha is baked into the value.
function alpha(hex, a) {
  var n = normalizeHex(hex) || "#000000";
  var v = Math.max(0, Math.min(255, Math.round(a * 255))).toString(16);
  return n + (v.length === 1 ? "0" + v : v);
}

var REMOTE_FOREGROUND = "#8b93a1";
var FG_BRIGHT = "#e8ecf2";
var FG_MUTED = "#8b93a1";

// Text drawn on top of the accent. CSS cannot pick this - color-contrast() is
// not shipped - so an accent-aware foreground is something the native route
// buys us: a yellow accent gets dark text, an indigo one gets white.
function readableOn(hex) {
  var rgb = hexToRgb(hex);
  function lin(c) {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  var l = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  return l > 0.35 ? "#0a1014" : "#ffffff";
}

// Picker presets. Accents are unconstrained; backgrounds are near-black, which
// is why the picker brightens them for display only.
var ACCENT_PRESETS = [
  "#6cb4ff", "#8fc7ff", "#6c7bff", "#39c5cf", "#14c8a0",
  "#21c25e", "#7ee787", "#c3e645", "#ffe44d", "#c8a17a",
  "#ffa657", "#ff7b72", "#de2b55", "#ff6ac1", "#c46bff",
  "#9d6bff", "#d2a8ff", "#a5adba", "#ffffff",
];

var BACKGROUND_PRESETS = [
  "#181a1d", "#080808", "#10131a", "#1e0d12", "#0f1714",
  "#161a10", "#0a1a0e", "#0a1f1e", "#1d100a",
  "#110f24", "#170f20", "#1c0d1e",
];

// Names for the quick pick, which has no way to draw a swatch. Live preview
// does the showing; these just make the list readable.
var NAMES = {
  "#6cb4ff": "Blue", "#8fc7ff": "Sky", "#6c7bff": "Indigo", "#39c5cf": "Cyan",
  "#14c8a0": "Teal", "#21c25e": "Green", "#7ee787": "Mint", "#c3e645": "Lime",
  "#ffe44d": "Yellow", "#c8a17a": "Sand", "#ffa657": "Orange",
  "#ff7b72": "Salmon", "#de2b55": "Crimson", "#ff6ac1": "Pink",
  "#c46bff": "Orchid", "#9d6bff": "Violet", "#d2a8ff": "Lilac",
  "#a5adba": "Steel", "#ffffff": "White",
  "#181a1d": "Slate", "#080808": "Ink", "#10131a": "Midnight",
  "#1e0d12": "Wine", "#0f1714": "Pine", "#161a10": "Moss",
  "#0a1a0e": "Forest", "#0a1f1e": "Deep sea", "#1d100a": "Ember",
  "#110f24": "Indigo night", "#170f20": "Plum", "#1c0d1e": "Mulberry",
};

function nameOf(hex) {
  var n = normalizeHex(hex);
  return (n && NAMES[n]) || "Custom";
}

// Display-only lift: a grid of near-black squares is unreadable, so the swatch
// is drawn brighter than the colour it applies.
function brightenForDisplay(hex) {
  var rgb = hexToRgb(hex);
  var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.min(0.42, hsl.l + 0.24);
  hsl.s = Math.min(0.7, hsl.s * 1.35);
  var out = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(out.r, out.g, out.b);
}

function assign(target, keys, value) {
  for (var i = 0; i < keys.length; i++) target[keys[i]] = value;
  return target;
}

// Three tones, and the ordering is the point: the windows you work in are the
// darkest surface, the chrome around them sits at the colour you picked, and
// anything floating above goes lighter still. Flat surfaces read as muddy, so
// the separation is what makes a picked background legible.
// The picked colour IS the windows, and the chrome lifts away from it. Doing it
// this way round rather than darkening the windows keeps the separation visible
// at any darkness - a near-black pick has no room left to go darker - and it
// leaves the colour you chose on the surface you look at most.
var CHROME_LIFT = 0.05;
var ELEVATED_LIFT = 0.08;

// The windows: editor, sidebar, panel, terminal, and the active tab, which
// wants to merge into the editor below it.
var WINDOW_KEYS = [
  "editor.background", "editorGutter.background", "editorPane.background",
  "editorStickyScroll.background", "sideBar.background",
  "sideBarSectionHeader.background", "panel.background", "terminal.background",
  "breadcrumb.background", "welcomePage.background",
  "notebook.editorBackground",
  "tab.activeBackground", "tab.unfocusedActiveBackground",
  // Current VSCode paints the active tab through the *selected* keys, and
  // tab.selectedBackground otherwise defaults to a translucent list wash.
  "tab.selectedBackground",
];

// The chrome around them, at the picked colour: title bar, status bar, activity
// bar, and the tab strip the inactive tabs sit on.
var CHROME_KEYS = [
  "activityBar.background",
  "statusBar.background", "statusBar.noFolderBackground",
  "titleBar.activeBackground", "titleBar.inactiveBackground",
  "editorGroupHeader.tabsBackground", "editorGroupHeader.noTabsBackground",
  "tab.inactiveBackground", "tab.unfocusedInactiveBackground",
];

// Anything that floats above the canvas goes lighter by the same step.
var ELEVATED_KEYS = [
  "editorWidget.background", "editorHoverWidget.background",
  "editorHoverWidget.statusBarBackground", "editorSuggestWidget.background",
  "editorMarkerNavigation.background", "editorStickyScrollHover.background",
  "quickInput.background", "quickInputTitle.background",
  "dropdown.background", "dropdown.listBackground", "input.background",
  "menu.background", "notifications.background",
  "notificationCenterHeader.background", "banner.background",
  "peekViewEditor.background", "peekViewResult.background",
  "peekViewTitle.background", "debugToolBar.background",
  "commandCenter.background", "commandCenter.activeBackground",
  "breadcrumbPicker.background", "agentStatusIndicator.background",
];

// Hovers and selections are white washes rather than fixed greys, so they keep
// the hue of whatever background is picked instead of muddying it.
var WASH_KEYS = {
  "list.hoverBackground": 0.05,
  "list.focusBackground": 0.09,
  "list.activeSelectionBackground": 0.09,
  "list.inactiveSelectionBackground": 0.06,
  "quickInputList.focusBackground": 0.09,
  "toolbar.hoverBackground": 0.07,
  "statusBarItem.hoverBackground": 0.09,
  "statusBarItem.activeBackground": 0.13,
  "editor.lineHighlightBackground": 0.05,
  "scrollbarSlider.background": 0.10,
  "scrollbarSlider.hoverBackground": 0.16,
  "scrollbarSlider.activeBackground": 0.22,
};

// The accent at full strength: controls, indicators, borders, marks.
var ACCENT_KEYS = [
  "focusBorder", "sash.hoverBorder", "list.focusOutline",
  "settings.focusedRowBorder", "settings.modifiedItemIndicator",
  "list.highlightForeground", "list.focusHighlightForeground",
  "quickInputList.focusHighlightForeground",
  "editorSuggestWidget.highlightForeground",
  "editorSuggestWidget.focusHighlightForeground", "pickerGroup.foreground",
  "textLink.foreground", "notificationLink.foreground",
  "progressBar.background", "badge.background", "activityBarBadge.background",
  "statusBarItem.prominentBackground", "button.background",
  "extensionButton.prominentBackground", "extensionBadge.remoteBackground",
  "inputOption.activeBorder", "inputValidation.infoBorder",
  "textBlockQuote.border", "peekView.border", "panel.dropBorder",
  "panelTitle.activeBorder", "activityBar.activeBorder",
  "menubar.selectionBackground",
  "notebook.focusedCellBorder", "notebook.selectedCellBorder",
  "notificationsInfoIcon.foreground", "problemsInfoIcon.foreground",
  "editorInfo.foreground", "editorOverviewRuler.infoForeground",
  "editorGutter.modifiedBackground", "minimapGutter.modifiedBackground",
  "gitDecoration.modifiedResourceForeground",
  "gitDecoration.stageModifiedResourceForeground",
  "notebookStatusRunningIcon.foreground", "welcomePage.progress.foreground",
  "editorCursor.foreground", "terminalCursor.foreground",
];

// Text and icons drawn on top of a solid accent fill.
var ON_ACCENT_KEYS = [
  "button.foreground", "badge.foreground", "activityBarBadge.foreground",
  "statusBarItem.prominentForeground", "menubar.selectionForeground",
  "extensionButton.prominentForeground",
];

// A lift for the hovered state of anything already painted with the accent.
var ACCENT_LIFT_KEYS = [
  "textLink.activeForeground", "editorLink.activeForeground",
  "button.hoverBackground", "extensionButton.prominentHoverBackground",
];

// The accent behind text, so it has to stay transparent enough to read through.
// Terminal selection is in here now: as a colour key it just works, where the
// CSS route had to write into every live xterm instance by hand.
var ACCENT_WASH_KEYS = {
  "editor.selectionBackground": 0.20,
  "terminal.selectionBackground": 0.20,
  "terminal.inactiveSelectionBackground": 0.20,
  "list.dropBackground": 0.20,
  "sideBar.dropBackground": 0.20,
  "terminal.dropBackground": 0.20,
  "editorGroup.dropBackground": 0.20,
  "panelSection.dropBackground": 0.20,
  "menu.selectionBackground": 0.30,
  "editorSuggestWidget.selectedBackground": 0.17,
  "activityBar.activeBackground": 0.08,
  "editor.wordHighlightBackground": 0.13,
  "editor.findMatchBackground": 0.33,
  "editor.findMatchHighlightBackground": 0.13,
  "minimap.findMatchHighlight": 0.40,
};

// accent + background -> the whole colorCustomizations block.
function expand(accentIn, backgroundIn) {
  var accent = normalizeHex(accentIn) || DEFAULTS.accent;
  var bg = clampDark(backgroundIn);
  var window = bg;
  var chrome = mix(bg, "#ffffff", CHROME_LIFT);
  var elevated = mix(chrome, "#ffffff", ELEVATED_LIFT);
  var lift = mix(accent, "#ffffff", 0.18);

  var out = {};
  assign(out, WINDOW_KEYS, window);
  assign(out, CHROME_KEYS, chrome);
  assign(out, ELEVATED_KEYS, elevated);
  Object.keys(WASH_KEYS).forEach(function (k) {
    out[k] = alpha("#ffffff", WASH_KEYS[k]);
  });
  assign(out, ACCENT_KEYS, accent);
  assign(out, ON_ACCENT_KEYS, readableOn(accent));
  assign(out, ACCENT_LIFT_KEYS, lift);
  Object.keys(ACCENT_WASH_KEYS).forEach(function (k) {
    out[k] = alpha(accent, ACCENT_WASH_KEYS[k]);
  });

  // The active tab is picked out by its own background - it carries the window
  // colour, so it reads as the opening into the editor below - and by brighter
  // text, never by a line on top.
  //
  // tab.selectedBorderTop is the one that matters: current VSCode treats the
  // active tab as "selected" and that key DEFAULTS TO focusBorder, which is the
  // accent here. Clearing tab.activeBorderTop alone changes nothing, because in
  // this build nothing draws it.
  out["tab.selectedBorderTop"] = "#00000000";
  out["tab.selectedForeground"] = FG_BRIGHT;
  out["tab.activeBorderTop"] = "#00000000";
  out["tab.unfocusedActiveBorderTop"] = "#00000000";
  out["tab.activeBorder"] = "#00000000";
  out["tab.activeForeground"] = FG_BRIGHT;
  out["tab.inactiveForeground"] = FG_MUTED;
  out["tab.unfocusedActiveForeground"] = FG_MUTED;
  out["tab.unfocusedInactiveForeground"] = FG_MUTED;

  // The remote indicator ("WSL: Ubuntu") ships as a filled block in the
  // accent colour, which reads as a warning badge. It sits flat on the status
  // bar instead, which is what the earlier hand-written theme did too.
  out["statusBarItem.remoteBackground"] = "#00000000";
  out["statusBarItem.remoteForeground"] = REMOTE_FOREGROUND;
  out["statusBarItem.remoteHoverBackground"] = alpha("#ffffff", 0.09);
  return out;
}

// At the defaults the theme extension already paints these colours itself, so
// the block is redundant and Frostpane leaves settings.json alone.
function isDefault(accent, background) {
  return normalizeHex(accent) === DEFAULTS.accent
      && clampDark(background) === DEFAULTS.background;
}

module.exports = {
  DEFAULTS: DEFAULTS,
  ACCENT_PRESETS: ACCENT_PRESETS,
  BACKGROUND_PRESETS: BACKGROUND_PRESETS,
  brightenForDisplay: brightenForDisplay,
  nameOf: nameOf,
  normalizeHex: normalizeHex,
  clampDark: clampDark,
  mix: mix,
  alpha: alpha,
  readableOn: readableOn,
  expand: expand,
  isDefault: isDefault,
};
