import * as math from './math.js'
import * as utils from './utils.js'
import { loadModel } from './gltf.js'
import { setCanvas } from './gl/context.js'
import { init, attribNames } from './gl.js'
import { createTexture, bindTexture, bindCubeMap } from './gl/texture.js'
import { getAnimationTransforms } from './anim/transform.js'

import type { Mat4 } from './types'
import type { Node, Skin } from './webgl-gltf/types/model'

const activeAnimations: { key: string; elapsed: number }[] = []

setCanvas('#canvas')
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const { gl, uniforms, attributes } = init()

let lastFrame = 0

const cam = { x: 0, y: 0, z: 0, rY: 0.0, rX: 0.0, distance: 3.0 }

const pMatrix = math.mat4()
const vMatrix = math.mat4()

const urlParams = new URLSearchParams(window.location.search)
const modelName = urlParams.get('model') || 'robot'
const model = await loadModel(`/models/${modelName}/${modelName}.gltf`)
const anims = Object.keys(model.animations)
if (anims.length) {
	pushAnimation(anims[0])
	const ui = document.getElementById('ui') as HTMLElement
	for (const a of anims) {
		const btn = document.createElement('button')
		btn.innerText = a
		btn.addEventListener('click', () => pushAnimation(a))
		ui.appendChild(btn)
	}
}

console.log(model)

const names = ['right', 'left', 'top', 'bottom', 'front', 'back']
const diffuse = names.map((n) => utils.getImage(`environment/diffuse_${n}.jpg`))
const specular = names.map((n) => utils.getImage(`environment/specular_${n}.jpg`))

await Promise.all([
	utils.getImage('environment/brdf_lut.png').then((img) => {
		const brdf = createTexture(gl.TEXTURE_2D, [[gl.TEXTURE_2D, img]])
		bindTexture(brdf, 5, uniforms.brdfLut)
	}),
	bindCubeMap(diffuse, 6, uniforms.environmentDiffuse),
	bindCubeMap(specular, 7, uniforms.environmentSpecular),
])

document.getElementById('loading')?.remove()
window.onresize = () => setSize()
computeCamera()
setSize()
render()

function render() {
	gl.clear(gl.COLOR_BUFFER_BIT)
	gl.uniformMatrix4fv(uniforms.viewMatrix, false, vMatrix)
	gl.uniformMatrix4fv(uniforms.projectionMatrix, false, pMatrix)
	gl.uniform3f(uniforms.cameraPosition, cam.x, cam.y, cam.z)

	const root = model.rootNode
	const active = activeAnimations.slice(-2)
	if (active.length) {
		// @ts-expect-error
		const axfs = new Map(getAnimationTransforms(model.animations, active))
		const applied = model.skins.flatMap((skin) => [...applyTransform(skin, math.mat4(), root, axfs)])
		for (const { idx, mat } of applied) {
			gl.uniformMatrix4fv(uniforms.jointTransform[idx], false, mat)
		}

		gl.uniform1i(uniforms.isAnimated, 1)
	} else {
		gl.uniform1i(uniforms.isAnimated, 0)
	}

	gl.uniformMatrix4fv(uniforms.modelMatrix, false, model.nodes[root].matrix)

	for (const n of walk(root)) {
		if (n.mesh === undefined) continue
		const mesh = model.meshes[n.mesh]
		const m = model.materials[mesh.material]
		if (m) {
			gl.uniform1f(uniforms.metallicFactor, m.metallicFactor)
			gl.uniform1f(uniforms.roughnessFactor, m.roughnessFactor)
			gl.uniform3f(uniforms.emissiveFactor, ...m.emissiveFactor)
			gl.uniform4f(uniforms.baseColorFactor, ...m.baseColorFactor)

			bindTexture(m.baseColorTexture, 0, uniforms.baseColorTexture, uniforms.hasBaseColorTexture)
			// prettier-ignore
			bindTexture(m.metallicRoughnessTexture, 1, uniforms.metallicRoughnessTexture, uniforms.hasMetallicRoughnessTexture)
			bindTexture(m.emissiveTexture, 2, uniforms.emissiveTexture, uniforms.hasEmissiveTexture)
			bindTexture(m.normalTexture, 3, uniforms.normalTexture, uniforms.hasNormalTexture)
			bindTexture(m.occlusionTexture, 4, uniforms.occlusionTexture, uniforms.hasOcclusionTexture)
		}

		for (const k of attribNames) {
			const buf = mesh[k]
			if (!buf) continue
			const pos = attributes[k]
			gl.enableVertexAttribArray(pos)
			gl.bindBuffer(gl.ARRAY_BUFFER, buf.buffer)
			gl.vertexAttribPointer(pos, buf.size, buf.type, false, 0, 0)
		}

		if (mesh.indices) {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices)
			gl.drawElements(gl.TRIANGLES, mesh.elementCount, gl.UNSIGNED_SHORT, 0)
		} else {
			gl.drawArrays(gl.TRIANGLES, 0, mesh.elementCount)
		}
	}

	advanceAnimation(performance.now() - lastFrame)
	requestAnimationFrame(() => {
		render()
		lastFrame = performance.now()
	})
}

