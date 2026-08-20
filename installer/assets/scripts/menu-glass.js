(function () {
  // The editor right-click menu renders in an OPEN shadow root
  // (editor.useShadowDOM, not configurable) that workbench CSS cannot reach, so
  // patch Element.attachShadow to inject the same frost into each menu shadow
  // root. Keep in sync with .monaco-menu-container in settings.json.
  //
  // Custom properties inherit through a shadow boundary, so the colour still
  // comes from whatever the Frostpane picker last derived.
  const CSS = `
.monaco-menu-container {
  background-color: color-mix(in srgb, var(--vscode-menu-background) 45%, transparent) !important;
  backdrop-filter: blur(14px) saturate(1.4) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.4) !important;
  /* backdrop-filter turns this into a containing block, and the stock
     overflow:hidden then clips side submenus out of existence. */
  overflow: visible !important;
}
.monaco-submenu {
  background-color: color-mix(in srgb, var(--vscode-menu-background), #ffffff 4%) !important;
  overflow: visible !important;
}
.monaco-menu-container .monaco-scrollable-element,
.monaco-menu-container .monaco-menu,
.monaco-menu-container .monaco-action-bar,
.monaco-menu-container .monaco-action-bar.vertical {
  background: transparent !important;
  background-color: transparent !important;
}
`;

  function inject(root) {
    if (!root || typeof root.querySelector !== "function") return;
    if (root.querySelector("style[data-frostpane-menu]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-frostpane-menu", "");
    style.textContent = CSS;
    root.appendChild(style);
  }

  const proto = Element.prototype;
  const orig = proto.attachShadow;
  if (typeof orig === "function" && !orig.__frostpanePatched) {
    const patched = function (init) {
      const root = orig.call(this, init);
      try {
        if (this.classList && this.classList.contains("shadow-root-host")) inject(root);
      } catch (e) {  }
      return root;
    };
    patched.__frostpanePatched = true;
    proto.attachShadow = patched;
  }

  try {
    document.querySelectorAll(".shadow-root-host").forEach(function (host) {
      inject(host.shadowRoot);
    });
  } catch (e) {  }
})();
