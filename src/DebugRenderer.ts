import { AxesHelper, BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial } from 'three'
import { layer, scene } from '.'
import { bodyInterface, jolt, physicsSystem, quatToThree, vec3ToThree } from './jolt'

export class DebugRenderer {
    debugMeshes: Record<number, Group> = {}

    update() {
        Object.values(this.debugMeshes).forEach(m => (m.visible = false))

        const outBodies = new jolt.BodyIDVector()
        physicsSystem.GetBodies(outBodies)
        for (let i = 0; i < outBodies.size(); i++) {
            const id = outBodies.at(i)
            const idx = id.GetIndex()
            const shape = bodyInterface.GetShape(id)
            let object = this.debugMeshes[idx]
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
                this.debugMeshes[idx] = object

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

        Object.values(this.debugMeshes).forEach(m => {
            if (!m.visible) scene.remove(m)
        })
    }
}