const drag = (x: number, y: number) => {
	cam.rX += y
	cam.rY += x
	computeCamera()
}

const zoom = (delta: number) => {
	cam.distance *= 1.0 + delta
	if (cam.distance < 0.0) cam.distance = 0.0
	computeCamera()
}

const getPinchDistance = (evt: TouchEvent) => {
	const [a, b] = evt.touches
	return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

let lastPosition: { x: number; y: number } | undefined
let zoomStart: number | undefined

const dragEvent = (event) => {
	const client = event.touches
		? { x: event.touches[0].clientX, y: event.touches[0].clientY }
		: { x: event.clientX, y: event.clientY }

	if (lastPosition !== undefined) {
		drag((client.x - lastPosition.x) / 100.0, (client.y - lastPosition.y) / 100.0)
	}

	lastPosition = {
		x: client.x,
		y: client.y,
	}
}

canvas.addEventListener('wheel', (event) => {
	zoom(event.deltaY > 0 ? 0.05 : -0.05)
})

canvas.addEventListener('mousedown', () => {
	canvas.addEventListener('mousemove', dragEvent)
})

canvas.addEventListener('mouseup', () => {
	canvas.removeEventListener('mousemove', dragEvent)
	lastPosition = undefined
})

canvas.addEventListener('touchmove', (event) => {
	if (event.touches.length === 1 && zoomStart === undefined) {
		dragEvent(event)
		return
	}

	if (event.touches.length === 2 && zoomStart !== undefined) {
		const distance = getPinchDistance(event)
		zoom((zoomStart - distance) / 4000.0)
	}

	event.preventDefault()
	event.stopPropagation()
})

canvas.addEventListener('touchstart', (event) => {
	zoomStart = getPinchDistance(event)
})

canvas.addEventListener('touchend', (event) => {
	if (event.touches.length) return
	zoomStart = undefined
	lastPosition = undefined
})

function setSize() {
	const devicePixelRatio = window.devicePixelRatio || 1
	canvas.width = window.innerWidth * devicePixelRatio
	canvas.height = window.innerHeight * devicePixelRatio
	math.perspective(pMatrix, 45.0, canvas.width / canvas.height, 0.1, 100.0)
	gl.viewport(0, 0, canvas.width, canvas.height)
}

function computeCamera() {
	const d = cam.distance
	const sy = Math.sin(cam.rY)
	const sx = Math.sin(cam.rX)
	const cx = Math.cos(cam.rX)
	const cy = Math.cos(cam.rY)

	cam.x = d * -sy * cx
	cam.y = d * sx
	cam.z = d * cy * cx

	const vm = math.mat4()
	vm[14] -= d
	math.rotateX(vm, vm, cam.rX)
	math.rotateY(vMatrix, vm, cam.rY)
}

function* walk(idx: number): Generator<Node> {
	const n = model.nodes[idx]
	if (n) {
		yield n
		if (n.children?.length) {
			for (const c of n.children) {
				yield* walk(c)
			}
		}
	}
}

/**
 * Sets the active animation
 * @param animation Animation key
 */
function pushAnimation(key: string) {
	const len = activeAnimations.length
	if (activeAnimations[len - 1]?.key === key) return
	if (len > 2) activeAnimations.shift()
	activeAnimations.push({ key, elapsed: 0 })
}

/**
 * Advances the animation
 * @param elapsed Time elasped since last update
 */
function advanceAnimation(elapsed: number) {
	const len = activeAnimations.length
	const current = activeAnimations[len - 1]
	if (current) current.elapsed += elapsed

	const previous = activeAnimations[len - 2]
	if (previous) previous.elapsed += elapsed
}

function* applyTransform(
	skin: Skin,
	matrix: Mat4,
	nodeIndex: number,
	transforms: Map<number, Mat4>
): Generator<{ idx: number; mat: Mat4 }> {
	const node = model.nodes[nodeIndex]
	const xfIdx = skin.joints.indexOf(node.id)

	const xf = transforms.get(node.id)
	if (xf) {
		math.multiplyMat4(matrix, matrix, xf)
	}

	const ibt = skin.inverseBindTransforms[xfIdx]
	if (ibt) {
		yield { idx: xfIdx, mat: math.multiplyMat4(null, matrix, ibt) }
	}

	for (const c of node.children) {
		yield* applyTransform(skin, math.mat4(matrix), c, transforms)
	}
}
