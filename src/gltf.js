import { mat4 } from 'gl-matrix'
import * as utils from './utils.js'
import * as constants from './constants.js'
import { getGl } from './gl/context.js'
import { createTexture } from './gl/texture.js'

const accessorSizes = {
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
	MAT2: 4,
	MAT3: 9,
	MAT4: 16,
}

/**
 * Loads a GLTF model and its assets
 * @param {string} uri URI to model
 */
export async function loadModel(uri) {
	/** @type {import('./webgl-gltf/types/gltf').GlTf} */
	const gltf = await (await fetch(uri)).json()
	const accessors = gltf.accessors
	if (!accessors?.length) throw new Error('missing accessors')

	const gl = getGl()
	const buffers = await Promise.all(gltf.buffers?.map((b) => utils.getBuffer(uri, b.uri)) ?? [])

	/** @param {import('./webgl-gltf/types/gltf').Accessor} acc */
	const readBuf = (acc) => {
		const view = gltf.bufferViews[acc.bufferView]
		const type = acc.type
		const size = accessorSizes[type]
		const componentType = acc.componentType

		const Arr = componentType == constants.BUF_FLOAT ? Float32Array : Int16Array
		const offset = (acc.byteOffset || 0) + (view.byteOffset || 0)
		const data = new Arr(buffers[view.buffer], offset, acc.count * size)

		return { size, data, type, componentType }
	}

	/** @param {number} [nm] */
	const getBuffer = (nm) => {
		if (nm === undefined) return null
		const bufferData = readBuf(accessors[nm])
		const buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(gl.ARRAY_BUFFER, bufferData.data, gl.STATIC_DRAW)

		return {
			buffer,
			size: bufferData.size,
			type: bufferData.componentType,
		}
	}

	const scene = gltf.scenes?.[gltf.scene || 0]
	const meshes =
		gltf.meshes?.map((m) => {
			const attrs = m.primitives[0].attributes

			/** @type {WebGLBuffer | null} */
			let indices = null
			let elementCount = accessors[attrs.POSITION]?.count || 0

			const idxs = m.primitives[0].indices
			if (idxs !== undefined) {
				const buf = readBuf(accessors[idxs])
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

	/** @param {{ index? number }} [t] */
	const tex = async (t) => {
		if (!gltf.images || t?.index === undefined) return null
		const uri = gltf.images[t.index]?.uri
		if (!uri) return null
		const img = await utils.getImage(`${dir}/${uri}`)
		return createTexture(gl.TEXTURE_2D, [[gl.TEXTURE_2D, img]], ext)
	}

	const materials = await Promise.all(
		gltf.materials?.map(async (m) => {
			const pbr = m.pbrMetallicRoughness
			return {
				emissiveFactor: m.emissiveFactor ?? [1, 1, 1],
				normalTexture: await tex(m.normalTexture),
				emissiveTexture: await tex(m.emissiveTexture),
				occlusionTexture: await tex(m.occlusionTexture),
				baseColorFactor: pbr?.baseColorFactor ?? [1, 1, 1, 1],
				baseColorTexture: await tex(pbr?.baseColorTexture),
				metallicFactor: pbr?.metallicFactor ?? 1.0,
				metallicRoughnessTexture: await tex(pbr?.metallicRoughnessTexture),
				roughnessFactor: pbr ? pbr.roughnessFactor ?? 1 : 0,
			}
		}) ?? []
	)

	const nodes =
		gltf.nodes?.map((n, id) => {
			const transform = mat4.create()

			if (n.translation) mat4.translate(transform, transform, n.translation)
			if (n.rotation) mat4.multiply(transform, mat4.fromQuat(mat4.create(), n.rotation), transform)
			if (n.scale) mat4.scale(transform, transform, n.scale)
			//if (n.matrix !== undefined) createMat4FromArray(n.matrix)

			return {
				id,
				name: n.name,
				skin: n.skin,
				mesh: n.mesh,
				children: n.children || [],
				localBindTransform: transform,
				animatedTransform: mat4.create(),
			}
		}) ?? []

	/** @type {import('./webgl-gltf/types/model').Animation} */
	const animations = {}
	gltf.animations?.forEach((anim) => {
		const channels = anim.channels.map((c) => {
			const sampler = anim.samplers[c.sampler]
			return {
				node: c.target.node,
				type: c.target.path,
				interpolation: sampler.interpolation ?? 'LINEAR',
				time: readBuf(accessors[sampler.input]),
				buffer: readBuf(accessors[sampler.output]),
			}
		})

		/** @type {import('./webgl-gltf/types/model').Channel} */
		const c = {}
		for (const ch of channels) {
			if (ch.node === undefined) continue
			if (c[ch.node] === undefined) {
				c[ch.node] = { translation: [], rotation: [], scale: [] }
			}

			const buf = ch.buffer
			const cubic = ch.interpolation === 'CUBICSPLINE'

			for (let i = 0; i < ch.time.data.length; ++i) {
				const n = i * buf.size * (cubic ? 3 : 1) + (cubic ? buf.size : 0)
				c[ch.node][ch.type].push({
					type: ch.type,
					time: ch.time.data[i],
					transform: [...buf.data.slice(n, n + (ch.type === 'rotation' ? 4 : 3))],
				})
			}
		}

		animations[anim.name] = c
	})

	const name = uri.split('/').slice(-1)[0]

	return /** @type {import('./webgl-gltf/types/model').Model} */ ({
		name,
		rootNode: scene?.nodes?.[0],
		meshes,
		nodes,
		animations,
		materials,
		skins:
			gltf.skins?.map((x) => {
				const xfs = readBuf(accessors[x.inverseBindMatrices])
				const ibt = x.joints.map((_, i) => xfs.data.slice(i * 16, i * 16 + 16))
				return { joints: x.joints, inverseBindTransforms: ibt }
			}) ?? [],
	})
}

/**
 * Deletes GL buffers and textures
 * @param {import('./webgl-gltf/types/model').Model} model Model to dispose
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
