import { loadModel } from './gltf.js'

const urlParams = new URLSearchParams(window.location.search)
const modelName = urlParams.get('model') || 'robot'
const model = await loadModel(`/models/${modelName}/${modelName}.gltf`)
const anims = Object.keys(model.animations)
