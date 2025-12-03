import { mat4, vec3 } from 'gl-matrix'
import { loadModel } from './webgl-gltf/gltf'
import { getAnimationTransforms, applyToSkin } from './webgl-gltf/animator'
import { pushAnimation, getActiveAnimations, advanceAnimation } from './webgl-gltf/animation'
import { init } from './gl.js'

import type { GLBuffer } from './webgl-gltf/types/model'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const { gl, program, attributes } = init(canvas)

const track = 'track'
const blendTime = 300
let lastFrame = 0

const cam = {
	rY: 0.0,
	rX: 0.0,
	distance: 3.0,
}

const camPos = [0, 0, 0]
const pMatrix = mat4.create()
const vMatrix = mat4.create()

const names = ['right', 'left', 'top', 'bottom', 'front', 'back']

window.onresize = () => setSize()
setSize()

const uniforms = getUniformLocations(gl, program)

const diffuseTextures = await Promise.all(names.map((n) => getImage(`environment/diffuse_${n}.jpg`)))
const specularTextures = await Promise.all(names.map((n) => getImage(`environment/specular_${n}.jpg`)))
const diffuse = createCubeMap(diffuseTextures)
const specular = createCubeMap(specularTextures)
const brdfLutTexture = await getImage('environment/brdf_lut.png')
const brdfLut = gl.createTexture()

gl.bindTexture(gl.TEXTURE_2D, brdfLut)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, brdfLutTexture)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
gl.generateMipmap(gl.TEXTURE_2D)

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

gl.activeTexture(gl.TEXTURE5)
gl.bindTexture(gl.TEXTURE_2D, brdfLut)
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
	gl.uniformMatrix4fv(uniforms.pMatrix, false, pMatrix)
	gl.uniformMatrix4fv(uniforms.vMatrix, false, vMatrix)

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

async function getImage(uri: string) {
	return new Promise<HTMLImageElement>((resolve) => {
		const img = new Image()
		img.onload = () => resolve(img)
		img.src = uri
	})
}

function createCubeMap(textures: HTMLImageElement[]) {
	const cubeMap = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap)
	for (const [i, t] of textures.entries()) {
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t)
	}
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
	gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
	return cubeMap
}

function setSize() {
	const devicePixelRatio = window.devicePixelRatio || 1
	canvas.width = window.innerWidth * devicePixelRatio
	canvas.height = window.innerHeight * devicePixelRatio
	gl.viewport(0, 0, canvas.width, canvas.height)
}

function getUniformLocations(gl: WebGLRenderingContext, program: WebGLProgram) {
	const pMatrix = gl.getUniformLocation(program, 'uProjectionMatrix')!
	const vMatrix = gl.getUniformLocation(program, 'uViewMatrix')!
	const mMatrix = gl.getUniformLocation(program, 'uModelMatrix')!
	const cameraPosition = gl.getUniformLocation(program, 'uCameraPosition')!

	const isAnimated = gl.getUniformLocation(program, 'uIsAnimated')!
	const hasBaseColorTexture = gl.getUniformLocation(program, 'uHasBaseColorTexture')!
	const baseColorTexture = gl.getUniformLocation(program, 'uBaseColorTexture')!
	const hasMetallicRoughnessTexture = gl.getUniformLocation(program, 'uHasMetallicRoughnessTexture')!
	const metallicRoughnessTexture = gl.getUniformLocation(program, 'uMetallicRoughnessTexture')!

	const hasEmissiveTexture = gl.getUniformLocation(program, 'uHasEmissiveTexture')!
	const emissiveTexture = gl.getUniformLocation(program, 'uEmissiveTexture')!

	const baseColorFactor = gl.getUniformLocation(program, 'uBaseColorFactor')!
	const metallicFactor = gl.getUniformLocation(program, 'uMetallicFactor')!
	const roughnessFactor = gl.getUniformLocation(program, 'uRoughnessFactor')!
	const emissiveFactor = gl.getUniformLocation(program, 'uEmissiveFactor')!

	const normalTexture = gl.getUniformLocation(program, 'uNormalTexture')!
	const hasNormalTexture = gl.getUniformLocation(program, 'uHasNormalTexture')!

	const occlusionTexture = gl.getUniformLocation(program, 'uOcclusionTexture')!
	const hasOcclusionTexture = gl.getUniformLocation(program, 'uHasOcclusionTexture')!

	const brdfLut = gl.getUniformLocation(program, 'uBrdfLut')!
	const environmentDiffuse = gl.getUniformLocation(program, 'uEnvironmentDiffuse')!
	const environmentSpecular = gl.getUniformLocation(program, 'uEnvironmentSpecular')!

	const jointTransform: WebGLUniformLocation[] = []
	for (let i = 0; i < 25; i++) {
		jointTransform[i] = gl.getUniformLocation(program, `uJointTransform[${i}]`)!
	}

	return {
		pMatrix,
		vMatrix,
		mMatrix,
		cameraPosition,
		hasBaseColorTexture,
		baseColorTexture,
		hasMetallicRoughnessTexture,
		metallicRoughnessTexture,
		hasEmissiveTexture,
		normalTexture,
		hasNormalTexture,
		occlusionTexture,
		hasOcclusionTexture,
		emissiveTexture,
		baseColorFactor,
		metallicFactor,
		roughnessFactor,
		emissiveFactor,
		isAnimated,
		jointTransform,
		brdfLut,
		environmentDiffuse,
		environmentSpecular,
	}
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

function bindBuffer(gl: WebGLRenderingContext, position: number, buffer: GLBuffer | null) {
	if (buffer === null) return

	gl.enableVertexAttribArray(position)
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer)
	gl.vertexAttribPointer(position, buffer.size, buffer.type, false, 0, 0)

	return buffer
}

