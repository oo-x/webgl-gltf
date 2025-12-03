import { mat4, vec3 } from 'gl-matrix'

import * as shader from './shaders/shader-loader'
import * as defaultShader from './shaders/default-shader'
import * as inputs from './inputs'
import * as cubemap from './cubemap'
import { renderModel } from './renderer'
import type { DefaultShader } from './shaders/default-shader'

import * as gltf from './webgl-gltf'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const gl = canvas.getContext('webgl2') as WebGL2RenderingContext

const track = 'track'
const blendTime = 300
let lastFrame = 0

const cam = {
	rY: 0.0,
	rX: 0.0,
	distance: 3.0,
}

const setSize = () => {
	const devicePixelRatio = window.devicePixelRatio || 1

	canvas.width = window.innerWidth * devicePixelRatio
	canvas.height = window.innerHeight * devicePixelRatio
	gl.viewport(0, 0, canvas.width, canvas.height)
}

if (!gl) {
	alert('WebGL not available')
}

const listAnimations = (models: gltf.Model[]) => {
	models.forEach((model) => {
		if (Object.keys(model.animations).length === 0) return

		gltf.pushAnimation(track, 'default', model.name, Object.keys(model.animations)[0])

		const ui = document.getElementById('ui') as HTMLElement
		Object.keys(model.animations).forEach((a) => {
			const btn = document.createElement('button')
			btn.innerText = a
			btn.addEventListener('click', () => gltf.pushAnimation(track, 'default', model.name, a))
			ui.appendChild(btn)
		})
	})
}

const render = (uniforms: DefaultShader, models: gltf.Model[]) => {
	gl.clear(gl.COLOR_BUFFER_BIT)

	const cx = cam.distance * Math.sin(-cam.rY) * Math.cos(-cam.rX)
	const cy = cam.distance * Math.sin(cam.rX)
	const cz = cam.distance * Math.cos(-cam.rY) * Math.cos(-cam.rX)

	const pMatrix = mat4.create()
	const vMatrix = mat4.create()
	mat4.translate(vMatrix, vMatrix, vec3.fromValues(0.0, 0.0, -cam.distance))
	mat4.rotateX(vMatrix, vMatrix, cam.rX)
	mat4.rotateY(vMatrix, vMatrix, cam.rY)
	mat4.perspective(pMatrix, 45.0, canvas.width / canvas.height, 0.1, 100.0)

	gl.uniform3f(uniforms.cameraPosition, cx, cy, cz)
	gl.uniformMatrix4fv(uniforms.pMatrix, false, pMatrix)
	gl.uniformMatrix4fv(uniforms.vMatrix, false, vMatrix)

	models.forEach((model) => {
		const animation = gltf.getActiveAnimations('default', model.name)

		if (animation) {
			const animationTransforms = gltf.getAnimationTransforms(model, animation, blendTime)
			gltf.applyToSkin(model, animationTransforms).forEach((x, i) => {
				gl.uniformMatrix4fv(uniforms.jointTransform[i], false, x)
			})

			gl.uniform1i(uniforms.isAnimated, 1)
		} else {
			gl.uniform1i(uniforms.isAnimated, 0)
		}

		renderModel(gl, model, model.rootNode, model.nodes[model.rootNode].localBindTransform, uniforms)
	})

	gltf.advanceAnimation(performance.now() - lastFrame)

	requestAnimationFrame(() => {
		render(uniforms, models)
		lastFrame = performance.now()
	})
}

const startup = async () => {
	gl.clearColor(0.3, 0.3, 0.3, 1)
	gl.enable(gl.DEPTH_TEST)

	window.onresize = () => setSize()
	setSize()

	const program = shader.createProgram(gl)
	gl.attachShader(program, await shader.loadShader(gl, 'default.vert', gl.VERTEX_SHADER))
	gl.attachShader(program, await shader.loadShader(gl, 'default.frag', gl.FRAGMENT_SHADER))
	shader.linkProgram(gl, program)

	const uniforms = defaultShader.getUniformLocations(gl, program)

	const environment = await cubemap.load(gl)
	const urlParams = new URLSearchParams(window.location.search)
	const modelNames = urlParams.get('model') || 'robot'
	const models = await Promise.all(modelNames.split(',').map((m) => gltf.loadModel(gl, `/models/${m}/${m}.gltf`)))
	listAnimations(models)
	console.log(models)
	cubemap.bind(gl, environment, uniforms.brdfLut, uniforms.environmentDiffuse, uniforms.environmentSpecular)
	document.getElementById('loading')?.remove()
	render(uniforms, models)
}

const rotate = (delta: inputs.Position) => {
	cam.rX += delta.y
	cam.rY += delta.x
}

const zoom = (delta: number) => {
	cam.distance *= 1.0 + delta
	if (cam.distance < 0.0) cam.distance = 0.0
}

inputs.listen(canvas, rotate, zoom)
startup()
