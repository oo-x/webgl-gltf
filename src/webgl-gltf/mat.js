import { mat4, quat } from 'gl-matrix'

/**
 * @param {Float32Array | Int16Array | number[]} a
 */
export const createMat4FromArray = (a) => {
	return mat4.fromValues(
		a[0],
		a[1],
		a[2],
		a[3],
		a[4],
		a[5],
		a[6],
		a[7],
		a[8],
		a[9],
		a[10],
		a[11],
		a[12],
		a[13],
		a[14],
		a[15]
	)
}

/**
 * @param {mat4} xf
 * @param {number[]} rot
 */
export const applyRotationFromQuat = (xf, rot) => {
	const mat = mat4.create()
	mat4.fromQuat(mat, quat.fromValues(rot[0], rot[1], rot[2], rot[3]))
	mat4.multiply(xf, mat, xf)
}
