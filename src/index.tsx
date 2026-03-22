/* @refresh reload */

import { createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { ACESFilmicToneMapping, WebGLRenderer } from 'three'
import { DebugRenderer } from './DebugRenderer'
import { dt, substeps } from './constant'
import './index.css'
import { initPhysics, joltInterface } from './jolt'
import { DemoScene } from './scene/Demo'
import { loadTextures } from './texture'

export let canvas!: HTMLCanvasElement
export let gl!: WebGL2RenderingContext
export let renderer!: WebGLRenderer
export let scene!: DemoScene
export const debugRenderer = new DebugRenderer()

export const layer = {
    default: 0,
    debug: 1
}

const [debugMode, setDebugMode] = createSignal(false)
const [paused, setPaused] = createSignal(false)

const App = () => {
    const [deltaRender, setDeltaRender] = createSignal(0)
    const [deltaStep, setDeltaStep] = createSignal(0)
    const [ballCount, setBallCount] = createSignal(0)

    let frameStart: number | undefined = undefined

    onMount(async () => {
        await initPhysics()
        await loadTextures()
        initRenderer()

        scene = new DemoScene(canvas, renderer)
        await scene.init()

        resize()
        const body = document.body
        body.addEventListener('resize', resize)
        body.addEventListener('keydown', onInput)
        body.addEventListener('keyup', onInput)

        renderer.setAnimationLoop(loop)
    })

    const initRenderer = () => {
        renderer = new WebGLRenderer({ canvas, antialias: true })
        renderer.shadowMap.enabled = true
        renderer.toneMapping = ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.5
        renderer.setPixelRatio(window.devicePixelRatio)
        gl = renderer.getContext() as WebGL2RenderingContext
    }

    const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setPixelRatio(window.devicePixelRatio)
        scene.resize()
    }

    const onInput = (e: KeyboardEvent) => {
        if (e.shiftKey && e.type === 'keyup') {
            switch (e.code) {
                case 'KeyD':
                    setDebugMode(!debugMode())
                    break
                case 'KeyP':
                    setPaused(!paused())
                    break
            }
        }
    }

    const updateInput = () => {}

    const loop = () => {
        setDeltaRender(frameStart !== undefined ? performance.now() - frameStart : 0)
        frameStart = performance.now()

        updateInput()

        const stepStart = performance.now()
        if (!paused()) {
            joltInterface.Step(dt, substeps)
        }
        setDeltaStep(performance.now() - stepStart)
        if (!paused()) {
            scene.update()
            setBallCount(scene.ballCount)
        }

        if (debugMode()) debugRenderer.update()
        scene.render(debugMode())
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
