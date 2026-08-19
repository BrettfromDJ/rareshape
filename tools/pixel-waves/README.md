# Pixel Waves

Wave bands quantised to a pixel grid.

Each band samples a wave once per column, then snaps both of its edges to whole
grid cells — the `Step` control snaps to blocks of cells instead of single ones,
which is what produces the coarse staircase. The tension between the smooth
underlying curve and the hard grid is the whole idea; smooth it out and you have
an ordinary area chart.

## Notes

- The wave is a travelling sine mixed with 3D noise. `Roughness` crossfades
  between them: 0 is a clean sine, 1 is pure noise.
- The animation loops because both terms are periodic over `t`: the sine moves
  by whole turns (`Drift` is an integer for exactly this reason), and the noise
  is sampled around a circle rather than along a line.
- Each band is one staircase polygon, not a rect per column: abutting rects
  leave hairline seams where their antialiased edges meet, and the polygon is a
  fraction of the nodes.
- The grid is painted last, over the bands, and takes its tint from whatever is
  underneath it through `mix-blend-mode`. Overlay stays visible on dark and
  light alike; multiply behaves like ink printed on paper and disappears into
  black. The whole drawing is isolated, so the blend never reaches the page
  behind the artwork.
- `Fill` decides how a band relates to the canvas: floating **ribbons**, masses
  anchored to the nearest **edge**, or a **stacked** area chart.
