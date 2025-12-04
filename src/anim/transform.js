import { mat4, vec3, quat } from 'gl-matrix'

/**
 * @param {import('../webgl-gltf/types/model').KeyFrame[]} keyFrames
 * @param {number} animationTime
 */
const getPreviousAndNextKeyFrame = (keyFrames, animationTime) => {
	let next = keyFrames[0]
	let previous = keyFrames[0]

	for (const frame of keyFrames) {
		next = frame
		if (next.time > animationTime) break
		previous = frame
	}

	return [previous, next]
}

/**
 * @param {import('../webgl-gltf/types/model').KeyFrame[]} keyFrames
 * @param {number} duration
 */
const getTransform = (keyFrames, duration) => {
	if (keyFrames.length === 1) return keyFrames[0].transform

	const animationTime = (duration / 1000.0) % keyFrames[keyFrames.length - 1].time
	const [prev, next] = getPreviousAndNextKeyFrame(keyFrames, animationTime)
	const progression = (animationTime - prev.time) / (next.time - prev.time)

	switch (prev.type) {
		case 'translation':
		case 'scale': {
			const result = vec3.create()
			vec3.lerp(result, prev.transform, next.transform, progression)
			return result
		}
		case 'rotation': {
			const result = quat.create()
			quat.slerp(result, prev.transform, next.transform, progression)
			return result
		}
	}
}

/**
 * @param {import('../webgl-gltf/types/model').Transform} c
 * @param {number} elapsed
 */
const get = (c, elapsed) => {
	const t = c && c.translation.length > 0 ? getTransform(c.translation, elapsed) : vec3.create()
	const r = c && c.rotation.length > 0 ? getTransform(c.rotation, elapsed) : quat.create()
	const s = c && c.scale.length > 0 ? getTransform(c.scale, elapsed) : vec3.fromValues(1, 1, 1)
	return { t, r, s }
}

/**
 * Blends two animations and returns their transform matrices
 * @param {import('../webgl-gltf/types/model').Model} model GLTF Model
 * @param {Record<string, import('../webgl-gltf/animation').ActiveAnimation[]>} activeAnimations Currently running animations
 * @param blendTime Length of animation blend in milliseconds
 */
export function getAnimationTransforms(model, activeAnimations, blendTime = 0) {
	/** @type {Record<string, mat4>} */
	const transforms = {}

	for (const animations of Object.values(activeAnimations)) {
		for (const rootAnimation of animations) {
			const blend = -((rootAnimation.elapsed - blendTime) / blendTime)
			for (const [c, anim] of Object.entries(model.animations[rootAnimation.key])) {
				const transform = get(anim, rootAnimation.elapsed)
				for (const ac of animations) {
					if (rootAnimation.key == ac.key || blend <= 0) continue
					const cTransform = get(model.animations[ac.key][c], ac.elapsed)
					vec3.lerp(transform.t, transform.t, cTransform.t, blend)
					quat.slerp(transform.r, transform.r, cTransform.r, blend)
					vec3.lerp(transform.s, transform.s, cTransform.s, blend)
				}

				const localTransform = mat4.create()
				const rotTransform = mat4.create()
				mat4.fromQuat(rotTransform, transform.r)
				mat4.translate(localTransform, localTransform, transform.t)
				mat4.multiply(localTransform, localTransform, rotTransform)
				mat4.scale(localTransform, localTransform, transform.s)
				transforms[c] = localTransform
			}
		}
	}

	return transforms
}
