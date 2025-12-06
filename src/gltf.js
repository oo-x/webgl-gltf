import * as math from './math.js'
import * as utils from './utils.js'
import { getGl } from './gl/context.js'
import { createTexture } from './gl/texture.js'

/**
 * @typedef {import('./types').Vec3} Vec3
 * @typedef {import('./types').Vec4} Vec4
 * @typedef {import('./types').Mat4} Mat4
 */

/**
 * Loads a GLTF model and its assets
 * @param {string} uri URI to model
 */
export async function loadModel(uri) {
	const gltf = await (await fetch(uri)).json()
	const accessors = gltf.accessors
	if (!accessors?.length) throw new Error('missing accessors')

	const gl = getGl()
	const buffers = await Promise.all(gltf.buffers?.map((b) => utils.getBuffer(uri, b.uri)) ?? [])
	const readBuf = makeReadBuffer(buffers, gltf.bufferViews, accessors)

	/** @param {number} [nm] */
	const getBuffer = (nm) => {
		if (nm === undefined) return null
		const bufferData = readBuf(nm)
		const buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(gl.ARRAY_BUFFER, bufferData.data, gl.STATIC_DRAW)

		return {
			buffer,
			size: bufferData.size,
			type: bufferData.componentType,
		}
	}

	const meshes =
		gltf.meshes?.map((m) => {
			const attrs = m.primitives[0].attributes

			/** @type {WebGLBuffer | null} */
			let indices = null
			let elementCount = accessors[attrs.POSITION]?.count || 0

			const idxs = m.primitives[0].indices
			if (idxs !== undefined) {
				const buf = readBuf(idxs)
				indices = gl.createBuffer()
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buf.data, gl.STATIC_DRAW)
				elementCount = buf.data.length
			}

			return {
				indices,
				elementCount,
				material: m.primitives[0].material,
				positions: getBuffer(attrs.POSITION),
				tangents: getBuffer(attrs.TANGENT),
				normals: getBuffer(attrs.NORMAL),
				joints: getBuffer(attrs.JOINTS_0),
				weights: getBuffer(attrs.WEIGHTS_0),
				texCoord: getBuffer(attrs.TEXCOORD_0),
			}
		}) ?? []

	const dir = uri.split('/').slice(0, -1).join('/')
	const ext = gl.getExtension('EXT_texture_filter_anisotropic')

	/** @param {number | null} [t] */
	const tex = async (t) => {
		if (!gltf.images || t === null) return null
		const uri = gltf.images[t]?.uri
		if (!uri) return null
		const img = await utils.getImage(`${dir}/${uri}`)
		return createTexture(gl.TEXTURE_2D, [[gl.TEXTURE_2D, img]], ext)
	}

	const materials = await Promise.all(
		gltf.materials?.map(async (raw) => {
			const { textures, ...m } = processMaterial(raw)
			return {
				...m,
				normalTexture: await tex(textures.normal),
				emissiveTexture: await tex(textures.emissive),
				occlusionTexture: await tex(textures.occlusion),
				baseColorTexture: await tex(textures.baseColor),
				metallicRoughnessTexture: await tex(textures.metallicRoughness),
			}
		}) ?? []
	)

	const nodes = gltf.nodes?.map((n, id) => ({ id, ...processNode(n) })) ?? []

	const animations = gltf.animations?.map((ani) => {
		/** @type {Map<number, import('./types').KeyFrameInfo>} */
		const channels = new Map()

		const { samplers, channels: chn, ...anim } = /** @type {import('./types').Animation} */ (ani)

		for (const ch of chn) {
			const node = ch.target?.node
			if (node === undefined) continue
			if (!channels.has(node)) {
				channels.set(node, { translation: [], rotation: [], scale: [] })
			}

			const path = ch.target.path
			const sampler = samplers[ch.sampler]
			const buf = readBuf(sampler.output)
			const time = readBuf(sampler.input)
			const len = time.data.length
			const rot = path === 'rotation'
			const cubic = sampler.interpolation === 'CUBICSPLINE'

			for (let i = 0; i < len; ++i) {
				const n = i * buf.size * (cubic ? 3 : 1) + (cubic ? buf.size : 0)
				channels.get(node)?.[path].push({
					t: time.data[i],
					v: [...buf.data.slice(n, n + (rot ? 4 : 3))],
				})
			}
		}

		return {
			...anim,
			channels,
		}
	})

	const name = uri.split('/').slice(-1)[0]

	return {
		name,
		rootNode: gltf.scenes?.[gltf.scene || 0]?.nodes?.[0],
		meshes,
		nodes,
		animations,
		materials,
		skins:
			gltf.skins?.map((x) => {
				const xfs = readBuf(x.inverseBindMatrices)
				const ibt = x.joints.map((_, i) => xfs.data.slice(i * 16, i * 16 + 16))
				return { joints: x.joints, inverseBindTransforms: ibt }
			}) ?? [],
	}
}

