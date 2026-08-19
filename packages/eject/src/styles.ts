/** The site's tokens, inlined. An ejected file has no stylesheet to load. */
export const SHELL_CSS = `
:root {
  --bg: #0a0a0a;
  --surface: #131313;
  --line: #222222;
  --text: #f0f0f0;
  --dim: #8a8a8a;
  --faint: #4a4a4a;
  --mono: ui-monospace, "SF Mono", Menlo, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
* { box-sizing: border-box; border-radius: 0; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font-family: var(--sans); }
body { display: flex; flex-direction: column; }
a { color: inherit; }
.rs-head { display: flex; align-items: center; gap: 16px; height: 48px; padding: 0 16px; border-bottom: 1px solid var(--line); }
.rs-title { font-size: 15px; }
.rs-tagline { font-size: 13px; color: var(--dim); }
.rs-meta { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
.rs-body { flex: 1; min-height: 0; display: flex; }
.rs-rail { width: 304px; flex: none; overflow-y: auto; background: var(--surface); border-right: 1px solid var(--line); }
.rs-stage { flex: 1; min-width: 0; display: grid; place-items: center; padding: 24px; }
.rs-frame { position: relative; border: 1px solid var(--line); max-width: 100%; max-height: 100%; }
.rs-frame > * { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.rs-group { font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text); padding: 20px 16px 10px; border-top: 1px solid var(--faint); }
.rs-field { padding: 12px 16px; border-bottom: 1px solid var(--line); }
.rs-label { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
.rs-label span:first-child { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
.rs-value { font-family: var(--mono); font-size: 11px; color: var(--text); font-variant-numeric: tabular-nums; }
.rs-row { display: flex; align-items: center; gap: 8px; }
input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; height: 20px; flex: 1; width: 100%; cursor: pointer; }
input[type="range"]::-webkit-slider-runnable-track { height: 1px; background: var(--line); }
input[type="range"]::-moz-range-track { height: 1px; background: var(--line); }
input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 3px; height: 14px; margin-top: -7px; background: var(--text); }
input[type="range"]::-moz-range-thumb { width: 3px; height: 14px; background: var(--text); border: 0; border-radius: 0; }
input[type="number"], input[type="text"], select { background: var(--bg); color: var(--text); border: 1px solid var(--line); font-family: var(--mono); font-size: 11px; padding: 4px 6px; width: 100%; }
input[type="color"] { width: 24px; height: 24px; padding: 0; border: 1px solid var(--line); background: var(--bg); }
button { background: var(--bg); color: var(--dim); border: 1px solid var(--line); font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 8px; cursor: pointer; }
button:hover { color: var(--text); border-color: var(--faint); }
button[aria-pressed="true"] { background: var(--text); color: var(--bg); }
.rs-foot { display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 16px; border-top: 1px solid var(--line); }
.rs-actions { display: flex; flex-wrap: wrap; gap: 4px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.rs-pad { position: relative; width: 100%; max-width: 144px; aspect-ratio: 1; border: 1px solid var(--line); touch-action: none; cursor: crosshair; }
.rs-pad i { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; background: var(--text); }
@media (max-width: 800px) { .rs-body { flex-direction: column; } .rs-rail { width: 100%; border-right: 0; border-bottom: 1px solid var(--line); max-height: 45vh; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`
