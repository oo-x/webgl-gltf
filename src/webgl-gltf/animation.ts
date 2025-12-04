export interface ActiveAnimation {
	key: string
	elapsed: number
}

interface Animations {
	[model: string]: Record<string, ActiveAnimation[]>
}

const activeAnimations: Animations = {}

/**
 * @param {string} track
 * @param {string} key
 */
const getAnimationFromLast = (track: string, key: string, offset = 0) => {
	const active = activeAnimations[track]?.[key]
	return active?.[active.length - offset - 1]
}

/**
 * Sets the active animation
 * @param track Animation track
 * @param key Animation set key
 * @param model GLTF Model
 * @param animation Animation key
 */
export const pushAnimation = (track: string, key: string, model: string, animation: string) => {
	const k = `${key}_${model}`
	if (!activeAnimations[track]) activeAnimations[track] = {}
	if (!activeAnimations[track][k]) activeAnimations[track][k] = []
	if (getAnimationFromLast(track, k)?.key === animation) return

	activeAnimations[track][k].push({ key: animation, elapsed: 0 })
	activeAnimations[track][k].slice(activeAnimations[track][k].length - 2)
}

/**
 * Gets the current and previous animation
 * @param key Animation set key
 * @param model GLTF Model
 */
export const getActiveAnimations = (key: string, model: string) => {
	if (!Object.keys(activeAnimations).length) return null

	const k = `${key}_${model}`
	const aa = {}

	for (const [c, anim] of Object.entries(activeAnimations)) {
		if (!anim[k]) continue
		aa[c] = anim[k].slice(anim[k].length - 2)
	}

	return aa
}

/**
 * Advances the animation
 * @param elapsed Time elasped since last update
 * @param key Animation set key
 */
export const advanceAnimation = (elapsed: number, key?: string) => {
	for (const [c, anim] of Object.entries(activeAnimations)) {
		for (const m of Object.keys(anim)) {
			if (key && m.indexOf(key) !== 0) continue

			const current = getAnimationFromLast(c, m)
			const previous = getAnimationFromLast(c, m, 1)

			if (current) current.elapsed += elapsed
			if (previous) previous.elapsed += elapsed
		}
	}
}
