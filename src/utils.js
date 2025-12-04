const EMBEDDED_DATA_REGEXP = /(.*)data:(.*?)(;base64)?,(.*)$/

/** @param {string} uri */
export function resolveEmbeddedBuffer(uri) {
	const binaryData = atob(uri.split(',')[1])
	const arrayBuffer = new ArrayBuffer(binaryData.length)
	const uint8Array = new Uint8Array(arrayBuffer)

	for (let i = 0; i < binaryData.length; i++) {
		uint8Array[i] = binaryData.charCodeAt(i)
	}

	const blob = new Blob([uint8Array], { type: 'application/octet-stream' })
	return URL.createObjectURL(blob)
}

/**
 * @param {string} path
 * @param {string} buffer
 */
export async function getBuffer(path, buffer) {
	const dir = path.split('/').slice(0, -1).join('/')
	const finalPath = EMBEDDED_DATA_REGEXP.test(buffer) ? resolveEmbeddedBuffer(buffer) : `${dir}/${buffer}`
	const response = await fetch(finalPath)
	return await response.arrayBuffer()
}

/**
 * @param {string} uri
 * @return {Promise<HTMLImageElement>}
 */
export async function getImage(uri) {
	const src = EMBEDDED_DATA_REGEXP.test(uri) ? resolveEmbeddedBuffer(uri) : uri
	return await new Promise((resolve) => {
		const img = new Image()
		img.onload = () => resolve(img)
		img.src = src
		img.crossOrigin = 'undefined'
	})
}

/**
 * @template T
 * @template U
 * @param {Record<string, T>} o
 * @param {(key: string, val: T) => [string, U]} t
 */
export function mapObject(o, t) {
	return Object.fromEntries(Object.entries(o).map((v) => t(v[0], v[1])))
}

/**
 * @template K
 * @template T
 * @param {readonly K[]} a
 * @param {(key: K, idx: number) => T} t
 * @return {{ [Key in K]: T }}
 */
export function mapToObject(a, t) {
	return Object.fromEntries(a.map((k, i) => [k, t(k, i)]))
}
