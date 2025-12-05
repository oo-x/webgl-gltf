import * as utils from './utils.js'
import { getGl } from './gl/context.js'
import { createTexture } from './gl/texture.js'
import { processNode } from './gltf/node.js'
import { makeReadBuffer } from './gltf/buffer.js'
import { processMaterial } from './gltf/material.js'

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

	/** @type {import('./webgl-gltf/types/model').Animation} */
	const animations = {}
	gltf.animations?.forEach((anim) => {
		const channels = anim.channels.map((c) => {
			const sampler = anim.samplers[c.sampler]
			return {
				node: c.target.node,
				type: c.target.path,
				interpolation: sampler.interpolation ?? 'LINEAR',
				time: readBuf(sampler.input),
				buffer: readBuf(sampler.output),
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
