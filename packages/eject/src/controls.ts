import type { ParamDef } from '@rareshape/schema'

type OnChange = (value: unknown) => void

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue
    node.setAttribute(key, String(value))
  }
  for (const child of children) node.append(child)
  return node
}

const field = (label: string, body: Node, valueText?: () => string) => {
  const value = el('span', { class: 'rs-value' })
  const head = el('div', { class: 'rs-label' }, [el('span', {}, [label]), value])
  const wrap = el('div', { class: 'rs-field' }, [head, body])
  const sync = () => {
    if (valueText) value.textContent = valueText()
  }
  sync()
  return { wrap, sync }
}

/**
 * One control per param type, built with plain DOM. Deliberately the same
 * thirteen types as the React kit — the two read the same schema, so an ejected
 * file and the site cannot drift apart.
 */
export function buildControl(
  name: string,
  def: ParamDef,
  get: () => unknown,
  onChange: OnChange,
): { wrap: HTMLElement; sync: () => void } {
  const id = `p-${name}`

  switch (def.type) {
    case 'number':
    case 'int': {
      const step = def.step ?? (def.type === 'int' ? 1 : (def.max - def.min) / 100)
      const range = el('input', { type: 'range', id, min: def.min, max: def.max, step })
      const number = el('input', { type: 'number', min: def.min, max: def.max, step })
      const row = el('div', { class: 'rs-row' }, [range, el('div', { style: 'width:72px;flex:none' }, [number])])
      const f = field(def.label, row, () => `${fmt(get() as number)}${def.unit ? ` ${def.unit}` : ''}`)
      const push = (value: string) => onChange(Number(value))
      range.oninput = () => push(range.value)
      number.oninput = () => push(number.value)
      f.sync = withSync(f.sync, () => {
        range.value = String(get())
        number.value = String(get())
      })
      return f
    }

    case 'range': {
      const step = def.step ?? (def.max - def.min) / 100
      const lo = el('input', { type: 'range', id, min: def.min, max: def.max, step })
      const hi = el('input', { type: 'range', min: def.min, max: def.max, step })
      const row = el('div', {}, [lo, hi])
      const f = field(def.label, row, () => {
        const [a, b] = get() as [number, number]
        return `${fmt(a)} – ${fmt(b)}`
      })
      lo.oninput = () => onChange([Math.min(Number(lo.value), Number(hi.value)), Number(hi.value)])
      hi.oninput = () => onChange([Number(lo.value), Math.max(Number(hi.value), Number(lo.value))])
      f.sync = withSync(f.sync, () => {
        const [a, b] = get() as [number, number]
        lo.value = String(a)
        hi.value = String(b)
      })
      return f
    }

    case 'boolean': {
      const button = el('button', { type: 'button', id, 'aria-pressed': 'false' }, ['Off'])
      const f = field(def.label, button)
      button.onclick = () => onChange(!(get() as boolean))
      f.sync = withSync(f.sync, () => {
        const on = get() === true
        button.setAttribute('aria-pressed', String(on))
        button.textContent = on ? 'On' : 'Off'
      })
      return f
    }

    case 'select': {
      const select = el('select', { id })
      for (const option of def.options) {
        select.append(el('option', { value: option.value }, [option.label ?? option.value]))
      }
      const f = field(def.label, select)
      select.onchange = () => onChange(select.value)
      f.sync = withSync(f.sync, () => {
        select.value = String(get())
      })
      return f
    }

    case 'color': {
      const swatch = el('input', { type: 'color', id })
      const hex = el('input', { type: 'text' })
      const row = el('div', { class: 'rs-row' }, [swatch, hex])
      const f = field(def.label, row)
      swatch.oninput = () => onChange(swatch.value)
      hex.onchange = () => onChange(hex.value)
      f.sync = withSync(f.sync, () => {
        const value = String(get())
        swatch.value = value.slice(0, 7)
        hex.value = value
      })
      return f
    }

    case 'palette': {
      const row = el('div', { class: 'rs-row', id, style: 'flex-wrap:wrap' })
      const f = field(def.label, row, () => String((get() as string[]).length))
      f.sync = withSync(f.sync, () => {
        row.replaceChildren()
        const colors = get() as string[]
        colors.forEach((color, index) => {
          const swatch = el('input', { type: 'color', value: color.slice(0, 7) })
          swatch.oninput = () => onChange(colors.map((c, i) => (i === index ? swatch.value : c)))
          row.append(swatch)
        })
      })
      return f
    }

    case 'numbers': {
      const row = el('div', { class: 'rs-row', id, style: 'flex-wrap:wrap' })
      const f = field(def.label, row, () => String((get() as number[]).length))
      f.sync = withSync(f.sync, () => {
        row.replaceChildren()
        const entries = get() as number[]
        entries.forEach((entry, index) => {
          const input = el('input', {
            type: 'number',
            min: def.min,
            max: def.max,
            step: def.step ?? 0.05,
            value: entry,
            style: 'width:64px',
          })
          input.oninput = () =>
            onChange(entries.map((v, i) => (i === index ? Number(input.value) : v)))
          row.append(input)
        })
      })
      return f
    }

    case 'angle': {
      const number = el('input', { type: 'number', id, step: def.step ?? 1 })
      const f = field(def.label, number, () => `${Math.round(get() as number)}°`)
      number.oninput = () => onChange(Number(number.value))
      f.sync = withSync(f.sync, () => {
        number.value = String(get())
      })
      return f
    }

    case 'point': {
      const dot = el('i')
      const pad = el('div', { class: 'rs-pad', id }, [dot])
      const f = field(def.label, pad, () => {
        const p = get() as { x: number; y: number }
        return `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`
      })
      let dragging = false
      const emit = (event: PointerEvent) => {
        const rect = pad.getBoundingClientRect()
        onChange({
          x: clamp01((event.clientX - rect.left) / rect.width),
          y: clamp01((event.clientY - rect.top) / rect.height),
        })
      }
      pad.onpointerdown = (event) => {
        dragging = true
        pad.setPointerCapture(event.pointerId)
        emit(event)
      }
      pad.onpointermove = (event) => dragging && emit(event)
      pad.onpointerup = () => {
        dragging = false
      }
      f.sync = withSync(f.sync, () => {
        const p = get() as { x: number; y: number }
        dot.style.left = `${p.x * 100}%`
        dot.style.top = `${p.y * 100}%`
      })
      return f
    }

    case 'text': {
      const input = el('input', { type: 'text', id, placeholder: def.placeholder ?? '' })
      const f = field(def.label, input)
      input.oninput = () => onChange(input.value)
      f.sync = withSync(f.sync, () => {
        if (input.value !== get()) input.value = String(get())
      })
      return f
    }

    case 'seed': {
      const number = el('input', { type: 'number', id, step: 1, min: 0 })
      const next = el('button', { type: 'button' }, ['Next'])
      const row = el('div', { class: 'rs-row' }, [number, next])
      const f = field(def.label, row)
      number.oninput = () => onChange(Number(number.value))
      next.onclick = () => onChange((get() as number) + 1)
      f.sync = withSync(f.sync, () => {
        number.value = String(get())
      })
      return f
    }

    case 'curve': {
      const inputs = [0, 1, 2, 3].map(() => el('input', { type: 'number', step: 0.01 }))
      const row = el('div', { class: 'rs-row', id }, inputs)
      const f = field(def.label, row, () => (get() as number[]).map((v) => v.toFixed(2)).join(' '))
      inputs.forEach((input, index) => {
        input.oninput = () => {
          const next = [...(get() as number[])]
          next[index] = Number(input.value)
          onChange(next)
        }
      })
      f.sync = withSync(f.sync, () => {
        const value = get() as number[]
        inputs.forEach((input, index) => {
          input.value = String(value[index])
        })
      })
      return f
    }
  }
}

const withSync = (base: () => void, extra: () => void) => () => {
  base()
  extra()
}
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4))))
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
