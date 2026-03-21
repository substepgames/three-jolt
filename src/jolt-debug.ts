import type Jolt from 'jolt-physics'

/**
 * Color class used by debug renderer
 */
export interface JoltColor {
    mU32: number
}

/**
 * Extended types for debug renderer (only available in debug builds)
 * These properties are not in the standard Jolt type definitions
 */
export interface JoltDebugModule {
    readonly DebugRendererJS: new () => JoltDebugRendererJS
    readonly BodyManagerDrawSettings: new () => any
    readonly DebugRendererVertexTraits: {
        prototype: {
            mPositionOffset: number
            mNormalOffset: number
            mUVOffset: number
            mSize: number
        }
    }
    readonly DebugRendererTriangleTraits: {
        prototype: {
            mVOffset: number
            mSize: number
        }
    }
    readonly EDrawMode_Wireframe: number
    readonly ECullMode_Off: number
    readonly ECullMode_CullBackFace: number
    readonly ECullMode_CullFrontFace: number
    readonly EShapeColor_InstanceColor: number
    readonly EShapeColor_ShapeTypeColor: number
    readonly EShapeColor_MotionTypeColor: number
    readonly EShapeColor_SleepColor: number
    readonly EShapeColor_IslandColor: number
    readonly EShapeColor_MaterialColor: number
    readonly Color: { new (): JoltColor }
    readonly HEAPF32: Float32Array
    readonly HEAPU32: Uint32Array
}

export interface JoltDebugRendererJS {
    Initialize(): void
    DrawBodies(physicsSystem: Jolt.PhysicsSystem, drawSettings: unknown): void
    DrawConstraints(physicsSystem: Jolt.PhysicsSystem): void
    DrawConstraintLimits(physicsSystem: Jolt.PhysicsSystem): void
    DrawLine: (inFrom: number, inTo: number, inColor: number) => void
    DrawTriangle: (inV1: number, inV2: number, inV3: number, inColor: number, inCastShadow: number) => void
    DrawText3D: (
        inPosition: number,
        inStringPtr: number,
        inStringLen: number,
        inColor: number,
        inHeight: number
    ) => void
    DrawGeometryWithID: (
        inModelMatrix: number,
        inWorldSpaceBounds: number,
        inLODScaleSq: number,
        inModelColor: number,
        inGeometryID: number,
        inCullMode: number,
        inCastShadow: number,
        inDrawMode: number
    ) => void
    CreateTriangleBatchID: (inTriangles: number, inTriangleCount: number) => number
    CreateTriangleBatchIDWithIndex: (
        inVertices: number,
        inVertexCount: number,
        inIndices: number,
        inIndexCount: number
    ) => number
}
