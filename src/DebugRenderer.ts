import { AxesHelper, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, MeshBasicMaterial } from 'three'
import { layer, scene } from '.'
import { bodyInterface, jolt, physicsSystem, quatToThree, shapeGeometry, shapeScale, vec3ToThree } from './jolt'

const shapeBodyLimit = 1024

export class DebugRenderer {
    debugMeshes: Record<number, Group> = {}
    shapes: Record<string, InstancedMesh> = {}

    update() {
        Object.values(this.debugMeshes).forEach(m => (m.visible = false))
        Object.values(this.shapes).forEach(s => (s.count = 0))

        const outBodies = new jolt.BodyIDVector()
        physicsSystem.GetBodies(outBodies)
        const mat = new Matrix4()
        for (let i = 0; i < outBodies.size(); i++) {
            const id = outBodies.at(i)
            const idx = id.GetIndex()
            // TODO: assuming shape is not changed after body's creation, it can be cached and derived from body id
            // same for shapeId calculation
            const shape = bodyInterface.GetShape(id)
            const pos = vec3ToThree(bodyInterface.GetPosition(id))
            const quat = quatToThree(bodyInterface.GetRotation(id))

            const scale = shapeScale(shape)
            const shapeId = `${shape.GetType()}/${shape.GetSubType()}`
            let instance = this.shapes[shapeId]
            if (!instance) {
                instance = new InstancedMesh(
                    shapeGeometry(shape),
                    new MeshBasicMaterial({ wireframe: true }),
                    shapeBodyLimit
                )
                instance.layers.set(layer.debug)
                instance.instanceMatrix.setUsage(DynamicDrawUsage)
                scene.add(instance)
                this.shapes[shapeId] = instance
            }

            mat.compose(pos, quat, scale)
            instance.setMatrixAt(instance.count, mat)
            instance.instanceMatrix.needsUpdate = true
            const color = bodyInterface.IsActive(id) ? new Color().setHSL(0, 0, 1) : new Color().setHSL(0.8, 0.5, 0.25)
            instance.setColorAt(instance.count, color)
            instance.instanceColor!.needsUpdate = true
            instance.count++

            let object = this.debugMeshes[idx]
            if (!object) {
                object = new Group()
                object.layers.set(layer.debug)

                const axesHelper = new AxesHelper(0.2)
                object.add(axesHelper)

                object.children.forEach(c => (c.layers = object.layers))
                scene.add(object)
                this.debugMeshes[idx] = object
            }

            object.position.copy(pos)
            object.quaternion.copy(quat)
            object.visible = true
        }

        Object.values(this.debugMeshes).forEach(m => {
            if (!m.visible) scene.remove(m)
        })
    }
}
