import { mat4, vec3 } from 'gl-matrix'
import { loadModel } from './webgl-gltf/gltf'
import { getAnimationTransforms, applyToSkin } from './webgl-gltf/animator'
import { pushAnimation, getActiveAnimations, advanceAnimation } from './webgl-gltf/animation'

import * as utils from './utils.js'
import { init, bindBuffer, createTexture, applyTexture } from './gl.js'

const track = 'track'
const blendTime = 300
const names = ['right', 'left', 'top', 'bottom', 'front', 'back']

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const { gl, uniforms, attributes } = init(canvas)

let lastFrame = 0

const cam = {
	rY: 0.0,
	rX: 0.0,
	distance: 3.0,
}

const camPos = [0, 0, 0]
const pMatrix = mat4.create()
const vMatrix = mat4.create()

const brdfLutTexture = await utils.getImage('environment/brdf_lut.png')
const diffuseTextures = await Promise.all(names.map((n) => utils.getImage(`environment/diffuse_${n}.jpg`)))
const specularTextures = await Promise.all(names.map((n) => utils.getImage(`environment/specular_${n}.jpg`)))

const urlParams = new URLSearchParams(window.location.search)
const modelName = urlParams.get('model') || 'robot'
const model = await loadModel(gl, `/models/${modelName}/${modelName}.gltf`)
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

const brdf = createTexture(gl, gl.TEXTURE_2D, [[gl.TEXTURE_2D, brdfLutTexture]])
// prettier-ignore
const diffuse = createTexture(gl, gl.TEXTURE_CUBE_MAP, diffuseTextures.map((s, i) => [gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, s]))
// prettier-ignore
const specular = createTexture(gl, gl.TEXTURE_CUBE_MAP, specularTextures.map((s, i) => [gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, s]))

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

function render() {
	gl.clear(gl.COLOR_BUFFER_BIT)
	gl.uniform3f(uniforms.cameraPosition, camPos[0], camPos[1], camPos[2])
	gl.uniformMatrix4fv(uniforms.projectionMatrix, false, pMatrix)
	gl.uniformMatrix4fv(uniforms.viewMatrix, false, vMatrix)

	const animation = getActiveAnimations('default', model.name)
	if (animation) {
		const animationTransforms = getAnimationTransforms(model, animation, blendTime)
		applyToSkin(model, animationTransforms).forEach((x, i) => {
			gl.uniformMatrix4fv(uniforms.jointTransform[i], false, x)
		})
		gl.uniform1i(uniforms.isAnimated, 1)
	} else {
		gl.uniform1i(uniforms.isAnimated, 0)
	}

	renderModel(model.rootNode, model.nodes[model.rootNode].localBindTransform)
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
	const cx = Math.cos(-cam.rX)
	camPos[0] = cam.distance * Math.sin(-cam.rY) * cx
	camPos[1] = cam.distance * Math.sin(cam.rX)
	camPos[2] = cam.distance * Math.cos(-cam.rY) * cx

	const vm = mat4.create()
	mat4.translate(vm, vm, vec3.fromValues(0.0, 0.0, -cam.distance))
	mat4.rotateX(vm, vm, cam.rX)
	mat4.rotateY(vMatrix, vm, cam.rY)
	mat4.perspective(pMatrix, 45.0, canvas.width / canvas.height, 0.1, 100.0)
}

function renderModel(node: number, transform: mat4) {
	const meshIdx = model.nodes[node].mesh
	if (meshIdx !== undefined) {
		const mesh = model.meshes[meshIdx]

		const m = model.materials[mesh.material]
		if (m) {
			applyTexture(gl, m.baseColorTexture, 0, uniforms.baseColorTexture, uniforms.hasBaseColorTexture)
			// prettier-ignore
			applyTexture(gl, m.metallicRoughnessTexture, 1, uniforms.metallicRoughnessTexture, uniforms.hasMetallicRoughnessTexture)
			applyTexture(gl, m.emissiveTexture, 2, uniforms.emissiveTexture, uniforms.hasEmissiveTexture)
			applyTexture(gl, m.normalTexture, 3, uniforms.normalTexture, uniforms.hasNormalTexture)
			applyTexture(gl, m.occlusionTexture, 4, uniforms.occlusionTexture, uniforms.hasOcclusionTexture)
			// prettier-ignore
			gl.uniform4f(uniforms.baseColorFactor, m.baseColorFactor[0], m.baseColorFactor[1], m.baseColorFactor[2], m.baseColorFactor[3])
			gl.uniform1f(uniforms.metallicFactor, m.metallicFactor)
			gl.uniform1f(uniforms.roughnessFactor, m.roughnessFactor)
			gl.uniform3f(uniforms.emissiveFactor, m.emissiveFactor[0], m.emissiveFactor[1], m.emissiveFactor[2])
		}

		bindBuffer(gl, attributes.position, mesh.positions)
		bindBuffer(gl, attributes.normal, mesh.normals)
		bindBuffer(gl, attributes.tangent, mesh.tangents)
		bindBuffer(gl, attributes.texCoord, mesh.texCoord)
		bindBuffer(gl, attributes.joints, mesh.joints)
		bindBuffer(gl, attributes.weights, mesh.weights)
		gl.uniformMatrix4fv(uniforms.modelMatrix, false, transform)

		if (mesh.indices) {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices)
			gl.drawElements(gl.TRIANGLES, mesh.elementCount, gl.UNSIGNED_SHORT, 0)
		} else {
			gl.drawArrays(gl.TRIANGLES, 0, mesh.elementCount)
		}
	}

	for (const c of model.nodes[node].children) renderModel(c, transform)
}
