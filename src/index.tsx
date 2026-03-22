/* @refresh reload */

import { createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import {
    ACESFilmicToneMapping,
    AxesHelper,
    BufferAttribute,
    BufferGeometry,
    Color,
    Group,
    Mesh,
    MeshBasicMaterial,
    WebGLRenderer
} from 'three'
import { dt, substeps } from './constant'
import './index.css'
import { bodyInterface, initJolt, jolt, joltInterface, physicsSystem, quatToThree, vec3ToThree } from './jolt'
import { DemoScene } from './scene/Demo'
import { loadTextures } from './texture'

export let canvas!: HTMLCanvasElement
export let gl!: WebGL2RenderingContext
export let renderer!: WebGLRenderer
export let scene!: DemoScene

export const layer = {
    default: 0,
    debug: 1
}

const App = () => {
    const [debugMode, setDebugMode] = createSignal(false)
    const debugMeshes: Record<number, Group> = {}

    const [deltaRender, setDeltaRender] = createSignal(0)
    const [deltaStep, setDeltaStep] = createSignal(0)
    const [ballCount, setBallCount] = createSignal(0)

    let frameStart: number | undefined = undefined

    onMount(async () => {
        await initJolt()
        await loadTextures()

        renderer = new WebGLRenderer({ canvas, antialias: true })
        renderer.shadowMap.enabled = true
        renderer.toneMapping = ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.5
        renderer.setPixelRatio(window.devicePixelRatio)
        gl = renderer.getContext() as WebGL2RenderingContext

        scene = new DemoScene(canvas, renderer)
        await scene.init()

        resize()
        window.addEventListener('resize', resize)
        window.addEventListener('keydown', onInput)
        window.addEventListener('keyup', onInput)

        renderer.setAnimationLoop(loop)
    })

    const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setPixelRatio(window.devicePixelRatio)
        scene.resize()
    }

    const onInput = (e: KeyboardEvent) => {
        if (e.code === 'KeyD' && e.type === 'keyup') {
            setDebugMode(!debugMode())
        }
    }

    const updateInput = () => {}

    const updateDebug = () => {
        if (!debugMode()) return
        Object.values(debugMeshes).forEach(m => (m.visible = false))

        const outBodies = new jolt.BodyIDVector()
        physicsSystem.GetBodies(outBodies)
        for (let i = 0; i < outBodies.size(); i++) {
            const id = outBodies.at(i)
            const idx = id.GetIndex()
            const shape = bodyInterface.GetShape(id)
            let object = debugMeshes[idx]
            if (!object) {
                const aabb = jolt.AABox.prototype.sBiggest()
                const quat = jolt.Quat.prototype.sIdentity()
                const scale = new jolt.Vec3(1, 1, 1)
                const triContext = new jolt.ShapeGetTriangles(shape, aabb, shape.GetCenterOfMass(), quat, scale)
                const vertices = new Float32Array(
                    jolt.HEAPF32.buffer,
                    triContext.GetVerticesData(),
                    triContext.GetVerticesSize() / Float32Array.BYTES_PER_ELEMENT
                )
                const buffer = new BufferAttribute(vertices, 3).clone()
                jolt.destroy(triContext)

                const geometry = new BufferGeometry()
                geometry.setAttribute('position', buffer)
                geometry.computeVertexNormals()
                object = new Group()
                object.layers.set(layer.debug)
                scene.add(object)
                debugMeshes[idx] = object

                const triMesh = new Mesh(geometry, new MeshBasicMaterial({ wireframe: true }))
                object.add(triMesh)

                const axesHelper = new AxesHelper(0.1)
                object.add(axesHelper)

                object.children.forEach(c => (c.layers = object.layers))
            }

            const pos = vec3ToThree(bodyInterface.GetPosition(id))
            const quat = quatToThree(bodyInterface.GetRotation(id))
            object.position.copy(pos)
            object.quaternion.copy(quat)
            object.visible = true
            const color = bodyInterface.IsActive(id) ? new Color().setHSL(0, 0, 1) : new Color().setHSL(0.8, 0.5, 0.25)
            ;((object.children[0] as Mesh).material as MeshBasicMaterial).color = color
        }

        Object.values(debugMeshes).forEach(m => {
            if (!m.visible) scene.remove(m)
        })
    }

    const loop = () => {
        setDeltaRender(frameStart !== undefined ? performance.now() - frameStart : 0)
        frameStart = performance.now()

        updateInput()

        setBallCount(scene.ballCount)
        const stepStart = performance.now()
        joltInterface.Step(dt, substeps)
        setDeltaStep(performance.now() - stepStart)

        updateDebug()
        scene.render()

        scene.update(debugMode())
    }

    return (
        <>
            <div id="overlay">
                <div class="debug">
                    <span>delta</span>
                    <span>{`render  ${deltaRender().toFixed(1)}`}</span>
                    <span>{`physics ${deltaStep().toFixed(1)}`}</span>
                    <span>{`balls   ${ballCount()}`}</span>
                </div>
            </div>
            <canvas ref={canvas!} />
        </>
    )
}

render(() => <App />, document.getElementById('root')!)
