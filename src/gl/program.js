import { getGl } from './context.js'

/**
 * @param {import('./types').ProgramOpts} opts
 */
export function useProgram(opts) {
	const gl = getGl()

	const program = gl.createProgram()
	if (!program) throw new Error('createProgram failed')

	if (opts.shaders) {
		for (const [type, src] of opts.shaders) {
			const shader = gl.createShader(type)
			if (!shader) throw new Error('createShader failed')
			gl.shaderSource(shader, src)
			gl.compileShader(shader)

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				console.error(gl.getShaderInfoLog(shader))
			}
			gl.attachShader(program, shader)
		}
	}

	gl.linkProgram(program)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program))
	}

	gl.useProgram(program)

	const uniforms = opts.uniforms?.map((n) => gl.getUniformLocation(program, n)) ?? []

	const attributes = opts.attributes?.map((n) => gl.getAttribLocation(program, n)) ?? []

	return { program, uniforms, attributes }
}
