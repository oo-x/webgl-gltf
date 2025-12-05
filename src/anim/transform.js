import * as math from '../math.js'

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
 * @param {import('../types').KeyFrameInfo | undefined} c
 * @param {number} elapsed
 */
const get = (c, elapsed) => ({
	translation: c?.translation.length ? getTransform(c.translation, elapsed) : math.vec3(),
	rotation: c?.rotation.length ? getTransform(c.rotation, elapsed, true) : math.quat(),
	scale: c?.scale.length ? getTransform(c.scale, elapsed) : math.vec3(math.ONE_3),
})

/**
 * Blends two animations and returns their transform matrices
 * @param {Record<string, Map<number, import('../types').KeyFrameInfo>>} animations
 * @param {{ key: string; elapsed: number }[]} active Currently running animations
 * @param blendTime Length of animation blend in milliseconds
 */
export function* getAnimationTransforms(animations, active, blendTime = 300) {
	for (const rootAnimation of active) {
		const blend = -((rootAnimation.elapsed - blendTime) / blendTime)
		for (const [c, anim] of animations[rootAnimation.key]) {
			const xf = get(anim, rootAnimation.elapsed)

			for (const ac of active) {
				if (rootAnimation.key == ac.key || blend <= 0) continue
				const fr = get(animations[ac.key].get(c), ac.elapsed)
				math.lerp3(xf.translation, xf.translation, fr.translation, blend)
				math.slerpQuat(xf.rotation, xf.rotation, fr.rotation, blend)
				math.lerp3(xf.scale, xf.scale, fr.scale, blend)
			}

			yield /** @type {[Number, import('../math').Mat4]} */ ([c, math.transformFromTRS(null, xf)])
		}
	}
}
