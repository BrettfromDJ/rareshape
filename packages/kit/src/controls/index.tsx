'use client'

import type { ParamDef, Point, Span, Curve as CurveValue } from '@rareshape/schema'
import { SliderControl } from './Slider'
import { RangeControl } from './Range'
import { SwitchControl } from './Switch'
import { SelectControl } from './Select'
import { ColorControl, PaletteControl } from './Color'
import { NumbersControl } from './Numbers'
import { AngleControl } from './Angle'
import { PointControl } from './PointPad'
import { TextControl } from './Text'
import { SeedControl } from './Seed'
import { CurveControl } from './Curve'

/**
 * One dispatcher, one control per param type. Nothing else in the repo decides
 * how a param looks — which is why a tool never writes interface code.
 */
export function Control({
  name,
  def,
  value,
  onChange,
}: {
  name: string
  def: ParamDef
  value: unknown
  onChange: (value: unknown) => void
}) {
  switch (def.type) {
    case 'number':
    case 'int':
      return <SliderControl name={name} def={def} value={value as number} onChange={onChange} />
    case 'range':
      return <RangeControl name={name} def={def} value={value as Span} onChange={onChange} />
    case 'boolean':
      return <SwitchControl name={name} def={def} value={value as boolean} onChange={onChange} />
    case 'select':
      return <SelectControl name={name} def={def} value={value as string} onChange={onChange} />
    case 'color':
      return <ColorControl name={name} def={def} value={value as string} onChange={onChange} />
    case 'palette':
      return <PaletteControl name={name} def={def} value={value as string[]} onChange={onChange} />
    case 'numbers':
      return <NumbersControl name={name} def={def} value={value as number[]} onChange={onChange} />
    case 'angle':
      return <AngleControl name={name} def={def} value={value as number} onChange={onChange} />
    case 'point':
      return <PointControl name={name} def={def} value={value as Point} onChange={onChange} />
    case 'text':
      return <TextControl name={name} def={def} value={value as string} onChange={onChange} />
    case 'seed':
      return <SeedControl name={name} def={def} value={value as number} onChange={onChange} />
    case 'curve':
      return <CurveControl name={name} def={def} value={value as CurveValue} onChange={onChange} />
  }
}

export {
  SliderControl,
  RangeControl,
  SwitchControl,
  SelectControl,
  ColorControl,
  PaletteControl,
  NumbersControl,
  AngleControl,
  PointControl,
  TextControl,
  SeedControl,
  CurveControl,
}
