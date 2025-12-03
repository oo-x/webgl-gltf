/// <reference types="vite/client" />

import vertShader from './shaders/default.vert?raw'
import fragShader from './shaders/default.frag?raw'

const uniformNames = /** @type {const} */([
	'projectionMatrix',
	'viewMatrix',
	'modelMatrix',
	'cameraPosition',
])

const attribNames =  /** @type {const} */([
	'position',
	'normal',
	'tangent',
	'texCoord',
	'joints',
	'weights',
])

/** @param {string} n */
const prefN = (n, p = 'u') => `${p}${n[0].toUpperCase()}${n.slice(1)}`

/**
 * @param {HTMLCanvasElement} canvas
 */
export function init(canvas) {
	let gl = canvas.getContext('webgl2')
	if (!gl) throw new Error('could not get context')

	gl.clearColor(0.3, 0.3, 0.3, 1)
	gl.enable(gl.DEPTH_TEST)

	const program = gl.createProgram()
	if (!program) throw new Error('could not createProgram')

	gl.attachShader(program, createShader(gl, vertShader, gl.VERTEX_SHADER))
	gl.attachShader(program, createShader(gl, fragShader, gl.FRAGMENT_SHADER))

	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program))
	}

	gl.useProgram(program)

	/** @param {string} n */
	const gul = (n) => {
		const u = gl.getUniformLocation(program, prefN(n))
		if (!u) throw new Error(`could not get location for ${n}`)
		return u
	}

	/** @param {string} n */
	const gal = (n) => gl.getAttribLocation(program, prefN(n, 'v'))

	const uniforms = Object.fromEntries(uniformNames.map((n) => [n, gul(n)]))
	const jointTransform = Array.from({ length: 25 }, (_, i) => gul(`jointTransform[${i}]`))

	const attributes = Object.fromEntries(attribNames.map((n) => [n, gal(n)]))

	return { gl, program, uniforms, attributes, jointTransform }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} src
 * @param {number} type
 */
function createShader(gl, src, type) {
	const shader = gl.createShader(type)
	if (shader === null) throw new Error('gl.createShader failed')

	gl.shaderSource(shader, src)
	gl.compileShader(shader)

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader))
	}

	return shader
}
