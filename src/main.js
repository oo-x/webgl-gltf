import * as math from './math.js'
import * as utils from './utils.js'
import { loadModel, walker } from './gltf.js'
import { setCanvas } from './gl/context.js'
import { init, attribNames } from './gl.js'
import { createTexture, bindTexture, bindCubeMap } from './gl/texture.js'
import { advanceAnimation, getAnimationTransforms, initAnimations } from './animate.js'
import { controls } from './controls.js'

setCanvas('#canvas')
const canvas = document.getElementById('canvas')
const { gl, uniforms, attributes } = init()

let lastFrame = 0

const urlParams = new URLSearchParams(window.location.search)
const modelName = urlParams.get('model') || 'robot'
const model = await loadModel(`/models/${modelName}/${modelName}.gltf`)

console.log(model)

const names = ['right', 'left', 'top', 'bottom', 'front', 'back']
const diffuse = names.map((n) => utils.getImage(`environment/diffuse_${n}.jpg`))
const specular = names.map((n) => utils.getImage(`environment/specular_${n}.jpg`))

await Promise.all([
	utils.getImage('environment/brdf_lut.png').then((img) => {
		const brdf = createTexture(gl.TEXTURE_2D, [[gl.TEXTURE_2D, img]])
		bindTexture(brdf, 5, uniforms.brdfLut)
	}),
	bindCubeMap(diffuse, 6, uniforms.environmentDiffuse),
	bindCubeMap(specular, 7, uniforms.environmentSpecular),
])

const walk = walker(model)
const cam = controls(canvas)
initAnimations(model.animations)
document.getElementById('loading')?.remove()
render()

function render() {
	advanceAnimation(performance.now() - lastFrame)

	gl.clear(gl.COLOR_BUFFER_BIT)
	gl.uniform3f(uniforms.cameraPosition, cam.x, cam.y, cam.z)
	gl.uniformMatrix4fv(uniforms.viewMatrix, false, cam.vMatrix)
	gl.uniformMatrix4fv(uniforms.projectionMatrix, false, cam.pMatrix)

	const root = model.rootNode
	const axfs = new Map(getAnimationTransforms(model.animations))
	if (axfs.size) {
		const ww = walker(model, axfs)
		for (const skin of model.skins) {
			for (const [n, m] of ww(root, math.mat4())) {
				const idx = skin.joints.indexOf(n.id)
				const ibt = skin.inverseBindTransforms[idx]
				if (ibt) {
					const mat = math.multiplyMat4(null, m, ibt)
					gl.uniformMatrix4fv(uniforms.jointTransform[idx], false, mat)
				}
			}
		}

		gl.uniform1i(uniforms.isAnimated, 1)
	} else {
		gl.uniform1i(uniforms.isAnimated, 0)
	}

	gl.uniformMatrix4fv(uniforms.modelMatrix, false, model.nodes[root].matrix)

	for (const [n] of walk(root, null)) {
		if (n.mesh === undefined) continue
		const mesh = model.meshes[n.mesh]
		const m = model.materials[mesh.material]
		if (m) {
			gl.uniform1f(uniforms.metallicFactor, m.metallicFactor)
			gl.uniform1f(uniforms.roughnessFactor, m.roughnessFactor)
			gl.uniform3f(uniforms.emissiveFactor, ...m.emissiveFactor)
			gl.uniform4f(uniforms.baseColorFactor, ...m.baseColorFactor)

			bindTexture(m.baseColorTexture, 0, uniforms.baseColorTexture, uniforms.hasBaseColorTexture)
			// prettier-ignore
			bindTexture(m.metallicRoughnessTexture, 1, uniforms.metallicRoughnessTexture, uniforms.hasMetallicRoughnessTexture)
			bindTexture(m.emissiveTexture, 2, uniforms.emissiveTexture, uniforms.hasEmissiveTexture)
			bindTexture(m.normalTexture, 3, uniforms.normalTexture, uniforms.hasNormalTexture)
			bindTexture(m.occlusionTexture, 4, uniforms.occlusionTexture, uniforms.hasOcclusionTexture)
		}

		for (const k of attribNames) {
			const buf = mesh[k]
			if (!buf) continue
			const pos = attributes[k]
			gl.enableVertexAttribArray(pos)
			gl.bindBuffer(gl.ARRAY_BUFFER, buf.buffer)
			gl.vertexAttribPointer(pos, buf.size, buf.type, false, 0, 0)
		}

		if (mesh.indices) {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices)
			gl.drawElements(gl.TRIANGLES, mesh.elementCount, gl.UNSIGNED_SHORT, 0)
		} else {
			gl.drawArrays(gl.TRIANGLES, 0, mesh.elementCount)
		}
	}

	lastFrame = performance.now()

	requestAnimationFrame(() => render())
}
