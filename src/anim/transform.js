import * as math from '../math.js'

/**
 * @param {import('../webgl-gltf/types/model').KeyFrame[]} keyFrames
 * @param {number} duration
 */
const getTransform = (keyFrames, duration, slerp = false) => {
	const len = keyFrames.length
	if (len < 2) return keyFrames[0].transform

	const dt = (duration / 1000.0) % keyFrames[len - 1].time
	const idx = keyFrames.findIndex((fr) => fr.time > dt)
	if (idx < 1) return keyFrames[0].transform

	const next = keyFrames[idx]
	const prev = keyFrames[idx - 1]
	const progression = (dt - prev.time) / (next.time - prev.time)

	return slerp
		? math.slerpQuat(null, prev.transform, next.transform, progression)
		: math.lerp3(null, prev.transform, next.transform, progression)
}

/**
 * @param {import('../webgl-gltf/types/model').Transform} c
 * @param {number} elapsed
 */
const get = (c, elapsed) => {
	const t = c?.translation?.length ? getTransform(c.translation, elapsed) : math.vec3()
	const r = c?.rotation?.length ? getTransform(c.rotation, elapsed, true) : math.quat()
	const s = c?.scale?.length ? getTransform(c.scale, elapsed) : math.vec3(math.ONE_3)
	return { translation: t, rotation: r, scale: s }
}

/**
 * Blends two animations and returns their transform matrices
 * @param {import('../webgl-gltf/types/model').Model} model GLTF Model
 * @param {Record<string, { key: string; elapsed: number }[]>} activeAnimations Currently running animations
 * @param blendTime Length of animation blend in milliseconds
 */
export function getAnimationTransforms(model, activeAnimations, blendTime = 0) {
	/** @type {Record<string, number[]>} */
	const transforms = {}

	for (const animations of Object.values(activeAnimations)) {
		for (const rootAnimation of animations) {
			const blend = -((rootAnimation.elapsed - blendTime) / blendTime)
			for (const [c, anim] of Object.entries(model.animations[rootAnimation.key])) {
				const xf = get(anim, rootAnimation.elapsed)

				for (const ac of animations) {
					if (rootAnimation.key == ac.key || blend <= 0) continue
					const fr = get(model.animations[ac.key][c], ac.elapsed)
					math.lerp3(xf.translation, xf.translation, fr.translation, blend)
					math.slerpQuat(xf.rotation, xf.rotation, fr.rotation, blend)
					math.lerp3(xf.scale, xf.scale, fr.scale, blend)
				}

				transforms[c] = math.transformFromTRS(null, xf)
			}
		}
	}

	return transforms
}
