import type Jolt from 'jolt-physics'

export let jolt: typeof Jolt
export let joltInterface!: Jolt.JoltInterface
export let physicsSystem!: Jolt.PhysicsSystem
export let bodyInterface!: Jolt.BodyInterface

export const layer = {
    movinfg: 0,
    nonMoving: 1,
    kinematic: 2,
    rig: 3
}

export const objectLayerCount = 3

export const initJolt = async () => {
    const initJolt = (await import('jolt-physics/wasm')).default
    jolt = await initJolt()

    const objectFilter = new jolt.ObjectLayerPairFilterTable(objectLayerCount)
    objectFilter.EnableCollision(layer.nonMoving, layer.movinfg)
    objectFilter.EnableCollision(layer.movinfg, layer.movinfg)
    objectFilter.DisableCollision(layer.nonMoving, layer.rig)
    objectFilter.DisableCollision(layer.movinfg, layer.rig)
    objectFilter.DisableCollision(layer.rig, layer.rig)

    const bpInterface = new jolt.BroadPhaseLayerInterfaceTable(objectLayerCount, 3)
    bpInterface.MapObjectToBroadPhaseLayer(layer.nonMoving, new jolt.BroadPhaseLayer(1))
    bpInterface.MapObjectToBroadPhaseLayer(layer.movinfg, new jolt.BroadPhaseLayer(0))
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
    bodyInterface = physicsSystem.GetBodyInterface()

    console.debug('jolt initialized', jolt)
}
