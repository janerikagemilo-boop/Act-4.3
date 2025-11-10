import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

/**
 * Loaders
 */
const gltfLoader = new GLTFLoader()
const textureLoader = new THREE.TextureLoader()
const cubeTextureLoader = new THREE.CubeTextureLoader()

/**
 * Base
 */
// Debug
const gui = new dat.GUI()
const debugObject = {}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Update all materials
 */
const updateAllMaterials = () =>
{
    scene.traverse((child) =>
    {
        if(child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial)
        {
            // child.material.envMap = environmentMap
            child.material.envMapIntensity = debugObject.envMapIntensity
            child.material.needsUpdate = true
            child.castShadow = true
            child.receiveShadow = true
        }
    })
}

/**
 * Environment map
 */
const environmentMap = cubeTextureLoader.load([
    '/textures/environmentMap/px.jpg',
    '/textures/environmentMap/nx.jpg',
    '/textures/environmentMap/py.jpg',
    '/textures/environmentMap/ny.jpg',
    '/textures/environmentMap/pz.jpg',
    '/textures/environmentMap/nz.jpg'
])

environmentMap.encoding = THREE.sRGBEncoding

// scene.background = environmentMap
scene.environment = environmentMap

debugObject.envMapIntensity = 0.4
gui.add(debugObject, 'envMapIntensity').min(0).max(4).step(0.001).onChange(updateAllMaterials)

/**
 * Models
 */
let foxMixer = null

gltfLoader.load(
    '/models/Fox/glTF/Fox.gltf',
    (gltf) =>
    {
        // Model
        gltf.scene.scale.set(0.02, 0.02, 0.02)
        scene.add(gltf.scene)

        // Animation
        foxMixer = new THREE.AnimationMixer(gltf.scene)
        const actions = {}
        gltf.animations.forEach((clip) => {
            actions[clip.name] = foxMixer.clipAction(clip)
        })
        const animationNames = Object.keys(actions)
        debugObject.animation = animationNames[0] || 'Animation'
        const playAnimation = (name) => {
            for(const n of animationNames){
                const action = actions[n]
                if(n === name){
                    action.reset().fadeIn(0.2).play()
                } else {
                    action.fadeOut(0.2).stop()
                }
            }
        }
        playAnimation(debugObject.animation)
        gui.add(debugObject, 'animation', animationNames).name('animation').onChange(playAnimation)
        gui.add(foxMixer, 'timeScale').min(0).max(3).step(0.01).name('animationSpeed')

        // Update materials
        updateAllMaterials()

        // Ground text is created below as a canvas texture on a plane
    }
)

/**
 * Floor
 */
const floorColorTexture = textureLoader.load('textures/dirt/color.jpg')
floorColorTexture.encoding = THREE.sRGBEncoding
floorColorTexture.repeat.set(1.5, 1.5)
floorColorTexture.wrapS = THREE.RepeatWrapping
floorColorTexture.wrapT = THREE.RepeatWrapping

const floorNormalTexture = textureLoader.load('textures/dirt/normal.jpg')
floorNormalTexture.repeat.set(1.5, 1.5)
floorNormalTexture.wrapS = THREE.RepeatWrapping
floorNormalTexture.wrapT = THREE.RepeatWrapping

const floorGeometry = new THREE.CircleGeometry(5, 64)
const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorColorTexture,
    normalMap: floorNormalTexture
})
const floor = new THREE.Mesh(floorGeometry, floorMaterial)
floor.rotation.x = - Math.PI * 0.5
scene.add(floor)

/**
 * Curved ground text (CanvasTexture on a plane)
 */
