export { loadModel, dispose } from './gltf'

export { getAnimationTransforms, applyToSkin } from './animator'

export { pushAnimation, getActiveAnimations, advanceAnimation, type ActiveAnimation } from './animation'

export type {
	Model,
	GLBuffer,
	Node,
	Skin,
	Animation,
	Channel,
	Transform,
	KeyFrame,
	Mesh,
	Material,
} from './types/model'
