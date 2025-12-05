import { transformFromTRS } from '../math.js'

/**
 * @param {import('./types').RawNode} raw
 */
export function processNode(raw) {
	const { children = [], matrix: m, ...n } = raw
	return {
		...n,
		children,
		matrix: m ?? transformFromTRS(n),
	}
}
