# Flat Solids

A stack of slabs extruded into solids.

There is no camera here and no z-axis. A solid is one slab face, plus the faces
its edges sweep out when the whole thing is dragged in a single screen
direction. `Pitch` squashes the face vertically, which is all it takes to read
as a plane tipping away from you. Everything else is flat polygons and three
colors.

That is how this look is built in the poster work it comes from, and it is why
the SVG that comes out is a handful of shapes you can pull apart and recolor
rather than a mesh.

## Notes

- Every solid is dragged the same direction, and that shared direction is what
  makes a pile of unrelated shapes read as one scene lit from one side. It is
  pinned against randomize for the same reason a photographer does not move the
  light between frames.
- Which edges sweep a visible face is decided per edge, by whether its outward
  normal points the way the body is being dragged. The normal is found by
  pushing away from the centroid rather than by assuming a winding direction,
  so a shape wound the other way still works.
- A face per edge would leave a hairline seam everywhere two of them meet —
  down the side of a disc that is forty-seven seams. Each unbroken stretch of
  visible edges is swept as one polygon instead.
- The two side tones divide that sweep by painting, not by butting up against
  each other: the whole stretch goes down in one tone and the parts belonging
  to the other are painted over it. Abutting them would put the seam straight
  back on the boundary.
- The far face is drawn first, in whichever side tone is darker. It is hidden
  behind everything else until the body is dragged further than the shape is
  wide, which is the only time it has anything to say.
- One arrangement, one projection, one light. Six arrangements, a pitch slider
  and an extrusion direction all worked, and every one of them was another way
  to arrive at a picture that was not this one. What is left is a stack seen
  from a fixed isometric with the light overhead, and the controls that remain
  are about what is stacked rather than where you are standing.
- The pile is painted from the bottom up: seen from above, the top slab is the
  near one and covers the rest.
- Slabs and nothing else. Discs and hexes and wedges all worked, and all of
  them pulled the tool toward being a shape library rather than a way of
  building one kind of composition well.
- `Lengths` is a list the slabs take in turn, the way the faces take turns
  through the palette: one entry and they all match, three entries across nine
  slabs and the rhythm repeats every three. `Breadth` is shared and pinned
  against randomize — the lengths are what vary, and without a constant to read
  them against there is no rhythm to see.
- `Zoom` and `Position` are the frame. The composition is fitted first and
  framed second, so pushing Zoom past 1 and dragging Position is a crop of a
  composition that is bigger than the frame it sits in.
- The pitch is fixed at 60°, which with a 45° turn squashes a square to twice
  as wide as it is tall: the isometric everyone draws. `Turn` is the one angle
  left open, because spinning the face in its own plane changes what the slab
  is rather than where you are standing — and it is pinned against randomize
  for the same reason the projection is not a control at all.
- `Scatter` nudges position and nothing else. Giving each solid its own
  rotation as well meant a composition where everything sat at a different
  angle, and the shared projection is the whole illusion.
- Still, on purpose. The solidity is three flat colors holding an illusion, and
  the illusion does not survive being moved: rotate a fake solid and the eye
  reads the shear for what it is. `Seed` moves `Scatter` around instead.
