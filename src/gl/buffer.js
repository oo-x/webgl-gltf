import { getGl } from './context.js'

export function bindArrayBuffer(buf) {
	const gl = getGl()
	const buffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
	gl.bufferData(gl.ARRAY_BUFFER, buf.data, gl.STATIC_DRAW)

	return {
		buffer,
		size: buf.size,
		type: buf.componentType,
	}
}