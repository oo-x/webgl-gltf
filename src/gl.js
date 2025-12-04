/// <reference types="vite/client" />

import * as utils from './utils.js'
import vertShader from './shaders/default.vert?raw'
import fragShader from './shaders/default.frag?raw'

const attribNames = /** @type {const} */ ([
	//
	'position',
	'normal',
	'tangent',
	'texCoord',
	'joints',
	'weights',
])

const uniformNames = /** @type {const} */ ([
	'projectionMatrix',
	'viewMatrix',
	'modelMatrix',
	'cameraPosition',
	'isAnimated',
	'hasBaseColorTexture',
	'baseColorTexture',
	'hasMetallicRoughnessTexture',
	'metallicRoughnessTexture',
	'hasEmissiveTexture',
	'emissiveTexture',
	'baseColorFactor',
	'metallicFactor',
	'roughnessFactor',
	'emissiveFactor',
	'normalTexture',
	'hasNormalTexture',
	'occlusionTexture',
	'hasOcclusionTexture',
	'brdfLut',
	'environmentDiffuse',
	'environmentSpecular',
])

/** @param {string} n */
const gln = (n, p = 'u') => `${p}${n[0].toUpperCase()}${n.slice(1)}`

/**
 * @param {HTMLCanvasElement} canvas
 */
export function init(canvas) {
	let gl = canvas.getContext('webgl2')
	if (!gl) throw new Error('could not getContext')

	gl.clearColor(0.3, 0.3, 0.3, 1)
	gl.enable(gl.DEPTH_TEST)

	const program = gl.createProgram()
	if (!program) throw new Error('createProgram failed')

	gl.attachShader(program, createShader(gl, vertShader, gl.VERTEX_SHADER))
	gl.attachShader(program, createShader(gl, fragShader, gl.FRAGMENT_SHADER))

	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program))
	}

	gl.useProgram(program)

	/** @param {string} n */
	const gul = (n) => {
		const z = gln(n)
		const u = gl.getUniformLocation(program, z)
		if (!u) throw new Error(`getUniformLocation failed (${z})`)
		return u
	}

	const uniforms = {
		...utils.mapToObject(uniformNames, gul),
		jointTransform: Array.from({ length: 25 }, (_, i) => gul(`jointTransform[${i}]`)),
	}

	const attributes = utils.mapToObject(attribNames, (n) => gl.getAttribLocation(program, gln(n, 'v')))

	return { gl, uniforms, attributes }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} src
 * @param {number} type
 */
function createShader(gl, src, type) {
	const shader = gl.createShader(type)
	if (shader === null) throw new Error('createShader failed')

	gl.shaderSource(shader, src)
	gl.compileShader(shader)

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader))
	}

	return shader
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} type
 * @param {[target: number, src: TexImageSource][]} textures
 * @param {EXT_texture_filter_anisotropic | null} [ext]
 */
export function createTexture(gl, type, textures, ext) {
	const tex = gl.createTexture()
	if (!tex) throw new Error('createTexture failed')
	gl.bindTexture(type, tex)
	for (const [i, t] of textures) {
		gl.texImage2D(i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t)
	}
	gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
	gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

	if (ext) {
		const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
		gl.texParameterf(type, ext.TEXTURE_MAX_ANISOTROPY_EXT, max)
	}

	gl.generateMipmap(type)
	return tex
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLTexture | null} tex
 * @param {number} target
 * @param {WebGLUniformLocation} uniform
 * @param {WebGLUniformLocation} [enabled]
 */
export function applyTexture(gl, tex, target, uniform, enabled) {
	if (tex) {
		gl.activeTexture(gl.TEXTURE0 + target)
		gl.bindTexture(gl.TEXTURE_2D, tex)
		gl.uniform1i(uniform, target)
	}

	if (enabled !== undefined) gl.uniform1i(enabled, tex ? 1 : 0)
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} pos
 * @param {import('./webgl-gltf/types/model').GLBuffer | null} buf
 */
export function bindBuffer(gl, pos, buf) {
	if (!buf) return
	gl.enableVertexAttribArray(pos)
	gl.bindBuffer(gl.ARRAY_BUFFER, buf.buffer)
	gl.vertexAttribPointer(pos, buf.size, buf.type, false, 0, 0)
}