function createCurvedTextMesh(text) {
    const size = 1024
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // Clear
    ctx.clearRect(0, 0, size, size)

    // Style
    const fontPx = 90
    const lineHeightPx = Math.round(fontPx * 1.15)
    const letterSpacingPx = 2
    const mirrorHorizontally = false // do not mirror whole text
    const mirrorLetters = false // draw letters upright (no per-letter mirror)

    ctx.fillStyle = '#000000'
    ctx.font = `bold ${fontPx}px Arial, Helvetica, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
    ctx.shadowBlur = 14
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Apply horizontal mirror so text is readable from front view
    if (mirrorHorizontally) {
        ctx.translate(size, 0)
        ctx.scale(-1, 1)
    }

    const cx = size / 2
    const cy = size / 2
    // Flush to circle edge: center radius minus half line height
    const radius = (size / 2) - (lineHeightPx / 2)

    // Optional kerning adjustments for specific letter pairs (in pixels)
    const kerningPairsPx = {
        // Fine-tune: keep I clearly visible after N, relax IN pair
        'NI': -2,
        'IN': 0
    }

    // Compute total angle span based on character widths and kerning
    const widths = Array.from(text).map(ch => ctx.measureText(ch).width)
    let pairKerningTotal = 0
    for (let i = 0; i < text.length - 1; i++) {
        const pair = text[i] + text[i + 1]
        pairKerningTotal += kerningPairsPx[pair] || 0
    }
    const totalWidth = widths.reduce((a, b) => a + b, 0) + Math.max(0, (text.length - 1) * letterSpacingPx) + pairKerningTotal
    const totalAngle = totalWidth / radius
    // Place text centered on the bottom arc so it reads to the viewer
    let angle = (3 * Math.PI) / 2 - totalAngle / 2

    // Draw each character along the arc
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        const w = widths[i]
        ctx.save()
        const x = cx + radius * Math.cos(angle)
        const y = cy + radius * Math.sin(angle)
        ctx.translate(x, y)
        // Keep glyphs upright for bottom placement
        ctx.rotate(angle + Math.PI / 2)
        if (mirrorLetters) {
            ctx.scale(-1, 1)
        }
        ctx.fillText(ch, 0, 0)
        ctx.restore()
        const pair = i < text.length - 1 ? (text[i] + text[i + 1]) : null
        const extra = pair ? (kerningPairsPx[pair] || 0) : 0
        angle += (w + letterSpacingPx + extra) / radius
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.encoding = THREE.sRGBEncoding
    texture.anisotropy = 4
    texture.needsUpdate = true

    const planeSize = 10 // match floor diameter (radius 5), no margins
    const geom = new THREE.PlaneGeometry(planeSize, planeSize)
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
    mat.depthWrite = false
    mat.polygonOffset = true
    mat.polygonOffsetFactor = -0.1
    const mesh = new THREE.Mesh(geom, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.011 // slight lift to avoid z-fighting
    return mesh
}

const groundText = createCurvedTextMesh('SUMMONING ERU')
scene.add(groundText)

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 4)
directionalLight.castShadow = true
directionalLight.shadow.camera.far = 15
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.normalBias = 0.05
directionalLight.position.set(3.5, 2, - 1.25)
scene.add(directionalLight)

gui.add(directionalLight, 'intensity').min(0).max(10).step(0.001).name('lightIntensity')
gui.add(directionalLight.position, 'x').min(- 5).max(5).step(0.001).name('lightX')
gui.add(directionalLight.position, 'y').min(- 5).max(5).step(0.001).name('lightY')
gui.add(directionalLight.position, 'z').min(- 5).max(5).step(0.001).name('lightZ')

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.set(6, 4, 8)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.physicallyCorrectLights = true
renderer.outputEncoding = THREE.sRGBEncoding
renderer.toneMapping = THREE.CineonToneMapping
renderer.toneMappingExposure = 1.75
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setClearColor('#211d20')
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// Exposure control
gui.add(renderer, 'toneMappingExposure').min(0).max(4).step(0.001).name('exposure')

// 2D Label renderer
const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(sizes.width, sizes.height)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0px'
labelRenderer.domElement.style.left = '0px'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

/**
 * Animate
 */
const clock = new THREE.Clock()
let previousTime = 0

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    // Update controls
    controls.update()

    // Fox animation
    if(foxMixer)
    {
        foxMixer.update(deltaTime)
    }

    // Render
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()

// Keep label renderer in sync on resize
window.addEventListener('resize', () => {
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
})