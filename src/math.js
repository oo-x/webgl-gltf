/**
 * @typedef {import('./types').Vec3} Vec3
 * @typedef {import('./types').Vec4} Vec4
 * @typedef {import('./types').Mat4} Mat4
 */

export const EPSILON = 0.000001

export const ZERO_3 = /** @type {Vec3} */ ([0, 0, 0])
export const ZERO_4 = /** @type {Vec3} */ ([0, 0, 0, 0])
export const ZERO_M4 = /** @type {Mat4} */ Array.from({ length: 16 }, () => 0)

export const ONE_3 = /** @type {Vec3} */ ([1, 1, 1])
export const ONE_4 = /** @type {Vec4} */ ([1, 1, 1, 1])

export const ID_3 = ZERO_3
export const ID_Q = /** @type {Vec4} */ ([0, 0, 0, 1])
export const ID_M4 = /** @type {Mat4} */ ([...ZERO_M4])
ID_M4[0] = ID_M4[5] = ID_M4[10] = ID_M4[15] = 1

export const vec3 = (v = ID_3) => /** @type {Vec3} */ ([...v])
export const quat = (v = ID_Q) => /** @type {Vec4} */ ([...v])
export const mat4 = (v = ID_M4) => /** @type {Mat4} */ ([...v])

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
export function lerp(a, b, t) {
	return a + t * (b - a)
}

/**
 * @param {Vec3 | null} out
 * @param {Vec3} a
 * @param {Vec3} b
 * @param {number} t
 */
export function lerp3(out, a, b, t) {
	const o = out ?? vec3()
	const [ax, ay, az] = a
	o[0] = ax + t * (b[0] - ax)
	o[1] = ay + t * (b[1] - ay)
	o[2] = az + t * (b[2] - az)
	return o
}

/**
 * @param {Vec4 | null} out
 * @param {Vec4} a
 * @param {Vec4} b
 * @param {number} t
 */
export function slerpQuat(out, a, b, t) {
	const [ax, ay, az, aw] = a
	const [bx, by, bz, bw] = b

	let bm = 1
	let cosom = ax * bx + ay * by + az * bz + aw * bw

	if (cosom < 0.0) {
		bm = -1
		cosom = -cosom
	}

	// linear approximations
	let s0 = 1.0 - t
	let s1 = bm * t

	if (1.0 - cosom > EPSILON) {
		const om = Math.acos(cosom)
		const sinom = Math.sin(om)
		s0 = Math.sin(s0 * om) / sinom
		s1 = Math.sin(s1 * om) / sinom
	}

	const o = out ?? quat()
	o[0] = s0 * ax + s1 * bx
	o[1] = s0 * ay + s1 * by
	o[2] = s0 * az + s1 * bz
	o[3] = s0 * aw + s1 * bw
	return o
}

/**
 * @param {Mat4 | null} out
 * @param {Mat4} a
 * @param {Mat4} b
 */
export function multiplyMat4(out, a, b) {
	const o = out ?? mat4()
	const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a

	let [b0, b1, b2, b3] = b
	o[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
	o[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
	o[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
	o[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

	b0 = b[4]
	b1 = b[5]
	b2 = b[6]
	b3 = b[7]
	o[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
	o[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
	o[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
	o[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

	b0 = b[8]
	b1 = b[9]
	b2 = b[10]
	b3 = b[11]
	o[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
	o[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
	o[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
	o[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

	b0 = b[12]
	b1 = b[13]
	b2 = b[14]
	b3 = b[15]
	o[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
	o[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
	o[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
	o[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
	return o
}

/**
 * @param {Mat4 | null} out
 * @param {import('./types').TRS} trs
 */
export function transformFromTRS(out, trs) {
	const v = trs.translation ?? ID_3
	const [sx, sy, sz] = trs.scale ?? ONE_3
	const [x, y, z, w] = trs.rotation ?? ID_Q

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

	const o = out ?? mat4()
	o[0] = (1 - (yy + zz)) * sx
	o[1] = (xy + wz) * sx
	o[2] = (xz - wy) * sx
	o[3] = 0
	o[4] = (xy - wz) * sy
	o[5] = (1 - (xx + zz)) * sy
	o[6] = (yz + wx) * sy
	o[7] = 0
	o[8] = (xz + wy) * sz
	o[9] = (yz - wx) * sz
	o[10] = (1 - (xx + yy)) * sz
	o[11] = 0
	o[12] = v[0]
	o[13] = v[1]
	o[14] = v[2]
	o[15] = 1
	return o
}

/**
 * Generates a perspective projection matrix with the given bounds.
 *
 * @param {Mat4 | null} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum, can be null or Infinity
 */
export function perspective(out, fovy, aspect, near, far) {
	const f = 1.0 / Math.tan(fovy / 2)
	const o = out ?? mat4()
	const nf = far != null && far !== Infinity ? 1 / (near - far) : 0
	o[0] = f / aspect
	o[1] = 0
	o[2] = 0
	o[3] = 0
	o[4] = 0
	o[5] = f
	o[6] = 0
	o[7] = 0
	o[8] = 0
	o[9] = 0
	o[10] = nf ? (far + near) * nf : -1
	o[11] = -1
	o[12] = 0
	o[13] = 0
	o[14] = 2 * near * (nf ? far * nf : -1)
	o[15] = 0
	return o
}

/**
 * @param {Mat4 | null} out
 * @param {Mat4} a
 * @param {number} rad
 */
export function rotateX(out, a, rad) {
	const s = Math.sin(rad)
	const c = Math.cos(rad)
	const a10 = a[4]
	const a11 = a[5]
	const a12 = a[6]
	const a13 = a[7]
	const a20 = a[8]
	const a21 = a[9]
	const a22 = a[10]
	const a23 = a[11]

	const o = out ?? mat4()

	if (a !== o) {
		o[0] = a[0]
		o[1] = a[1]
		o[2] = a[2]
		o[3] = a[3]
		o[12] = a[12]
		o[13] = a[13]
		o[14] = a[14]
		o[15] = a[15]
	}

	o[4] = a10 * c + a20 * s
	o[5] = a11 * c + a21 * s
	o[6] = a12 * c + a22 * s
	o[7] = a13 * c + a23 * s
	o[8] = a20 * c - a10 * s
	o[9] = a21 * c - a11 * s
	o[10] = a22 * c - a12 * s
	o[11] = a23 * c - a13 * s
	return o
}

/**
 * @param {Mat4 | null} out
 * @param {Mat4} a
 * @param {number} rad
 */
export function rotateY(out, a, rad) {
	const s = Math.sin(rad)
	const c = Math.cos(rad)
	const a00 = a[0]
	const a01 = a[1]
	const a02 = a[2]
	const a03 = a[3]
	const a20 = a[8]
	const a21 = a[9]
	const a22 = a[10]
	const a23 = a[11]

	const o = out ?? mat4()

	if (a !== o) {
		o[4] = a[4]
		o[5] = a[5]
		o[6] = a[6]
		o[7] = a[7]
		o[12] = a[12]
		o[13] = a[13]
		o[14] = a[14]
		o[15] = a[15]
	}

	o[0] = a00 * c - a20 * s
	o[1] = a01 * c - a21 * s
	o[2] = a02 * c - a22 * s
	o[3] = a03 * c - a23 * s
	o[8] = a00 * s + a20 * c
	o[9] = a01 * s + a21 * c
	o[10] = a02 * s + a22 * c
	o[11] = a03 * s + a23 * c
	return o
}
