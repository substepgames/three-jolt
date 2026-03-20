/* @refresh reload */

import type Jolt from 'jolt-physics'
import { createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import {
    ACESFilmicToneMapping,
    AmbientLight,
    BoxGeometry,
    Color,
    DirectionalLight,
    EquirectangularReflectionMapping,
    LineBasicMaterial,
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
import { bodyInterface, createBody, initJolt, jolt, joltInterface, quatToThree, vec3ToJolt, vec3ToThree } from './jolt'

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

const App = () => {
    const [deltaRender, setDeltaRender] = createSignal(0)
    const [ballCount, setBallCount] = createSignal(0)
    const ballCountLimit = 128

    onMount(async () => {
        await initJolt()
        texture.grid.copy(new TextureLoader().load('texture/grid.png'))
        texture.grid.wrapS = RepeatWrapping
        texture.grid.wrapT = RepeatWrapping
        texture.grid.repeat.set(8, 8)

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

        // floor + 4 walls
        ;[
            { box: new Vector3(5, 0.1, 5), pos: new Vector3(0, 0, 0) },
            { box: new Vector3(5, 1, 0.1), pos: new Vector3(0, 0.5, 2.5) },
            { box: new Vector3(5, 1, 0.1), pos: new Vector3(0, 0.5, -2.5) },
            { box: new Vector3(0.1, 1, 5), pos: new Vector3(2.5, 0.5, 0) },
            { box: new Vector3(0.1, 1, 5), pos: new Vector3(-2.5, 0.5, 0) }
        ].forEach(({ box, pos }) => {
            const wall = new Mesh(new BoxGeometry(...box.toArray()), material.default)
            wall.position.copy(pos)
            const wallRb = createBody(wall, new jolt.BoxShape(vec3ToJolt(box)), false)
            objects.push({ object: wall, id: wallRb.GetID() })
        })

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

    const addBall = (pos: Vector3) => {
        const ball = new Mesh(
            new SphereGeometry(0.1),
            new MeshStandardMaterial({ color: new Color().setHSL(Math.random(), 0.5, 0.5), map: texture.grid })
        )
        ball.position.copy(pos)

        ball.traverse(c => {
            c.castShadow = true
            c.receiveShadow = true
            c.visible = !c.name.startsWith('c_')
            if (c instanceof Mesh) {
                csm.setupMaterial(c.material)
            }
        })
        scene.add(ball)

        const ballRb = createBody(ball, new jolt.SphereShape(0.1), true)
        ballRb.SetRestitution(0.8)
        objects.push({ object: ball, id: ballRb.GetID() })
    }

    const updateScene = () => {
        for (const { object, id: handle } of objects) {
            if (handle === undefined) continue
            object.position.copy(vec3ToThree(bodyInterface.GetPosition(handle)))
            object.quaternion.copy(quatToThree(bodyInterface.GetRotation(handle)))
        }

        if (ballCount() < ballCountLimit) {
            addBall(
                new Vector3(0, 2, 0).add(new Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).multiplyScalar(2))
            )
            setBallCount(ballCount() + 1)
        }
    }

    const updateCamera = () => {
        camera.position.copy(new Vector3(2, 2, 0.5))
        camera.lookAt(new Vector3(0, 0, 0))
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
                    <span>{`balls   ${ballCount()}`}</span>
                </div>
            </div>
            <canvas ref={canvas!} />
        </>
    )
}

render(() => <App />, document.getElementById('root')!)
