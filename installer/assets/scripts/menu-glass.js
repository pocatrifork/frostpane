(function () {
  // The editor right-click menu renders in an OPEN shadow root
  // (editor.useShadowDOM, not configurable) that workbench CSS cannot reach, so
  // patch Element.attachShadow to inject this glass stylesheet into each menu
  // shadow root. Keep it in sync with .monaco-menu-container in settings.json.
  const CSS = `
.monaco-menu-container {
  background-color: color-mix(in srgb, var(--frostpane-bg-canvas, #111111) 38%, transparent) !important;
  backdrop-filter: blur(12px) saturate(1.5) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.5) !important;
  border: 1px solid rgba(255,255,255,0.18) !important;
  border-radius: var(--frostpane-widget-radius, 10px) !important;
  box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.12), 0 8px 24px 0 rgba(0,0,0,0.5) !important;
  overflow: visible !important;
}
.monaco-submenu {
  background-color: color-mix(in srgb, var(--frostpane-bg-canvas, #111111), #ffffff 5%) !important;
  border: 1px solid rgba(255,255,255,0.18) !important;
  border-radius: var(--frostpane-widget-radius, 10px) !important;
  box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.12), 0 8px 24px 0 rgba(0,0,0,0.5) !important;
  overflow: visible !important;
}
.monaco-menu-container .monaco-scrollable-element,
.monaco-menu-container .monaco-menu,
.monaco-menu-container .monaco-action-bar,
.monaco-menu-container .monaco-action-bar.vertical {
  background: transparent !important;
  background-color: transparent !important;
}
.monaco-menu .monaco-action-bar.vertical {
  padding: 4px !important;
}
.monaco-menu .monaco-action-bar.vertical .action-item .action-menu-item {
  border-radius: var(--frostpane-item-radius, 4px) !important;
}
.monaco-menu .monaco-action-bar.vertical .action-item.focused > .action-menu-item,
.monaco-menu .monaco-action-bar.vertical .action-menu-item:hover {
  background-color: color-mix(in srgb, var(--frostpane-accent, #6cb4ff) 30%, transparent) !important;
  border-radius: var(--frostpane-item-radius, 4px) !important;
}
`;

  function inject(root) {
    if (!root || typeof root.querySelector !== "function") return;
    if (root.querySelector("style[data-glass-menu]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-glass-menu", "");
    style.textContent = CSS;
    root.appendChild(style);
  }

  const proto = Element.prototype;
  const orig = proto.attachShadow;
  if (typeof orig === "function" && !orig.__glassPatched) {
    const patched = function (init) {
      const root = orig.call(this, init);
      try {
        if (this.classList && this.classList.contains("shadow-root-host")) {
          inject(root);
        }
      } catch (e) {  }
      return root;
    };
    patched.__glassPatched = true;
    proto.attachShadow = patched;
  }

  try {
    document.querySelectorAll(".shadow-root-host").forEach(function (host) {
      inject(host.shadowRoot);
    });
  } catch (e) {  }
})();