function applyTexture(
	gl: WebGLRenderingContext,
	texture: WebGLTexture | null,
	textureTarget: number,
	textureUniform: WebGLUniformLocation,
	enabledUniform?: WebGLUniformLocation
) {
	if (texture) {
		gl.activeTexture(gl.TEXTURE0 + textureTarget)
		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.uniform1i(textureUniform, textureTarget)
	}

	if (enabledUniform !== undefined) gl.uniform1i(enabledUniform, texture ? 1 : 0)
}

function renderModel(node: number, transform: mat4) {
	if (model.nodes[node].mesh !== undefined) {
		const mesh = model.meshes[model.nodes[node].mesh!]
		const material = model.materials[mesh.material]

		if (material) {
			applyTexture(gl, material.baseColorTexture, 0, uniforms.baseColorTexture, uniforms.hasBaseColorTexture)
			applyTexture(
				gl,
				material.metallicRoughnessTexture,
				1,
				uniforms.metallicRoughnessTexture,
				uniforms.hasMetallicRoughnessTexture
			)
			applyTexture(gl, material.emissiveTexture, 2, uniforms.emissiveTexture, uniforms.hasEmissiveTexture)
			applyTexture(gl, material.normalTexture, 3, uniforms.normalTexture, uniforms.hasNormalTexture)
			applyTexture(gl, material.occlusionTexture, 4, uniforms.occlusionTexture, uniforms.hasOcclusionTexture)

			gl.uniform4f(
				uniforms.baseColorFactor,
				material.baseColorFactor[0],
				material.baseColorFactor[1],
				material.baseColorFactor[2],
				material.baseColorFactor[3]
			)
			gl.uniform1f(uniforms.metallicFactor, material.metallicFactor)
			gl.uniform1f(uniforms.roughnessFactor, material.roughnessFactor)
			gl.uniform3f(
				uniforms.emissiveFactor,
				material.emissiveFactor[0],
				material.emissiveFactor[1],
				material.emissiveFactor[2]
			)
		}

		bindBuffer(gl, attributes.position, mesh.positions)
		bindBuffer(gl, attributes.normal, mesh.normals)
		bindBuffer(gl, attributes.tangent, mesh.tangents)
		bindBuffer(gl, attributes.texCoord, mesh.texCoord)
		bindBuffer(gl, attributes.joints, mesh.joints)
		bindBuffer(gl, attributes.weights, mesh.weights)

		gl.uniformMatrix4fv(uniforms.mMatrix, false, transform)

		if (mesh.indices) {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices)
			gl.drawElements(gl.TRIANGLES, mesh.elementCount, gl.UNSIGNED_SHORT, 0)
		} else {
			gl.drawArrays(gl.TRIANGLES, 0, mesh.elementCount)
		}
	}

	for (const c of model.nodes[node].children) renderModel(c, transform)
}
