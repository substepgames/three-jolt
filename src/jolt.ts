import type Jolt from 'jolt-physics'
import * as three from 'three'
import { Object3D } from 'three'
import { gravity, debugMode } from './constant'

export let jolt: typeof Jolt
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

export const vec3ToThree = (v: Jolt.Vec3 | Jolt.RVec3): three.Vector3 => new three.Vector3(v.GetX(), v.GetY(), v.GetZ())
export const vec3ToJolt = (v: three.Vector3): Jolt.Vec3 => new jolt.Vec3(v.x, v.y, v.z)
export const rVec3ToJolt = (v: three.Vector3): Jolt.RVec3 => new jolt.RVec3(v.x, v.y, v.z)
export const quatToThree = (q: Jolt.Quat): three.Quaternion =>
    new three.Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW())
export const quatToJolt = (q: three.Quaternion): Jolt.Quat => new jolt.Quat(q.x, q.y, q.z, q.w)

export const initJolt = async () => {
    const mod = debugMode
        ? await import('jolt-physics/debug-wasm-compat')
        : await import('jolt-physics/wasm-multithread')
    const initJolt = mod.default
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
