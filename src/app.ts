import * as math from './math.js'
import * as utils from './utils.js'
import { loadModel } from './gltf.js'
import { setCanvas } from './gl/context.js'
import { init, attribNames } from './gl.js'
import { createTexture, bindTexture } from './gl/texture.js'
import { getAnimationTransforms } from './anim/transform.js'

import type { Mat4 } from './gltf/types'
import type { Node, Skin } from './webgl-gltf/types/model'

const track = 'track'
const blendTime = 300
const names = ['right', 'left', 'top', 'bottom', 'front', 'back']

interface Animations {
	[model: string]: Record<string, { key: string; elapsed: number }[]>
}

const activeAnimations: Animations = {}

setCanvas('#canvas')
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const { gl, uniforms, attributes } = init()

let lastFrame = 0

const cam = { x: 0, y: 0, z: 0, rY: 0.0, rX: 0.0, distance: 3.0 }

const pMatrix = math.mat4()
let vMatrix = math.mat4()

const brdfLutTexture = await utils.getImage('environment/brdf_lut.png')
const diffuseTextures = await Promise.all(names.map((n) => utils.getImage(`environment/diffuse_${n}.jpg`)))
const specularTextures = await Promise.all(names.map((n) => utils.getImage(`environment/specular_${n}.jpg`)))

const urlParams = new URLSearchParams(window.location.search)
const modelName = urlParams.get('model') || 'robot'
const model = await loadModel(`/models/${modelName}/${modelName}.gltf`)
const anims = Object.keys(model.animations)
if (anims.length) {
	pushAnimation(track, 'default', model.name, anims[0])
	const ui = document.getElementById('ui') as HTMLElement
	for (const a of anims) {
		const btn = document.createElement('button')
		btn.innerText = a
		btn.addEventListener('click', () => pushAnimation(track, 'default', model.name, a))
		ui.appendChild(btn)
	}
}
console.log(model)

const brdf = createTexture(gl.TEXTURE_2D, [[gl.TEXTURE_2D, brdfLutTexture]])
// prettier-ignore
const diffuse = createTexture(gl.TEXTURE_CUBE_MAP, diffuseTextures.map((s, i) => [gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, s]))
// prettier-ignore
const specular = createTexture(gl.TEXTURE_CUBE_MAP, specularTextures.map((s, i) => [gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, s]))

gl.activeTexture(gl.TEXTURE5)
gl.bindTexture(gl.TEXTURE_2D, brdf)
gl.uniform1i(uniforms.brdfLut, 5)

gl.activeTexture(gl.TEXTURE6)
gl.bindTexture(gl.TEXTURE_CUBE_MAP, diffuse)
gl.uniform1i(uniforms.environmentDiffuse, 6)

gl.activeTexture(gl.TEXTURE7)
gl.bindTexture(gl.TEXTURE_CUBE_MAP, specular)
gl.uniform1i(uniforms.environmentSpecular, 7)

document.getElementById('loading')?.remove()
computeCamera()
render()

function* applyTransform(
	skin: Skin,
	matrix: Mat4,
	nodeIndex: number,
	transforms: Record<string, Mat4>
): Generator<{ idx: number; mat: Mat4 }> {
	const node = model.nodes[nodeIndex]
	const xfIdx = skin.joints.indexOf(node.id)

	if (transforms[node.id] !== undefined) {
		math.multiplyMat4(matrix, matrix, transforms[node.id])
	}

	const ibt = skin.inverseBindTransforms[xfIdx]
	if (ibt) {
		yield { idx: xfIdx, mat: math.multiplyMat4(null, matrix, ibt) }
	}

	for (const childNode of node.children) {
		yield* applyTransform(skin, math.mat4(matrix), childNode, transforms)
	}
}

