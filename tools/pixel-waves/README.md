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
- Runs of columns at the same height are merged into one rect, so a 240-column
  grid still exports as a small SVG.
- `Fill` decides how a band relates to the canvas: floating **ribbons**, masses
  anchored to the nearest **edge**, or a **stacked** area chart.
