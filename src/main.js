import { loadModel } from './webgl-gltf/gltf'

const urlParams = new URLSearchParams(window.location.search)
const modelName = urlParams.get('model') || 'robot'
const model = await loadModel(gl, `/models/${modelName}/${modelName}.gltf`)
const anims = Object.keys(model.animations)
