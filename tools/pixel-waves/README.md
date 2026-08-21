# Pixel Waves

Wave bands quantised to a pixel grid.

Each band samples a wave once per column, then snaps both of its edges to whole
grid cells — the `Step` control snaps to blocks of cells instead of single ones,
which is what produces the coarse staircase. The tension between the smooth
underlying curve and the hard grid is the whole idea; smooth it out and you have
an ordinary area chart.

## Notes

- `Step height` and `Step width` are the rise and the run. The tread used to be
  the cell width, so the only way to get chunky stairs was a coarse grid — one
  slider fighting itself. The wave is now sampled once per tread and held
  across it, which leaves the grid free to stay fine.
- `Dither` scatters cells outward from each band edge, thinning with distance,
  using an ordered 4×4 Bayer screen. Ordered rather than random so the pattern
  stays fixed in space and the edge sweeps through it — a random screen drags a
  cloud of fizz along with the band. An edge sitting on the canvas boundary is
  left alone: there is nothing behind it to fade into.

- The wave is a travelling sine mixed with 3D noise. `Roughness` crossfades
  between them: 0 is a clean sine, 1 is pure noise.
- The animation loops because both terms are periodic over `t`: the sine moves
  by whole turns (`Drift` is an integer for exactly this reason), and the noise
  is sampled around a circle rather than along a line.
- Each band is one staircase polygon, not a rect per column: abutting rects
  leave hairline seams where their antialiased edges meet, and the polygon is a
  fraction of the nodes.
- The grid is drawn per region — once over the paper, then once per band,
  clipped to it — each in a color already blended with what it sits on.
- Two things it deliberately does not use, because both look right in a browser
  and vanish in the tools people actually open exports in: `mix-blend-mode`
  (the tint is computed instead) and `<pattern>` fills (the grid is real line
  geometry). At 320 columns that is a few dozen KB of straight lines and still
  60fps on screen.
- Rows never exceed 120. They follow from the columns so that a cell stays
  square, which means a tall frame at a high column count runs to hundreds of
  them, and a grid that fine is a texture rather than graph paper. The ceiling
  is applied by holding the columns back, not by squashing the rows — capping
  the rows on their own would stretch every cell, and square cells are the
  point. The cost is that the Columns slider saturates sooner the taller the
  frame: around 213 at 16:9, around 96 at 4:5.
- `Grid weight` and `Grid blend` are both pinned against randomize. A heavier
  rule and a chosen blend mode are deliberate decisions: rolling the weight
  produced results veiled in grid color, and rolling the blend landed on
  `none`, which paints one flat grid color across the whole frame.
- The grid rule is capped at a fraction of its own cell. A stroke that is wide
  relative to the cell stops being a rule and becomes a veil — at 200 columns a
  2px line covers a third of every cell in both directions, and the grid color
  takes the frame over from the bands. `Grid weight` keeps its full range
  wherever the cells are big enough to carry a heavy rule.
- `Multiply` is the default and what randomize holds it at. `Auto` darkens the
  grid on light grounds and lightens it on dark ones, so it stays visible on
  white and black alike. The other modes are the standard
  blend equations, computed rather than delegated.
- `Fill` decides how a band relates to the canvas: floating **ribbons**, masses
  anchored to the nearest **edge**, or a **stacked** area chart.
- In edge mode the anchored edge is the canvas edge, not a grid line. Snapping
  it would round to the nearest multiple of `Step` and land short whenever the
  row count is not a multiple of it — a sliver of bare paper along the edge.
  The inner edge is still snapped, and every band keeps at least one row
  against its own edge so a large `Amplitude` cannot push it off the canvas.
- `Fill` is pinned against randomize: ribbons float and stacks leave the top
  open, so a re-roll would hand back a composition with paper strips across it.
