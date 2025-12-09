/** @type {WebGL2RenderingContext | null} */
let gl = null

/** @type {HTMLCanvasElement | null} */
let canvas = null

/** @type {WeakMap<HTMLCanvasElement, WebGL2RenderingContext>} */
const contexts = new WeakMap()

const onContextLost = () => {
	gl = null
}

/** @param {HTMLCanvasElement | null | string} c */
export function setCanvas(c) {
	const el = typeof c === 'string' ? document.querySelector(c) : c
	if (!el) throw new Error('canvas not found')
	if (!(el instanceof HTMLCanvasElement)) throw new Error('invalid canvas')

	el.addEventListener('webglcontextlost', onContextLost, false)

	if (canvas && gl) {
		// we have an earlier canvas, stash the gl
		contexts.set(canvas, gl)
	}

	gl = null
	canvas = el
	return canvas
}

export function getGl() {
	if (gl) return gl
	const gl2 = contexts.get(canvas) ?? canvas?.getContext('webgl2')
	if (!gl2) throw new Error('could not getContext')
	gl = gl2
	return gl
}
