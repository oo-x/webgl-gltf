import { getGl } from './context.js'

/**
 * @param {number} type
 * @param {[target: number, src: TexImageSource][]} textures
 * @param {EXT_texture_filter_anisotropic | null} [ext]
 */
export function createTexture(type, textures, ext) {
	const gl = getGl()
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
 * @param {WebGLTexture | null} tex
 * @param {number} target
 * @param {WebGLUniformLocation} uniform
 * @param {WebGLUniformLocation} enabled
 */
export function bindTexture(tex, target, uniform, enabled) {
	const gl = getGl()
	gl.uniform1i(enabled, tex ? 1 : 0)
	if (!tex) return
	gl.activeTexture(gl.TEXTURE0 + target)
	gl.bindTexture(gl.TEXTURE_2D, tex)
	gl.uniform1i(uniform, target)
}
