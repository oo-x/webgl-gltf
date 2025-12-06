import * as math from './math.js'
import { getGl } from './gl/context.js'

/** @param {TouchEvent} evt */
const getPinchDistance = (evt) => {
	const [a, b] = evt.touches
	return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function controls(canvas) {
	/** @type {{ x: number; y: number } | null} */
	let lastPosition = null
	/** @type {number | null} */
	let zoomStart = null

	const vMatrix = math.mat4()
	const pMatrix = math.mat4()

	const cam = {
		//
		x: 0,
		y: 0,
		z: 0,
		rY: 0.0,
		rX: 0.0,
		distance: 3.0,
		vMatrix,
		pMatrix,
	}

	function calculate() {
		const d = cam.distance
		const sy = Math.sin(cam.rY)
		const sx = Math.sin(cam.rX)
		const cx = Math.cos(cam.rX)
		const cy = Math.cos(cam.rY)

		cam.x = d * -sy * cx
		cam.y = d * sx
		cam.z = d * cy * cx

		const vm = math.mat4()
		vm[14] -= d
		math.rotateX(vm, vm, cam.rX)
		math.rotateY(vMatrix, vm, cam.rY)
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 */
	const drag = (x, y) => {
		cam.rX += y
		cam.rY += x
		calculate()
	}

	/**
	 * @param {number} delta
	 */
	const zoom = (delta) => {
		cam.distance *= 1.0 + delta
		if (cam.distance < 0.0) cam.distance = 0.0
		calculate()
	}

	const dragEvent = (event) => {
		const client = event.touches
			? { x: event.touches[0].clientX, y: event.touches[0].clientY }
			: { x: event.clientX, y: event.clientY }

		if (lastPosition !== null) {
			drag((client.x - lastPosition.x) / 100.0, (client.y - lastPosition.y) / 100.0)
		}

		lastPosition = {
			x: client.x,
			y: client.y,
		}
	}

	canvas.addEventListener('wheel', (event) => {
		zoom(event.deltaY > 0 ? 0.05 : -0.05)
	})

	canvas.addEventListener('mousedown', () => {
		canvas.addEventListener('mousemove', dragEvent)
	})

	canvas.addEventListener('mouseup', () => {
		canvas.removeEventListener('mousemove', dragEvent)
		lastPosition = null
	})

	canvas.addEventListener('touchmove', (event) => {
		if (event.touches.length === 1 && zoomStart === null) {
			dragEvent(event)
			return
		}

		if (event.touches.length === 2 && zoomStart !== null) {
			const distance = getPinchDistance(event)
			zoom((zoomStart - distance) / 4000.0)
		}

		event.preventDefault()
		event.stopPropagation()
	})

	canvas.addEventListener('touchstart', (event) => {
		zoomStart = getPinchDistance(event)
	})

	canvas.addEventListener('touchend', (event) => {
		if (event.touches.length) return
		zoomStart = null
		lastPosition = null
	})

	function setSize() {
		const gl = getGl()
		const devicePixelRatio = window.devicePixelRatio || 1
		canvas.width = window.innerWidth * devicePixelRatio
		canvas.height = window.innerHeight * devicePixelRatio
		math.perspective(pMatrix, 45.0, canvas.width / canvas.height, 0.1, 100.0)
		gl.viewport(0, 0, canvas.width, canvas.height)
	}

	window.onresize = () => setSize()

	setSize()
	calculate()

	return cam
}
