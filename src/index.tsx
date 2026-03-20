/* @refresh reload */

import type Jolt from 'jolt-physics'
import { createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import {
    ACESFilmicToneMapping,
    AmbientLight,
    BufferGeometry,
    DirectionalLight,
    EquirectangularReflectionMapping,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Scene,
    Vector3,
    WebGLRenderer
} from 'three'
import * as CSM from 'three/examples/jsm/csm/CSM.js'
import * as exrLoader from 'three/examples/jsm/loaders/EXRLoader.js'
import { quatToJolt, quatToThree, vec3ToJoltR as rVec3ToJolt, vec3ToJolt, vec3ToThree } from './compat'
import './index.css'
import { bodyInterface, initJolt, jolt, joltInterface, layer } from './jolt'

type RbObject = {
    object: Mesh
    handle?: Jolt.BodyID
}

const gravity = new Vector3(0, -9.8, 0)
const fps = 60
const substeps = 2
const dt = 1 / (substeps * fps)

let canvas!: HTMLCanvasElement
let gl!: WebGL2RenderingContext
let renderer!: WebGLRenderer
let scene!: Scene
const input = {}
const objects: RbObject[] = []
let frameStart: number | undefined = undefined

const camera = new PerspectiveCamera(90, 1, 0.1, 100)
let csm!: CSM.CSM

const material = {
    default: new MeshStandardMaterial(),
    line: new LineBasicMaterial({ vertexColors: true })
}
const mesh = {
    debug: new LineSegments(new BufferGeometry(), material.line)
}
mesh.debug.visible = false

const App = () => {
    const [deltaRender, setDeltaRender] = createSignal(0)

    onMount(async () => {
        await initJolt()

        renderer = new WebGLRenderer({ canvas, antialias: true })
        renderer.shadowMap.enabled = true
        renderer.toneMapping = ACESFilmicToneMapping
        renderer.toneMappingExposure = 2
        gl = renderer.getContext() as WebGL2RenderingContext

        scene = new Scene()

        const envMap = await new exrLoader.EXRLoader().loadAsync('texture/autumn_field_puresky_2k.exr')
        envMap.mapping = EquirectangularReflectionMapping
        scene.background = envMap

        const ambientLight = new AmbientLight(0xffffff, 0.5)
        scene.add(ambientLight)
        const directionalLight = new DirectionalLight(0xffffff)
        directionalLight.position.copy(new Vector3(3, 4, 4).normalize().multiplyScalar(-200))
        scene.add(directionalLight)

        csm = new CSM.CSM({
            lightIntensity: 2,
            mode: 'practical',
            maxFar: camera.far,
            cascades: 8,
            parent: scene,
            shadowMapSize: Math.min(1 << 12, renderer.capabilities.maxTextureSize),
            shadowBias: -0.000005,
            lightDirection: directionalLight.position.normalize(),
            camera: camera
        })

        // TODO: init scene
        const floor = new Mesh(new PlaneGeometry(10, 10), material.default)
        const floorRb = bodyInterface.CreateBody(
            new jolt.BodyCreationSettings(
                new jolt.BoxShape(vec3ToJolt(new Vector3(10, 10, 0.1))),
                rVec3ToJolt(new Vector3()),
                quatToJolt(new Quaternion()),
                jolt.EMotionType_Static,
                layer.nonMoving
            )
        )
        objects.push({ object: floor, handle: floorRb.GetID() })

        scene.add(camera)

        objects.forEach(o =>
            o.object.traverse(c => {
                c.castShadow = true
                c.receiveShadow = true
                c.visible = !c.name.startsWith('c_')
                if (c instanceof Mesh) {
                    csm.setupMaterial(c.material)
                }
            })
        )
        scene.add(...objects.map(o => o.object))

        scene.add(mesh.debug)

        resize()
        window.addEventListener('resize', resize)
        window.addEventListener('keydown', onInput)
        window.addEventListener('keyup', onInput)

        renderer.setAnimationLoop(loop)
    })

    const resize = () => {
        const aspect = window.innerWidth / window.innerHeight
        camera.aspect = aspect
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    }

    const onInput = (e: KeyboardEvent) => {}

    const updateInput = () => {}

    const updateScene = () => {
        for (const { object, handle } of objects) {
            if (handle === undefined) continue
            object.position.copy(vec3ToThree(bodyInterface.GetPosition(handle)))
            object.quaternion.copy(quatToThree(bodyInterface.GetRotation(handle)))
        }
    }

    const updateCamera = () => {
        camera.position.copy(new Vector3(0, 1, 0))
    }

    const loop = () => {
        setDeltaRender(frameStart !== undefined ? performance.now() - frameStart : 0)
        frameStart = performance.now()

        updateInput()
        updateCamera()
        updateScene()

        for (let i = 0; i < substeps; i++) {
            joltInterface.Step(dt, 1)
        }

        csm.update()
        renderer.render(scene, camera)
    }

    return (
        <>
            <div id="overlay">
                <div class="debug">
                    <span>delta</span>
                    <span>{`render  ${deltaRender().toFixed(1)}`}</span>
                </div>
            </div>
            <canvas ref={canvas!} />
        </>
    )
}

render(() => <App />, document.getElementById('root')!)
