import type Jolt from 'jolt-physics'
import {
    AmbientLight,
    BoxGeometry,
    Color,
    DirectionalLight,
    DynamicDrawUsage,
    EquirectangularReflectionMapping,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    PerspectiveCamera,
    Scene,
    SphereGeometry,
    Texture,
    Vector3,
    WebGLRenderer
} from 'three'
import * as CSM from 'three/examples/jsm/csm/CSM.js'
import * as exrLoader from 'three/examples/jsm/loaders/EXRLoader.js'
import { layer } from '..'
import { dt } from '../constant'
import { texture } from '../texture'
import { CameraControls } from './../CameraControls'
import { bodyInterface, createBody, jolt, quatToThree, vec3ToJolt, vec3ToThree } from './../jolt'

export type RbObject = {
    object: Mesh
    rb?: {
        id: Jolt.BodyID
        /**
         * In case of object being instanced
         */
        index?: number
    }
}

export class DemoScene extends Scene {
    envMap!: Texture
    input = {}
    objects: RbObject[] = []
    camera = new PerspectiveCamera(90, 1, 0.001, 100)
    controls!: CameraControls
    csm!: CSM.CSM
    ballCountLimit = 512
    balls!: InstancedMesh
    ballCount: number = 0

    constructor(
        public canvas: HTMLCanvasElement,
        public renderer: WebGLRenderer
    ) {
        super()
    }

    async init() {
        this.envMap = await new exrLoader.EXRLoader().loadAsync('texture/autumn_field_puresky_2k.exr')
        this.envMap.mapping = EquirectangularReflectionMapping
        this.background = this.envMap

        const ambientLight = new AmbientLight(0xffffff, 0.5)
        ambientLight.layers.enableAll()
        super.add(ambientLight)
        const directionalLight = new DirectionalLight(0xffffff)
        directionalLight.layers.enableAll()
        directionalLight.position.copy(new Vector3(3, 4, 4).normalize().multiplyScalar(-200))
        super.add(directionalLight)

        const cameraTarget = new Vector3(0, 0, 0)
        this.camera.position.copy(new Vector3(-0.5, 3, 6).multiplyScalar(1).add(cameraTarget))
        super.add(this.camera)

        this.controls = new CameraControls(this.camera, cameraTarget, this.canvas)
        this.controls.target.copy(cameraTarget)

        this.csm = new CSM.CSM({
            lightIntensity: 2,
            mode: 'practical',
            maxFar: this.camera.far,
            cascades: 2,
            parent: this,
            shadowMapSize: Math.min(1 << 13, this.renderer.capabilities.maxTextureSize),
            shadowBias: -0.000005,
            lightDirection: directionalLight.position.normalize(),
            camera: this.camera
        })

        const colorFloor = '#eeeeee'
        const colorWall = '#888888'
        // floor + 4 walls
        ;[
            { box: new Vector3(50, 0.2, 50), pos: new Vector3(0, -0.1, 0), color: colorFloor },
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
            this.objects.push({ object: wall, rb: { id: wallRb.GetID() } })
        })

        this.balls = new InstancedMesh(
            new SphereGeometry(0.15),
            new MeshStandardMaterial({ map: texture.grid, roughness: 0 }),
            this.ballCountLimit
        )
        this.balls.instanceMatrix.setUsage(DynamicDrawUsage)
        this.add(this.balls)

        this.objects.map(o => this.add(o.object))
        console.debug(this.objects)
    }

    addBall(pos: Vector3) {
        const ball = new Mesh(this.balls.geometry, new MeshStandardMaterial())
        ball.position.copy(pos)

        const index = this.ballCount
        this.balls.count = index + 1
        this.balls.setColorAt(index, new Color().setHSL(Math.random(), 1, 0.2))
        this.balls.instanceColor!.needsUpdate = true
        this.balls.computeBoundingSphere()

        const shape = new jolt.SphereShape((this.balls.geometry as SphereGeometry).parameters.radius)
        shape.SetDensity(0.5e3)
        const ballRb = createBody(ball, shape, true)
        ballRb.SetRestitution(0.6)
        ballRb.GetMotionProperties().SetLinearDamping(0.5)
        ballRb.GetMotionProperties().SetAngularDamping(0.1)

        this.objects.push({ object: this.balls, rb: { id: ballRb.GetID(), index } })
        this.ballCount++
    }

    update() {
        for (let i = 0; i < 8; i++) {
            if (this.ballCount < this.ballCountLimit) {
                this.addBall(
                    new Vector3(0, 4, 0).add(
                        new Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).multiplyScalar(2)
                    )
                )
            }
            if (this.ballCount === this.ballCountLimit - 1) {
                // finish him!
                const boxBounds = new Vector3(2, 2, 2)
                const megaBox = new Mesh(
                    new BoxGeometry(...boxBounds),
                    new MeshStandardMaterial({ map: texture.grid, color: new Color().setHSL(0.6, 1, 0.1) })
                )
                megaBox.position.copy(new Vector3(0, 10, -10))
                const shape = new jolt.BoxShape(vec3ToJolt(boxBounds.clone().divideScalar(2)))
                shape.SetDensity(2e3)
                const megaBoxRb = createBody(megaBox, shape, true)
                bodyInterface.AddAngularImpulse(megaBoxRb.GetID(), vec3ToJolt(new Vector3(-500 / dt, 0, 0)))
                bodyInterface.AddImpulse(megaBoxRb.GetID(), vec3ToJolt(new Vector3(0, 0, 2e3 / dt)))
                this.objects.push({ object: megaBox, rb: { id: megaBoxRb.GetID() } })
                this.add(megaBox)
            }
        }

        for (const { object, rb } of this.objects) {
            if (!rb) continue
            if (rb.id === undefined) continue
            const pos = vec3ToThree(bodyInterface.GetPosition(rb.id))
            const quat = quatToThree(bodyInterface.GetRotation(rb.id))

            if (rb.index !== undefined && object instanceof InstancedMesh) {
                const scale = new Vector3(1, 1, 1)
                const mat = new Matrix4().compose(pos, quat, scale)
                object.setMatrixAt(rb.index, mat)
                object.instanceMatrix.needsUpdate = true
            } else {
                object.position.copy(pos)
                object.quaternion.copy(quat)
            }
        }
    }

    render(debugMode: boolean) {
        this.camera.layers.set(debugMode ? layer.debug : layer.default)
        this.background = debugMode ? null : this.envMap
        this.csm.update()
        this.controls.update()
        this.renderer.render(this, this.camera)
    }

    override add(...objects: Object3D[]): this {
        objects.forEach(o =>
            o.traverse(c => {
                c.castShadow = true
                c.receiveShadow = true
                c.visible = !c.name.startsWith('c_')
                if (c instanceof Mesh) {
                    this.csm.setupMaterial(c.material)
                }
            })
        )
        super.add(...objects)
        return this
    }
}
