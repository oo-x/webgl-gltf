import * as math from './math.js'

/** @type {{ key: number; elapsed: number }[]} */
const activeAnimations = []

/**
 * @param {{ t: number, v: number[] }[]} keyFrames
 * @param {number} duration
 */
const getTransform = (keyFrames, duration, slerp = false) => {
	const len = keyFrames.length
	if (len < 2) return keyFrames[0].v

	const dt = (duration / 1000.0) % keyFrames[len - 1].t
	const idx = keyFrames.findIndex((fr) => fr.t > dt)
	if (idx < 1) return keyFrames[0].v

	const next = keyFrames[idx]
	const prev = keyFrames[idx - 1]
	const t = (dt - prev.t) / (next.t - prev.t)

	return slerp ? math.slerpQuat(null, prev.v, next.v, t) : math.lerp3(null, prev.v, next.v, t)
}

/**
 * @param {import('./types').KeyFrameInfo | undefined} c
 * @param {number} elapsed
 */
const get = (c, elapsed) => ({
	translation: c?.translation.length ? getTransform(c.translation, elapsed) : math.vec3(),
	rotation: c?.rotation.length ? getTransform(c.rotation, elapsed, true) : math.quat(),
	scale: c?.scale.length ? getTransform(c.scale, elapsed) : math.vec3(math.ONE_3),
})

/**
 * Blends two animations and returns their transform matrices
 * @param {{ channels: Map<number, import('./types').KeyFrameInfo> }[]} animations
 * @param blendTime Length of animation blend in milliseconds
 */
export function* getAnimationTransforms(animations, blendTime = 300) {
	const active = activeAnimations.slice(-2)
	if (!active) return
	for (const rootAnimation of active) {
		const blend = -((rootAnimation.elapsed - blendTime) / blendTime)
		for (const [c, anim] of animations[rootAnimation.key].channels) {
			const xf = get(anim, rootAnimation.elapsed)

			for (const ac of active) {
				if (rootAnimation.key == ac.key || blend <= 0) continue
				const fr = get(animations[ac.key].channels.get(c), ac.elapsed)
				math.lerp3(xf.translation, xf.translation, fr.translation, blend)
				math.slerpQuat(xf.rotation, xf.rotation, fr.rotation, blend)
				math.lerp3(xf.scale, xf.scale, fr.scale, blend)
			}

			yield /** @type {[Number, import('./math').Mat4]} */ ([c, math.transformFromTRS(null, xf)])
		}
	}
}

/**
 * Sets the active animation
 * @param {number} key
 */
function pushAnimation(key) {
	const len = activeAnimations.length
	if (activeAnimations[len - 1]?.key === key) return
	if (len > 2) activeAnimations.shift()
	activeAnimations.push({ key, elapsed: 0 })
}

/**
 * Advances the animation
 * @param {number} elapsed Time elasped since last update
 */
export function advanceAnimation(elapsed) {
	const len = activeAnimations.length
	const current = activeAnimations[len - 1]
	if (current) current.elapsed += elapsed

	const previous = activeAnimations[len - 2]
	if (previous) previous.elapsed += elapsed
}

/** @param {unknown[]} */
export function initAnimations(animations) {
	if (!animations?.length) return
	pushAnimation(0)
	const ui = document.getElementById('ui')
	for (const [i, a] of animations.entries()) {
		const btn = document.createElement('button')
		btn.innerText = a.name || `anim ${i}`
		btn.addEventListener('click', () => pushAnimation(i))
		ui.appendChild(btn)
	}
}
