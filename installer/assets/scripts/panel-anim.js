(function () {
  "use strict";

  const DUR = 240;
  const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
  const Z_INDEX = 1500;
  const PART_SELECTORS = [".part.sidebar", ".part.auxiliarybar", ".part.panel"];
  const GEOM = ["left", "top", "width", "height"];

  const SHELL_PROPS = [
    "background-color", "background-image",
    "backdrop-filter", "-webkit-backdrop-filter",
    "border-top-width", "border-top-style", "border-top-color",
    "border-right-width", "border-right-style", "border-right-color",
    "border-bottom-width", "border-bottom-style", "border-bottom-color",
    "border-left-width", "border-left-style", "border-left-color",
    "border-top-left-radius", "border-top-right-radius",
    "border-bottom-right-radius", "border-bottom-left-radius",
    "box-shadow",
  ];

  const state = {};
  const partCache = {};
  let slotGeom = new Map();
  let animating = false;
  let endTimer = 0;
  const cleanups = [];
  let overlay = null;

  function getOverlay() {
    if (overlay && document.body.contains(overlay)) return overlay;
    overlay = document.createElement("div");
    overlay.className = "glass-anim-overlay";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", margin: "0",
      pointerEvents: "none", overflow: "hidden", zIndex: String(Z_INDEX),
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function slotOf(el) { return el && el.closest(".split-view-view"); }
  function isVisible(el) { const s = slotOf(el); return !!(s && s.classList.contains("visible")); }
  function geomOf(el) { const s = el.style; return { left: s.left, top: s.top, width: s.width, height: s.height }; }

  function edgeFor(sel, el, rect) {
    if (sel === ".part.panel") {
      if (el.classList.contains("top")) return "top";
      if (el.classList.contains("left")) return "left";
      if (el.classList.contains("right")) return "right";
      if (el.classList.contains("bottom")) return "bottom";

      if (rect && rect.height && rect.width >= rect.height) return "bottom";
      return rect && rect.left < window.innerWidth / 2 ? "left" : "right";
    }

    const center = rect ? rect.left + rect.width / 2 : 0;
    return center < window.innerWidth / 2 ? "left" : "right";
  }
  function edgeTransform(edge, amount) {
    switch (edge) {
      case "left":  return "translateX(-" + amount + ")";
      case "right": return "translateX(" + amount + ")";
      case "top":   return "translateY(-" + amount + ")";
      default:      return "translateY(" + amount + ")";
    }
  }

  function snapshotStyles(el) {
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of SHELL_PROPS) o[p] = cs.getPropertyValue(p);
    return o;
  }

  // FLIP: each part sits in a .split-view-view slot positioned by INLINE
  // geometry. Snapshot slot rects + styles, then animate neighbors from old to
  // new positions when the grid relayouts.
  function snapshot() {
    if (animating) return;
    const next = new Map();
    document.querySelectorAll(".monaco-grid-view .split-view-view").forEach((el) => {
      next.set(el, geomOf(el));
    });
    slotGeom = next;
    for (const sel of PART_SELECTORS) {
      const el = document.querySelector(sel);
      if (!el || !isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      partCache[sel] = {
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        styles: snapshotStyles(el),
      };
    }
  }

  function armEnd() {
    animating = true;
    if (endTimer) clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      endTimer = 0;
      while (cleanups.length) { try { cleanups.pop()(); } catch (e) {} }
      animating = false;
      snapshot();
    }, DUR + 90);
  }

  function animateInPart(el, slot) {
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const edge = edgeFor(PART_SELECTORS.find((s) => el.matches(s)), el, rect);
      const prevOverflow = slot ? slot.style.overflow : "";
      if (slot) slot.style.overflow = "hidden";
      el.style.willChange = "transform, opacity";
      el.style.transition = "none";
      el.style.transform = edgeTransform(edge, "100%");
      el.style.opacity = "0";
      void el.offsetWidth;
      el.style.transition = "transform " + DUR + "ms " + EASE + ", opacity " + DUR + "ms " + EASE;
      el.style.transform = "";
      el.style.opacity = "";
      cleanups.push(() => {
        el.style.transition = ""; el.style.transform = "";
        el.style.opacity = ""; el.style.willChange = "";
        if (slot) slot.style.overflow = prevOverflow;
      });
    } catch (e) {}
  }

  // The real slot goes display:none instantly on hide, so slide/fade a cloned
  // glass shell (fixed over the old rect) instead of the slot itself.
  function animateOutPart(sel, el) {
    try {
      const c = partCache[sel];
      if (!c) return;
      const { rect, styles } = c;
      const edge = edgeFor(sel, el, rect);
      const clone = document.createElement("div");
      Object.assign(clone.style, {
        position: "fixed", boxSizing: "border-box", pointerEvents: "none",
        left: rect.left + "px", top: rect.top + "px",
        width: rect.width + "px", height: rect.height + "px",
        opacity: "1", transform: "none",
      });
      for (const p of SHELL_PROPS) {
        if (styles[p]) { try { clone.style.setProperty(p, styles[p]); } catch (e) {} }
      }
      clone.style.transition = "transform " + DUR + "ms " + EASE + ", opacity " + DUR + "ms " + EASE;
      getOverlay().appendChild(clone);
      void clone.offsetWidth;
      clone.style.transform = edgeTransform(edge, "100%");
      clone.style.opacity = "0";
      setTimeout(() => { try { clone.remove(); } catch (e) {} }, DUR + 160);
    } catch (e) {}
  }

  function flipNeighbors(excludeSlot) {
    try {
      document.querySelectorAll(".monaco-grid-view .split-view-view").forEach((el) => {
        if (el === excludeSlot) return;
        if (!el.classList.contains("visible")) return;
        const old = slotGeom.get(el);
        if (!old) return;
        const neu = geomOf(el);
        const props = GEOM.filter((p) => neu[p] && old[p] && neu[p] !== old[p]);
        if (!props.length) return;
        el.style.transition = "none";
        for (const p of props) el.style[p] = old[p];
        void el.offsetWidth;
        el.style.transition = props.map((p) => p + " " + DUR + "ms " + EASE).join(", ");
        for (const p of props) el.style[p] = neu[p];
        cleanups.push(() => { el.style.transition = ""; });
      });
    } catch (e) {}
  }

  function check(animate) {
    for (const sel of PART_SELECTORS) {
      const el = document.querySelector(sel);
      const slot = slotOf(el);
      const vis = !!(el && slot && slot.classList.contains("visible"));
      const prev = state[sel];
      if (animate && prev !== undefined && vis !== prev) {
        armEnd();
        if (vis) animateInPart(el, slot);
        else animateOutPart(sel, el);
        flipNeighbors(vis ? slot : null);
      }
      state[sel] = vis;
    }
  }

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target;
      if (t && t.nodeType === 1 && t.classList && t.classList.contains("split-view-view")) {
        check(true);
        return;
      }
    }
  });

  function boot(tries) {
    let grid, editor, workbench;
    try {
      grid = document.querySelector(".monaco-grid-view");
      editor = document.querySelector(".part.editor");
      workbench = document.querySelector(".monaco-workbench");
    } catch (e) {}
    if (!grid || !editor || !workbench) {
      if (tries > 0) requestAnimationFrame(() => boot(tries - 1));
      return;
    }
    check(false);
    snapshot();
    observer.observe(workbench, { attributes: true, attributeFilter: ["class"], subtree: true });
    try { new ResizeObserver(() => snapshot()).observe(editor); } catch (e) {}
    window.addEventListener("resize", () => snapshot(), { passive: true });
  }

  boot(180);
})();
