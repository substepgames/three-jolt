import type Jolt from 'jolt-physics'
import initJolt from 'jolt-physics/wasm'
import { BoxGeometry, BufferAttribute, BufferGeometry, Object3D, Quaternion, SphereGeometry, Vector3 } from 'three'
import { gravity } from './constant'
import { JoltDebugModule } from './jolt-debug'

export let jolt: typeof Jolt & JoltDebugModule
export let joltInterface!: Jolt.JoltInterface
export let physicsSystem!: Jolt.PhysicsSystem
export let bodyInterface!: Jolt.BodyInterface

export const layer = {
    moving: 0,
    nonMoving: 1,
    kinematic: 2,
    rig: 3
}

export const objectLayerCount = 3

export const vec3ToThree = (v: Jolt.Vec3 | Jolt.RVec3): Vector3 => new Vector3(v.GetX(), v.GetY(), v.GetZ())
export const vec3ToJolt = (v: Vector3): Jolt.Vec3 => new jolt.Vec3(v.x, v.y, v.z)
export const rVec3ToJolt = (v: Vector3): Jolt.RVec3 => new jolt.RVec3(v.x, v.y, v.z)
export const quatToThree = (q: Jolt.Quat): Quaternion => new Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW())
export const quatToJolt = (q: Quaternion): Jolt.Quat => new jolt.Quat(q.x, q.y, q.z, q.w)

export const initPhysics = async () => {
    jolt = await initJolt()

    const objectFilter = new jolt.ObjectLayerPairFilterTable(objectLayerCount)
    objectFilter.EnableCollision(layer.nonMoving, layer.moving)
    objectFilter.EnableCollision(layer.moving, layer.moving)
    objectFilter.DisableCollision(layer.nonMoving, layer.rig)
    objectFilter.DisableCollision(layer.moving, layer.rig)
    objectFilter.DisableCollision(layer.rig, layer.rig)

    const bpInterface = new jolt.BroadPhaseLayerInterfaceTable(objectLayerCount, 3)
    bpInterface.MapObjectToBroadPhaseLayer(layer.nonMoving, new jolt.BroadPhaseLayer(1))
    bpInterface.MapObjectToBroadPhaseLayer(layer.moving, new jolt.BroadPhaseLayer(0))
    bpInterface.MapObjectToBroadPhaseLayer(layer.rig, new jolt.BroadPhaseLayer(2))
    const settings = new jolt.JoltSettings()
    settings.mObjectLayerPairFilter = objectFilter
    settings.mBroadPhaseLayerInterface = bpInterface
    settings.mObjectVsBroadPhaseLayerFilter = new jolt.ObjectVsBroadPhaseLayerFilterTable(
        settings.mBroadPhaseLayerInterface,
        3,
        settings.mObjectLayerPairFilter,
        objectLayerCount
    )
    joltInterface = new jolt.JoltInterface(settings)

    physicsSystem = joltInterface.GetPhysicsSystem()
    const physicsSettings = physicsSystem.GetPhysicsSettings()
    // physicsSettings.mDeterministicSimulation = false
    // physicsSettings.mNumPositionSteps = 1
    // physicsSettings.mNumVelocitySteps = 1
    physicsSettings.mPointVelocitySleepThreshold = 0.05
    physicsSettings.mTimeBeforeSleep = 0.1
    physicsSystem.SetGravity(vec3ToJolt(gravity))
    bodyInterface = physicsSystem.GetBodyInterface()

    console.debug('jolt initialized', jolt)
}

export const createBody = (object: Object3D, shape: Jolt.Shape, dynamic: boolean): Jolt.Body => {
    const rb = bodyInterface.CreateBody(
        new jolt.BodyCreationSettings(
            shape,
            rVec3ToJolt(object.position),
            quatToJolt(object.quaternion),
            dynamic ? jolt.EMotionType_Dynamic : jolt.EMotionType_Static,
            dynamic ? layer.moving : layer.nonMoving
        )
    )
    bodyInterface.AddBody(rb.GetID(), jolt.EActivation_Activate)
    return rb
}

/**
 * Must be consistent with `shapeGeometry()`
 */
export const shapeScale = (shape: Jolt.Shape): Vector3 => {
    const scale = new Vector3(1, 1, 1)
    if (shape.GetType() !== jolt.EShapeType_Convex) return scale
    const subType = shape.GetSubType()
    switch (subType) {
        case jolt.EShapeSubType_Sphere: {
            const r = jolt.castObject(shape, jolt.SphereShape).GetRadius()
            return new Vector3(r, r, r).multiplyScalar(2)
        }
        case jolt.EShapeSubType_Box: {
            const extent = jolt.castObject(shape, jolt.BoxShape).GetHalfExtent()
            return new Vector3(extent.GetX(), extent.GetY(), extent.GetZ())
        }
    }
    return scale
}

export const shapeGeometry = (shape: Jolt.Shape): BufferGeometry => {
    if (shape.GetType() === jolt.EShapeType_Convex) {
        const subType = shape.GetSubType()
        switch (subType) {
            case jolt.EShapeSubType_Box: {
                return new BoxGeometry(2, 2, 2)
            }
            case jolt.EShapeSubType_Sphere: {
                return new SphereGeometry(0.5, 8, 4)
            }
        }
    }
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
    return geometry
}
