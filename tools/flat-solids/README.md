# Flat Solids

Flat shapes extruded into solids.

There is no camera here and no z-axis. A solid is one flat face, plus the faces
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
- Where an arrangement's rotation happens decides what the scene is. Turned
  before the tip, every solid lies in the same plane — a **Ring** on the
  ground, squashed by exactly as much as the faces are. Turned after, it stands
  up and faces you, pivoting on the picture surface — a **Fan** of blades.
  Neither is more correct, so the arrangement picks.
- Painter's order is per arrangement rather than one global rule, because which
  end of the pile is nearest genuinely differs: a **Stack** is seen from above
  so its top solid covers the rest, while a **Row** just overlaps one way.
- Still, on purpose. The solidity is three flat colors holding an illusion, and
  the illusion does not survive being moved: rotate a fake solid and the eye
  reads the shear for what it is. `Seed` moves `Scatter` around instead.
