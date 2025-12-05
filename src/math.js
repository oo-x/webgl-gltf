export const ONE_3 = /** @type {import('./gltf/types').Vec3} */ ([1, 1, 1])
export const ONE_4 = /** @type {import('./gltf/types').Vec4} */ ([1, 1, 1, 1])

export const ZERO_3 = /** @type {import('./gltf/types').Vec3} */ ([0, 0, 0])
export const ZERO_Q = /** @type {import('./gltf/types').Vec4} */ ([0, 0, 0, 1])

/**
 * @param {import('./types').TRS} trs
 */
export function transformFromTRS(trs) {
	const v = trs.translation ?? ZERO_3
	const [sx, sy, sz] = trs.scale ?? ONE_3
	const [x, y, z, w] = trs.rotation ?? ZERO_Q

	const x2 = x + x
	const y2 = y + y
	const z2 = z + z
	const xx = x * x2
	const xy = x * y2
	const xz = x * z2
	const yy = y * y2
	const yz = y * z2
	const zz = z * z2
	const wx = w * x2
	const wy = w * y2
	const wz = w * z2

	return /** @type {import('./types').Mat4} */ ([
		(1 - (yy + zz)) * sx,
		(xy + wz) * sx,
		(xz - wy) * sx,
		0,
		(xy - wz) * sy,
		(1 - (xx + zz)) * sy,
		(yz + wx) * sy,
		0,
		(xz + wy) * sz,
		(yz - wx) * sz,
		(1 - (xx + yy)) * sz,
		0,
		v[0],
		v[1],
		v[2],
		1,
	])
}
