import { Camera, Controls, Matrix4, Spherical, Vector2, Vector3 } from 'three'
import { clamp, epsilon } from './math'

export const mouseButton = {
    left: 0,
    middle: 1,
    right: 2
}

export class CameraControls extends Controls<{}> {
    camera: Camera
    target: Vector3
    mousePos: Vector2 = new Vector2()
    panStartPos: Vector2 | undefined
    rotateStartPos: Vector2 | undefined
    initialRotation: Spherical
    initialTarget: Vector3

    constructor(camera: Camera, target: Vector3, domElement: HTMLElement) {
        super(camera, domElement)
        this.camera = camera
        this.target = target
        this.initialRotation = this.makeInitialRotation()
        this.initialTarget = target.clone()

        window.addEventListener('pointermove', e => {
            this.mousePos = new Vector2(e.clientX, e.clientY)

            const rotation = new Vector3().setFromSpherical(this.initialRotation)
            const translation = this.initialTarget.clone()
            if (this.rotateStartPos) {
                const rotateDelta = this.rotateStartPos.clone().sub(this.mousePos)
                const sensitivity = new Vector2(8, 4)
                const phi = (sensitivity.y * rotateDelta.y) / domElement.clientHeight
                const theta = (sensitivity.x * rotateDelta.x) / domElement.clientWidth
                rotation.copy(
                    new Vector3().setFromSpherical(
                        new Spherical(
                            this.initialRotation.radius,
                            clamp(this.initialRotation.phi + phi, epsilon, Math.PI / 2),
                            this.initialRotation.theta + theta
                        )
                    )
                )
            }

            if (this.panStartPos) {
                const panDelta = this.panStartPos.clone().sub(this.mousePos)
                const sensitivity = 1.7 * rotation.length()
                const rotMat = new Matrix4().makeRotationY(new Spherical().setFromVector3(rotation).theta)
                const pan = new Vector3(panDelta.x, 0, panDelta.y)
                    .divideScalar(domElement.clientHeight)
                    .multiplyScalar(sensitivity)
                    .applyMatrix4(rotMat)
                translation.add(pan)
            }

            this.target.copy(translation)
            this.camera.position.copy(this.target.clone().add(rotation))
            this.camera.lookAt(target)
        })
        domElement.addEventListener('contextmenu', e => e.preventDefault())
        domElement.addEventListener(
            'wheel',
            e => {
                const factor = 1 + Math.abs(e.deltaY) / 1000
                const zoom = e.deltaY > 0 ? factor : 1 / factor
                this.initialRotation.radius *= zoom
                this.camera.position.copy(new Vector3().setFromSpherical(this.initialRotation).add(this.target))
                this.initialRotation = this.makeInitialRotation()
            },
            { passive: true }
        )
        domElement.addEventListener('mousedown', e => {
            if (e.button === mouseButton.middle) {
                this.rotateStartPos ??= this.mousePos

                this.initialTarget = target.clone()
                this.panStartPos = undefined
            }
            if (e.button === mouseButton.right) {
                this.panStartPos ??= this.mousePos

                this.initialRotation = this.makeInitialRotation()
                this.rotateStartPos = undefined
            }
        })
        window.addEventListener('mouseup', e => {
            if (e.button === mouseButton.middle) {
                this.initialRotation = this.makeInitialRotation()
                this.rotateStartPos = undefined
            }
            if (e.button === mouseButton.right) {
                this.initialTarget = target.clone()
                this.panStartPos = undefined
            }
        })
    }

    override update(): void {
        this.camera.lookAt(this.target)
    }

    makeInitialRotation(): Spherical {
        return new Spherical().setFromVector3(this.camera.position.clone().sub(this.target))
    }
}
