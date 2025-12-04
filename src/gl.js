/// <reference types="vite/client" />

import * as utils from './utils.js'
import { getGl } from './gl/context.js'
import { useProgram } from './gl/program.js'

import vertShader from './shaders/default.vert?raw'
import fragShader from './shaders/default.frag?raw'

export const attribNames = /** @type {const} */ ([
	//
	'texCoord',
	'positions',
	'tangents',
	'normals',
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
	const gl = getGl()
	gl.clearColor(0.3, 0.3, 0.3, 1)
	gl.enable(gl.DEPTH_TEST)

	const prog = useProgram({
		shaders: [
			[gl.VERTEX_SHADER, vertShader],
			[gl.FRAGMENT_SHADER, fragShader],
		],
		uniforms: [
			...uniformNames.map((n) => gln(n)),
			...Array.from({ length: 25 }, (_, i) => gln(`jointTransform[${i}]`)),
		],
		attributes: attribNames.map((n) => gln(n, 'v')),
	})

	console.log(prog)

	const unl = uniformNames.length

	const uniforms = {
		...utils.mapToObject(uniformNames, (n, i) => {
			const u = prog.uniforms[i]
			if (!u) throw new Error(`getUniformLocation failed (${n})`)
			return u
		}),
		jointTransform: Array.from({ length: 25 }, (_, i) => {
			const u = prog.uniforms[unl + i]
			if (!u) throw new Error(`getUniformLocation failed (jointTransform[${i}])`)
			return u
		}),
	}

	const attributes = utils.mapToObject(attribNames, (_, i) => prog.attributes[i])

	return { gl, uniforms, attributes }
}
