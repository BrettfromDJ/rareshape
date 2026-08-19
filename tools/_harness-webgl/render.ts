import * as THREE from 'three'
import { TAU, makeRng, parseColor, type Frame, type GlRenderer } from '@rareshape/core'
import type { Params } from './tool'

/**
 * WebGL tools hand back a renderer rather than drawing directly, because the
 * export path needs its own context: `preserveDrawingBuffer` is required to
 * read pixels back and is too expensive to leave on for the screen.
 */
export function create(canvas: HTMLCanvasElement | OffscreenCanvas): GlRenderer<Params> {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas as HTMLCanvasElement,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  })
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 0, 7)

  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(2, 3, 4)
  scene.add(key)

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 })
  let mesh = new THREE.InstancedMesh(geometry, material, 1)
  scene.add(mesh)
  let capacity = 1

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const clearColor = new THREE.Color()

  const ensure = (count: number) => {
    if (count <= capacity) return
    scene.remove(mesh)
    mesh.dispose()
    mesh = new THREE.InstancedMesh(geometry, material, count)
    capacity = count
    scene.add(mesh)
  }

  return {
    resize(width, height, dpr) {
      renderer.setPixelRatio(1) // the canvas is already sized in device pixels
      renderer.setSize(Math.round(width * dpr), Math.round(height * dpr), false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },

    draw(frame: Frame<Params>) {
      const { params, t } = frame
      const rng = makeRng(params.seed)
      ensure(params.count)
      mesh.count = params.count

      material.wireframe = params.wireframe
      const ink = parseColor(params.ink)
      const ground = parseColor(params.background)
      // Colours arrive as sRGB hex; say so, or three treats them as linear and
      // the exported background comes back several stops too light.
      clearColor.setRGB(ground.r / 255, ground.g / 255, ground.b / 255, THREE.SRGBColorSpace)
      renderer.setClearColor(clearColor, ground.a)

      const spin = t * TAU * params.spin

      for (let i = 0; i < params.count; i++) {
        const u = params.count === 1 ? 0 : i / (params.count - 1)
        const jitter = rng()
        const angle = u * TAU * params.twist + spin
        const y = (u - 0.5) * params.radius * 2.4
        const r = params.radius * Math.cos(u * Math.PI - Math.PI / 2) * 0.9 + params.radius * 0.35

        dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r)
        dummy.rotation.set(angle, angle * 0.5 + jitter * TAU, spin)
        const scale = params.size * (0.6 + jitter * 0.8)
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)

        const shade = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 + t * TAU))
        color.setRGB(
          (ink.r / 255) * shade,
          (ink.g / 255) * shade,
          (ink.b / 255) * shade,
          THREE.SRGBColorSpace,
        )
        mesh.setColorAt(i, color)
      }

      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

      // One full cycle over t, so the camera returns to its starting point.
      camera.position.set(Math.sin(t * TAU) * 1.2, 0.6, 7)
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    },

    dispose() {
      geometry.dispose()
      material.dispose()
      mesh.dispose()
      renderer.dispose()
    },
  }
}
