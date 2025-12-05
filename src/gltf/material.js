import * as math from '../math.js'

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
