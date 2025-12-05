/** @type {WebGL2RenderingContext | null} */
let gl = null

/** @type {HTMLCanvasElement | null} */
let canvas = null

const onContextLost = () => {
	gl = null
}

/** @param {HTMLCanvasElement | string} c */
export function setCanvas(c) {
	if (typeof c === 'string') {
		canvas = document.querySelector(c)
	} else {
		canvas = c
	}
	canvas.addEventListener('webglcontextlost', onContextLost, false)
}

export function getGl() {
	if (gl) return gl
	const gl2 = canvas?.getContext('webgl2')
	if (!gl2) throw new Error('could not getContext')
	gl = gl2
	return gl
}
