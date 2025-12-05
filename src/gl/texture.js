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
 * @param {WebGLUniformLocation} [enabled]
 * @param {number} [type]
 */
export function bindTexture(tex, target, uniform, enabled, type) {
	const gl = getGl()
	if (enabled) gl.uniform1i(enabled, tex ? 1 : 0)
	if (!tex) return
	gl.activeTexture(gl.TEXTURE0 + target)
	gl.bindTexture(type ?? gl.TEXTURE_2D, tex)
	gl.uniform1i(uniform, target)
}

/**
 * @param {Array<TexImageSource | Promise<TexImageSource>>} srcs
 * @param {number} target
 * @param {WebGLUniformLocation} uniform
 */
export async function bindCubeMap(srcs, target, uniform) {
	const gl = getGl()
	const all = await Promise.all(srcs.map(async (s, i) => [gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, await s]))
	const tex = createTexture(gl.TEXTURE_CUBE_MAP, all)
	bindTexture(tex, target, uniform, undefined, gl.TEXTURE_CUBE_MAP)
}
