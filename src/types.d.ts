export type NodeId = number

export type Mat4 = number[]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export type TRS = {
	translation?: Vec3

	rotation?: Vec4

	scale?: Vec3
}

export type RawNode = {
	camera?: NodeId

	skin?: NodeId

	children?: NodeId[]

	matrix?: Mat4

	translation?: Vec3

	rotation?: Vec4

	scale?: Vec3

	weights?: number[]

	[k: string]: unknown
}

export type GlNode = {
	mesh?: number

	camera?: number

	matrix: Mat4

	children: NodeId[]
}

/**
 * A view into a buffer generally representing a subset of the buffer.
 */
export type BufferView = {
	/** The index of the buffer */
	buffer: number

	/** The offset into the buffer in bytes  */
	byteOffset?: number

	/** The total byte length of the buffer view */
	byteLength: number

	/** The stride, in bytes */
	byteStride?: number

	/** The target that the GPU buffer should be bound to */
	target?: 34962 | 34963 | number

	[k: string]: unknown
}

export type Accessor = {
	/** The index of the bufferView */
	bufferView?: number

	/** The offset relative to the start of the bufferView in bytes */
	byteOffset?: number

	/** The datatype of components in the attribute */
	componentType: 5120 | 5121 | 5122 | 5123 | 5125 | 5126

	/** Specifies whether integer data values should be normalized */
	normalized?: boolean

	/** The number of attributes referenced by this accessor */
	count: number

	/** Specifies if the attribute is a scalar, vector, or matrix */
	type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4'

	/** Maximum value of each component in this attribute */
	max?: number[]

	/** Minimum value of each component in this attribute */
	min?: number[]

	/** Sparse storage of attributes that deviate from their initialization value */
	sparse?: unknown

	[k: string]: unknown
}

/**
 * Reference to a texture.
 */
export type TextureInfo = {
	index: number

	/** The set index of texture's TEXCOORD attribute used for texture coordinate mapping.  */
	texCoord?: number

	[k: string]: unknown
}

export type RawMaterial = {
	pbrMetallicRoughness?: {
		/** The material's base color factor.  */
		baseColorFactor?: Vec4
		/** The base color texture.  */
		baseColorTexture?: TextureInfo
		/** The metalness of the material */
		metallicFactor?: number
		/** The roughness of the material */
		roughnessFactor?: number
		/** The metallic-roughness texture */
		metallicRoughnessTexture?: TextureInfo
	}

	/** The normal map texture */
	normalTexture?: TextureInfo

	/** The occlusion map texture */
	occlusionTexture?: TextureInfo

	/** The emissive map texture */
	emissiveTexture?: TextureInfo

	/** The emissive color of the material */
	emissiveFactor?: Vec3

	/** The alpha rendering mode of the material */
	alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'

	/** The alpha cutoff value of the material */
	alphaCutoff?: number

	/** Specifies whether the material is double sided */
	doubleSided?: boolean

	[k: string]: unknown
}

export type KeyFrameInfo = {
	translation: { t: number; v: Vec3 }[]
	rotation: { t: number; v: Vec4 }[]
	scale: { t: number; v: Vec3 }[]
	weights?: { t: number }[]
}

export type AnimationChannel = {
	sampler: number
	target: {
		node: number
		path: 'translation' | 'rotation' | 'scale' | 'weights'
	}
}

export type AnimationSampler = {
	input: number
	output: number
	interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE'
}

export type Animation = {
	name?: string
	channels: AnimationChannel[]
	samplers: AnimationSampler[]
}