function render() {
	gl.clear(gl.COLOR_BUFFER_BIT)
	gl.uniformMatrix4fv(uniforms.viewMatrix, false, vMatrix)
	gl.uniformMatrix4fv(uniforms.projectionMatrix, false, pMatrix)
	gl.uniform3f(uniforms.cameraPosition, cam.x, cam.y, cam.z)

	const root = model.rootNode
	const animation = getActiveAnimations('default', model.name)
	if (animation) {
		const axfs = getAnimationTransforms(model, animation, blendTime)
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

window.onresize = () => setSize()
setSize()

function setSize() {
	const devicePixelRatio = window.devicePixelRatio || 1
	canvas.width = window.innerWidth * devicePixelRatio
	canvas.height = window.innerHeight * devicePixelRatio
	gl.viewport(0, 0, canvas.width, canvas.height)
}

function computeCamera() {
	const d = cam.distance
	const sy = Math.sin(cam.rY)
	const sx = Math.sin(cam.rX)
	const cx = Math.cos(cam.rX)
	const cy = Math.cos(cam.rY)

	cam.x = -d * sy * cx
	cam.y = d * sx
	cam.z = d * cy * cx

	const vm = math.mat4()
	vMatrix[12] = vm[8] * -d + vm[12]
	vMatrix[13] = vm[9] * -d + vm[13]
	vMatrix[14] = vm[10] * -d + vm[14]
	vMatrix[15] = vm[11] * -d + vm[15]

	let a00 = vm[0]
	let a01 = vm[1]
	let a02 = vm[2]
	let a03 = vm[3]
	let a10 = vm[4]
	let a11 = vm[5]
	let a12 = vm[6]
	let a13 = vm[7]
	let a20 = vm[8]
	let a21 = vm[9]
	let a22 = vm[10]
	let a23 = vm[11]

	vm[8] = a20 * cx - a10 * sx
	vm[9] = a21 * cx - a11 * sx
	vm[10] = a22 * cx - a12 * sx
	vm[11] = a23 * cx - a13 * sx

	a20 = vm[8]
	a21 = vm[9]
	a22 = vm[10]
	a23 = vm[11]

	vMatrix[0] = a00 * cy - a20 * sy
	vMatrix[1] = a01 * cy - a21 * sy
	vMatrix[2] = a02 * cy - a22 * sy
	vMatrix[3] = a03 * cy - a23 * sy

	vMatrix[4] = a10 * cx + a20 * sx
	vMatrix[5] = a11 * cx + a21 * sx
	vMatrix[6] = a12 * cx + a22 * sx
	vMatrix[7] = a13 * cx + a23 * sx

	vMatrix[8] = a00 * sy + a20 * cy
	vMatrix[9] = a01 * sy + a21 * cy
	vMatrix[10] = a02 * sy + a22 * cy
	vMatrix[11] = a03 * sy + a23 * cy

	math.perspective(pMatrix, 45.0, canvas.width / canvas.height, 0.1, 100.0)
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
 * @param {string} track
 * @param {string} key
 */
function getAnimationFromLast(track: string, key: string, offset = 0) {
	const active = activeAnimations[track]?.[key]
	return active?.[active.length - offset - 1]
}

/**
 * Sets the active animation
 * @param track Animation track
 * @param key Animation set key
 * @param model GLTF Model
 * @param animation Animation key
 */
function pushAnimation(track: string, key: string, model: string, animation: string) {
	const k = `${key}_${model}`
	if (!activeAnimations[track]) activeAnimations[track] = {}
	if (!activeAnimations[track][k]) activeAnimations[track][k] = []
	if (getAnimationFromLast(track, k)?.key === animation) return

	activeAnimations[track][k].push({ key: animation, elapsed: 0 })
	activeAnimations[track][k].slice(activeAnimations[track][k].length - 2)
}

/**
 * Gets the current and previous animation
 * @param key Animation set key
 * @param model GLTF Model
 */
function getActiveAnimations(key: string, model: string) {
	if (!Object.keys(activeAnimations).length) return null

	const k = `${key}_${model}`
	const aa = {}

	for (const [c, anim] of Object.entries(activeAnimations)) {
		if (!anim[k]) continue
		aa[c] = anim[k].slice(anim[k].length - 2)
	}

	return aa
}

/**
 * Advances the animation
 * @param elapsed Time elasped since last update
 * @param key Animation set key
 */
function advanceAnimation(elapsed: number, key?: string) {
	for (const [c, anim] of Object.entries(activeAnimations)) {
		for (const m of Object.keys(anim)) {
			if (key && m.indexOf(key) !== 0) continue

			const current = getAnimationFromLast(c, m)
			const previous = getAnimationFromLast(c, m, 1)

			if (current) current.elapsed += elapsed
			if (previous) previous.elapsed += elapsed
		}
	}
}