/**
 * Deletes GL buffers and textures
 * @param {Awaited<ReturnType<typeof loadModel>>} model Model to dispose
 */
export const dispose = (model) => {
	const gl = getGl()
	for (const m of model.meshes) {
		gl.deleteBuffer(m.indices)
		if (m.joints) gl.deleteBuffer(m.joints.buffer)
		if (m.normals) gl.deleteBuffer(m.normals.buffer)
		if (m.positions) gl.deleteBuffer(m.positions.buffer)
		if (m.tangents) gl.deleteBuffer(m.tangents.buffer)
		if (m.texCoord) gl.deleteBuffer(m.texCoord.buffer)
		if (m.weights) gl.deleteBuffer(m.weights.buffer)

		m.indices = null
		m.joints = null
		m.normals = null
		m.tangents = null
		m.texCoord = null
		m.weights = null
	}

	for (const m of model.materials) {
		if (m.baseColorTexture) gl.deleteTexture(m.baseColorTexture)
		if (m.emissiveTexture) gl.deleteTexture(m.emissiveTexture)
		if (m.normalTexture) gl.deleteTexture(m.normalTexture)
		if (m.occlusionTexture) gl.deleteTexture(m.occlusionTexture)
		if (m.metallicRoughnessTexture) gl.deleteTexture(m.metallicRoughnessTexture)

		m.baseColorTexture = null
		m.emissiveTexture = null
		m.normalTexture = null
		m.occlusionTexture = null
		m.metallicRoughnessTexture = null
	}
}

/** @param {{ index?: number }} [t] */
const getImgIdx = (t) => (t?.index === undefined ? null : t.index)

/**
 * @param {import('./types').RawMaterial} m
 */
export function processMaterial(m) {
	const pbr = m.pbrMetallicRoughness
	return {
		emissiveFactor: m.emissiveFactor ?? math.ONE_3,
		baseColorFactor: pbr?.baseColorFactor ?? math.ONE_4,
		metallicFactor: pbr?.metallicFactor ?? 1.0,
		roughnessFactor: pbr ? pbr.roughnessFactor ?? 1 : 0,
		textures: {
			normal: getImgIdx(m.normalTexture),
			emissive: getImgIdx(m.emissiveTexture),
			occlusion: getImgIdx(m.occlusionTexture),
			baseColor: getImgIdx(pbr?.baseColorTexture),
			metallicRoughness: getImgIdx(pbr?.metallicRoughnessTexture),
		},
	}
}

/**
 * @param {import('./types').RawNode} raw
 */
export function processNode(raw) {
	const { children = [], matrix: m, ...n } = raw
	return {
		...n,
		children,
		matrix: m ?? math.transformFromTRS(null, n),
	}
}

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

/**
 * @param {Awaited<ReturnType<typeof loadModel>>} model
 */
export function walker(model, transforms = null) {

	/**
	 * @param {number} idx
	 * @param {Mat4 | null} matrix
	 * @return {Generator<[import('./types').GlNode, Mat4 | null], void>}
	 */
	function* walk(idx, matrix) {
		const n = model.nodes[idx]
		if (n) {
			if (matrix) {
				math.multiplyMat4(matrix, matrix, transforms?.get(n.id) ?? n.matrix)
			}
			yield [n, matrix]
			if (n.children?.length) {
				for (const c of n.children) {
					yield* walk(c, matrix ? math.mat4(matrix) : null)
				}
			}
		}
	}

	return walk
}
