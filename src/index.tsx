/* @refresh reload */

import type Jolt from 'jolt-physics'
import { createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import {
    ACESFilmicToneMapping,
    AmbientLight,
    BoxGeometry,
    BufferGeometry,
    DirectionalLight,
    EquirectangularReflectionMapping,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    RepeatWrapping,
    Scene,
    SphereGeometry,
    Texture,
    TextureLoader,
    Vector3,
    WebGLRenderer
} from 'three'
import * as CSM from 'three/examples/jsm/csm/CSM.js'
import * as exrLoader from 'three/examples/jsm/loaders/EXRLoader.js'
import { dt, substeps } from './constant'
import './index.css'
import {
    bodyInterface,
    initJolt,
    jolt,
    joltInterface,
    layer,
    quatToJolt,
    quatToThree,
    rVec3ToJolt,
    vec3ToJolt,
    vec3ToThree
} from './jolt'

type RbObject = {
    object: Mesh
    id?: Jolt.BodyID
}

let canvas!: HTMLCanvasElement
let gl!: WebGL2RenderingContext
let renderer!: WebGLRenderer
let scene!: Scene
const input = {}
const objects: RbObject[] = []
let frameStart: number | undefined = undefined

const camera = new PerspectiveCamera(90, 1, 0.1, 100)
let csm!: CSM.CSM

const texture = {
    grid: new Texture()
}
const material = {
    default: new MeshStandardMaterial({ map: texture.grid }),
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
        texture.grid.copy(new TextureLoader().load('texture/grid.png'))
        texture.grid.wrapS = RepeatWrapping
        texture.grid.wrapT = RepeatWrapping
        texture.grid.repeat.set(32, 32)

        renderer = new WebGLRenderer({ canvas, antialias: true })
        renderer.shadowMap.enabled = true
        renderer.toneMapping = ACESFilmicToneMapping
        renderer.toneMappingExposure = 2
        renderer.setPixelRatio(window.devicePixelRatio)
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
        const floor = new Mesh(new BoxGeometry(10, 0.1, 10), material.default)
        const floorRb = bodyInterface.CreateBody(
            new jolt.BodyCreationSettings(
                new jolt.BoxShape(vec3ToJolt(new Vector3(10, 0.1, 10))),
                rVec3ToJolt(floor.position),
                quatToJolt(floor.quaternion),
                jolt.EMotionType_Static,
                layer.nonMoving
            )
        )
        bodyInterface.AddBody(floorRb.GetID(), jolt.EActivation_Activate)
        objects.push({ object: floor, id: floorRb.GetID() })

        const ball = new Mesh(new SphereGeometry(0.1), material.default)
        ball.position.copy(new Vector3(0, 1, 0))
        const ballRb = bodyInterface.CreateBody(
            new jolt.BodyCreationSettings(
                new jolt.SphereShape(0.1),
                rVec3ToJolt(ball.position),
                quatToJolt(ball.quaternion),
                jolt.EMotionType_Dynamic,
                layer.movinfg
            )
        )
        ballRb.SetRestitution(1)
        bodyInterface.AddBody(ballRb.GetID(), jolt.EActivation_Activate)
        objects.push({ object: ball, id: ballRb.GetID() })

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
        console.debug(objects)

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
        renderer.setPixelRatio(window.devicePixelRatio)
    }

    const onInput = (e: KeyboardEvent) => {}

    const updateInput = () => {}

    const updateScene = () => {
        for (const { object, id: handle } of objects) {
            if (handle === undefined) continue
            object.position.copy(vec3ToThree(bodyInterface.GetPosition(handle)))
            object.quaternion.copy(quatToThree(bodyInterface.GetRotation(handle)))
        }
    }

    const updateCamera = () => {
        camera.position.copy(new Vector3(-0.5, 1, 0.5))
        camera.lookAt(new Vector3(0, 0.5, 0))
    }

    const loop = () => {
        setDeltaRender(frameStart !== undefined ? performance.now() - frameStart : 0)
        frameStart = performance.now()

        updateInput()
        updateCamera()
        updateScene()

        joltInterface.Step(dt, substeps)

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
