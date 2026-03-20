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
    DynamicDrawUsage,
    EquirectangularReflectionMapping,
    InstancedMesh,
    LineBasicMaterial,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Object3D,
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
    /**
     * In case of object being instanced
     */
    index?: number
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

    const ballCountLimit = 2048
    let balls!: InstancedMesh

    onMount(async () => {
        await initJolt()
        texture.grid.copy(new TextureLoader().load('texture/grid.png'))
        texture.grid.wrapS = RepeatWrapping
        texture.grid.wrapT = RepeatWrapping
        texture.grid.repeat.set(8, 8)

        renderer = new WebGLRenderer({ canvas, antialias: true })
        renderer.shadowMap.enabled = true
        renderer.toneMapping = ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.5
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
            cascades: 2,
            parent: scene,
            shadowMapSize: Math.min(1 << 13, renderer.capabilities.maxTextureSize),
            shadowBias: -0.000005,
            lightDirection: directionalLight.position.normalize(),
            camera: camera
        })

        const colorFloor = '#eeeeee'
        const colorWall = '#888888'
        // floor + 4 walls
        ;[
            { box: new Vector3(25, 0.1, 25), pos: new Vector3(0, 0, 0), color: colorFloor },
            { box: new Vector3(5, 1, 0.1), pos: new Vector3(0, 0.5, 2.5), color: colorWall },
            { box: new Vector3(5, 1, 0.1), pos: new Vector3(0, 0.5, -2.5), color: colorWall },
            { box: new Vector3(0.1, 1, 5), pos: new Vector3(2.5, 0.5, 0), color: colorWall },
            { box: new Vector3(0.1, 1, 5), pos: new Vector3(-2.5, 0.5, 0), color: colorWall }
        ].forEach(({ box, pos, color }) => {
            const wall = new Mesh(
                new BoxGeometry(...box.toArray()),
                new MeshStandardMaterial({ map: texture.grid, color })
            )
            wall.position.copy(pos)
            const wallRb = createBody(wall, new jolt.BoxShape(vec3ToJolt(box.clone().divideScalar(2))), false)
            objects.push({ object: wall, id: wallRb.GetID() })
        })

        balls = new InstancedMesh(
            new SphereGeometry(0.1),
            new MeshStandardMaterial({ map: texture.grid, roughness: 0 }),
            ballCountLimit
        )
        balls.instanceMatrix.setUsage(DynamicDrawUsage)
        sceneAdd(balls)

        scene.add(camera)

        objects.map(o => sceneAdd(o.object))
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

    const sceneAdd = (object: Object3D) => {
        object.traverse(c => {
            c.castShadow = true
            c.receiveShadow = true
            c.visible = !c.name.startsWith('c_')
            if (c instanceof Mesh) {
                csm.setupMaterial(c.material)
            }
        })
        scene.add(object)
    }

    const addBall = (pos: Vector3) => {
        const ball = new Mesh(balls.geometry, new MeshStandardMaterial())
        ball.position.copy(pos)

        const index = ballCount()
        balls.count = index + 1
        balls.setColorAt(index, new Color().setHSL(Math.random(), 1, 0.2))
        balls.instanceColor!.needsUpdate = true

        const ballRb = createBody(ball, new jolt.SphereShape(0.1), true)
        ballRb.SetRestitution(0.8)

        objects.push({ object: balls, index, id: ballRb.GetID() })
        setBallCount(ballCount() + 1)
    }

    const updateScene = () => {
        for (let i = 0; i < 4; i++) {
            if (ballCount() < ballCountLimit) {
                addBall(
                    new Vector3(0, 4, 0).add(
                        new Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).multiplyScalar(2)
                    )
                )
            }
            if (ballCount() === ballCountLimit - 1) {
                // finish him!
                const boxBounds = new Vector3(1, 1, 1)
                const megaBox = new Mesh(new BoxGeometry(...boxBounds), material.default)
                megaBox.position.copy(new Vector3(0, 10, 0))
                const megaBoxShape = new jolt.BoxShape(vec3ToJolt(boxBounds.clone().divideScalar(2)))
                megaBoxShape.SetDensity(10e3)
                const megaBoxRb = createBody(megaBox, megaBoxShape, true)
                megaBoxRb.SetRestitution(0.2)
                objects.push({ object: megaBox, id: megaBoxRb.GetID() })
                sceneAdd(megaBox)
            }
        }

        for (const { object, index, id } of objects) {
            if (id === undefined) continue
            const pos = vec3ToThree(bodyInterface.GetPosition(id))
            const quat = quatToThree(bodyInterface.GetRotation(id))

            if (index !== undefined && object instanceof InstancedMesh) {
                const scale = new Vector3(1, 1, 1)
                const mat = new Matrix4().compose(pos, quat, scale)
                object.setMatrixAt(index, mat)
                object.instanceMatrix.needsUpdate = true
            } else {
                object.position.copy(pos)
                object.quaternion.copy(quat)
            }
        }
    }

    const updateCamera = () => {
        camera.position.copy(new Vector3(3, 3, -0.5))
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
