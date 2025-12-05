// @ts-check
export const BUF_SHORT = 5123
export const BUF_FLOAT = 5126

const accessorSizes = /** @type {const} */ ({
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
	MAT2: 4,
	MAT3: 9,
	MAT4: 16,
})

/**
 * @param {ArrayBuffer[]} buffers
 * @param {import('./types').BufferView[]} bufferViews
 * @param {import('./types').Accessor[]} accessors
 */
export function makeReadBuffer(buffers, bufferViews, accessors) {
	/**
	 * @param {number} idx
	 */
	return function read(idx) {
		const acc = accessors[idx]
		if (acc?.bufferView === undefined) throw new Error('undefined bufferView')
		const view = bufferViews[acc.bufferView]
		const type = acc.type
		const size = accessorSizes[type]
		const componentType = acc.componentType

		const Arr = componentType == BUF_FLOAT ? Float32Array : Int16Array
		const offset = (acc.byteOffset || 0) + (view.byteOffset || 0)
		const data = new Arr(buffers[view.buffer], offset, acc.count * size)

		return {
			size,
			data,
			type,
			componentType,
		}
	}
}
