import type Jolt from 'jolt-physics'
import {
    BackSide,
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    FrontSide,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    LineBasicMaterial,
    LineSegments,
    Material,
    Matrix4,
    Mesh,
    MeshPhongMaterial,
    Scene,
    Vector3
} from 'three'
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { jolt, physicsSystem, vec3ToThree } from './jolt'

export type BodyManagerDrawSettings = {
    mDrawGetSupportFunction: boolean
    mDrawSupportDirection: boolean
    mDrawGetSupportingFace: boolean
    mDrawShape: boolean
    mDrawShapeWireframe: boolean
    mDrawShapeColor: number
    mDrawBoundingBox: boolean
    mDrawCenterOfMassTransform: boolean
    mDrawWorldTransform: boolean
    mDrawVelocity: boolean
    mDrawMassAndInertia: boolean
    mDrawSleepStats: boolean
    mDrawSoftBodyVertices: boolean
    mDrawSoftBodyVertexVelocities: boolean
    mDrawSoftBodyEdgeConstraints: boolean
    mDrawSoftBodyBendConstraints: boolean
    mDrawSoftBodyVolumeConstraints: boolean
    mDrawSoftBodySkinConstraints: boolean
    mDrawSoftBodyLRAConstraints: boolean
    mDrawSoftBodyRods: boolean
    mDrawSoftBodyRodStates: boolean
    mDrawSoftBodyRodBendTwistConstraints: boolean
    mDrawSoftBodyPredictedBounds: boolean
    mDrawSoftBodyConstraintColor: number
}

export class DebugRenderer {
    materialCache: Record<string, Material> = {}
    lineCache: Record<number, Vector3[]> = {}
    lineMesh: Record<number, LineSegments> = {}
    triangleCache: Record<number, Vector3[]> = {}
    triangleMesh: Record<number, Mesh> = {}
    meshList: Mesh[] = []
    geometryList: { matrix: Matrix4; geometry: BufferGeometry; color: number; drawMode: number; cullMode: number }[] =
        []
    geometryCache: BufferGeometry[] = []
    textCache = []
    textList = []
    scene: Scene
    renderer
    css3dRender!: CSS3DRenderer
    initialized = false

    constructor(scene: Scene) {
        this.renderer = new jolt.DebugRendererJS()
        this.renderer.DrawLine = this.drawLine.bind(this)
        this.renderer.DrawTriangle = this.drawTriangle.bind(this)
        this.renderer.DrawText3D = this.drawText3D.bind(this)
        this.renderer.DrawGeometryWithID = this.drawGeometryWithID.bind(this)
        this.renderer.CreateTriangleBatchID = this.createTriangleBatchID.bind(this)
        this.renderer.CreateTriangleBatchIDWithIndex = this.createTriangleBatchIDWithIndex.bind(this)
        this.scene = scene
    }

    initialize() {
        if (!this.initialized) {
            this.renderer.Initialize()
            this.initialized = true
        }
    }

    /**
     * Draws all bodies, assuming DrawSettings has mDrawShape enabled
     */
    drawBodies(system: Jolt.PhysicsSystem, inDrawSettings: Partial<BodyManagerDrawSettings>) {
        this.renderer.DrawBodies(system, inDrawSettings)
    }

    /**
     * Draws constraint relationships as lines. Some constraints include additional Text Data
     */
    drawConstraints(system: Jolt.PhysicsSystem) {
        this.renderer.DrawConstraints(system)
    }

    /**
     * Draws text indicating limits on constraints, such as the distance of a distance constraint
     */
    DrawConstraintLimits(system: Jolt.PhysicsSystem) {
        this.renderer.DrawConstraintLimits(system)
    }

    drawLine(inFrom: number, inTo: number, inColor: number) {
        const colorU32 = jolt.wrapPointer(inColor, jolt.Color).mU32 >>> 0
        const arr = (this.lineCache[colorU32] = this.lineCache[colorU32] || [])
        const v0 = vec3ToThree(jolt.wrapPointer(inFrom, jolt.RVec3))
        const v1 = vec3ToThree(jolt.wrapPointer(inTo, jolt.RVec3))
        arr.push(v0, v1)
    }

    drawTriangle(inV1: number, inV2: number, inV3: number, inColor: number, inCastShadow: number) {
        const colorU32 = jolt.wrapPointer(inColor, jolt.Color).mU32 >>> 0
        const arr = (this.lineCache[colorU32] = this.lineCache[colorU32] || [])
        const v0 = vec3ToThree(jolt.wrapPointer(inV1, jolt.RVec3))
        const v1 = vec3ToThree(jolt.wrapPointer(inV2, jolt.RVec3))
        const v2 = vec3ToThree(jolt.wrapPointer(inV3, jolt.RVec3))
        arr.push(v0, v1)
        arr.push(v1, v2)
        arr.push(v2, v0)
    }

    drawText3D(inPosition: number, inStringPtr: number, inStringLen: number, inColor: number, inHeight: number) {
        // const color = jolt.wrapPointer(inColor, jolt.Color).mU32 >>> 0
        // const position = jolt.wrapPointer(inPosition, jolt.RVec3)
        // const height = inHeight
        // const text = new TextDecoder().decode(jolt.HEAPU8.subarray(inStringPtr, inStringPtr + inStringLen))
        // this.textList.push({ color, position, height, text })
    }

    /**
     * Assuming a Render Geometry/Batch has been created, the following is a request to render the Geometry at a given model location
     */
    drawGeometryWithID(
        inModelMatrix: number,
        inWorldSpaceBounds: number,
        inLODScaleSq: number,
        inModelColor: number,
        inGeometryID: number,
        inCullMode: number,
        inCastShadow: number,
        inDrawMode: number
    ) {
        const colorU32 = jolt.wrapPointer(inModelColor, jolt.Color).mU32 >>> 0
        const modelMatrix = jolt.wrapPointer(inModelMatrix, jolt.RMat44)
        const v0 = vec3ToThree(modelMatrix.GetAxisX())
        const v1 = vec3ToThree(modelMatrix.GetAxisY())
        const v2 = vec3ToThree(modelMatrix.GetAxisZ())
        const v3 = vec3ToThree(modelMatrix.GetTranslation())
        const matrix = new Matrix4().makeBasis(v0, v1, v2).setPosition(v3)
        this.geometryList.push({
            matrix,
            geometry: this.geometryCache[inGeometryID],
            color: colorU32,
            drawMode: inDrawMode,
            cullMode: inCullMode
        })
    }

    /**
     * On initializing the Renderer, or adding new rigid Mesh, the following methods will send the vertex data here to construct a Render Geometry
     */
    createTriangleBatchID(inTriangles: number, inTriangleCount: number) {
        const batchID = this.geometryCache.length
        const { mPositionOffset, mNormalOffset, mUVOffset, mSize } = jolt.DebugRendererVertexTraits.prototype
        const interleaveBufferF32 = new Float32Array((inTriangleCount * 3 * mSize) / 4)

        // Assuming a triangle is tightly packed (always 3 vertex with no leading or trailing space), we can treat the data chunk
        // as a whole as if it was an interleaved vertex buffer, assuming no alignment issues such that element N+1 is more than (size) from element N+0
        // This case is always true as of this coding, but should it not be, the following [else] case will extract just the 3 vertex
        if (
            jolt.DebugRendererTriangleTraits.prototype.mVOffset === 0 &&
            jolt.DebugRendererTriangleTraits.prototype.mSize === mSize * 3
        ) {
            interleaveBufferF32.set(new Float32Array(jolt.HEAPF32.buffer, inTriangles, interleaveBufferF32.length))
        } else {
            const vertexChunk = (mSize / 4) * 3
            for (let i = 0; i < inTriangleCount; i++) {
                const triOffset =
                    inTriangles +
                    i * jolt.DebugRendererTriangleTraits.prototype.mSize +
                    jolt.DebugRendererTriangleTraits.prototype.mVOffset
                interleaveBufferF32.set(new Float32Array(jolt.HEAPF32.buffer, triOffset, i * vertexChunk))
            }
        }
        const geometry = new BufferGeometry()
        const interleavedBuffer = new InterleavedBuffer(interleaveBufferF32, mSize / 4)
        geometry.setAttribute('position', new InterleavedBufferAttribute(interleavedBuffer, 3, mPositionOffset / 4))
        geometry.setAttribute('normal', new InterleavedBufferAttribute(interleavedBuffer, 3, mNormalOffset / 4))
        geometry.setAttribute('uv', new InterleavedBufferAttribute(interleavedBuffer, 2, mUVOffset / 4))
        this.geometryCache.push(geometry)
        return batchID
    }

    createTriangleBatchIDWithIndex(inVertices: number, inVertexCount: number, inIndices: number, inIndexCount: number) {
        const batchID = this.geometryCache.length
        const { mPositionOffset, mNormalOffset, mUVOffset, mSize } = jolt.DebugRendererVertexTraits.prototype
        const interleaveBufferF32 = new Float32Array((inVertexCount * mSize) / 4)
        interleaveBufferF32.set(new Float32Array(jolt.HEAPF32.buffer, inVertices, interleaveBufferF32.length))
        const index = new Uint32Array(inIndexCount)

        // Unlike triangles, by definition this data will be an interleaved data buffer
        index.set(jolt.HEAPU32.subarray(inIndices / 4, inIndices / 4 + inIndexCount))
        const geometry = new BufferGeometry()
        const interleavedBuffer = new InterleavedBuffer(interleaveBufferF32, mSize / 4)
        geometry.setAttribute('position', new InterleavedBufferAttribute(interleavedBuffer, 3, mPositionOffset / 4))
        geometry.setAttribute('normal', new InterleavedBufferAttribute(interleavedBuffer, 3, mNormalOffset / 4))
        geometry.setAttribute('uv', new InterleavedBufferAttribute(interleavedBuffer, 2, mUVOffset / 4))
        geometry.setIndex(new BufferAttribute(index, 1))
        this.geometryCache.push(geometry)
        return batchID
    }

    // Debug Renderer supports applying color, Front and Back face culling, and drawing as solid or wire frame.
    // These all correspond to different Three Materials, so cache them here.
    getMeshMaterial(color: number, cullMode?: number, drawMode?: number) {
        const key = `${color}|${cullMode}|${drawMode}`
        if (!this.materialCache[key]) {
            const material = (this.materialCache[key] = new MeshPhongMaterial({ color: color }))
            if (drawMode === jolt.EDrawMode_Wireframe) {
                material.wireframe = true
            }
            if (cullMode !== undefined) {
                switch (cullMode) {
                    case jolt.ECullMode_Off:
                        material.side = DoubleSide
                        break
                    case jolt.ECullMode_CullBackFace:
                        material.side = FrontSide
                        break
                    case jolt.ECullMode_CullFrontFace:
                        material.side = BackSide
                        break
                }
            }
        }
        return this.materialCache[key]
    }

    /*
     * The following call flushes all accumulated Draw calls to new or existing Meshes that have been cached.
     * Line/Triangle calls are combined into single Meshes per material.
     * Text3D calls trigger a lazy initialization of CSS3D Render to render the text as transformed DIVs
     */
    flush() {
        // Clear previous frames meshes, in case this frame no longer has these meshes.
        ;[Object.values(this.lineMesh), Object.values(this.triangleMesh), this.meshList, this.textCache].forEach(
            meshes => {
                meshes.forEach(mesh => (mesh.visible = false))
            }
        )
        Object.entries(this.lineCache).forEach(([colorU32, points]) => {
            const color = Number.parseInt(colorU32, 10)
            if (this.lineMesh[color]) {
                this.lineMesh[color].geometry = new BufferGeometry().setFromPoints(points)
                const mesh = this.lineMesh[color]
                mesh.visible = true
            } else {
                const material = new LineBasicMaterial({ color: color })
                const geometry = new BufferGeometry().setFromPoints(points)
                const mesh = (this.lineMesh[color] = new LineSegments(geometry, material))
                mesh.layers.set(1)
                this.scene.add(mesh)
            }
        })
        Object.entries(this.triangleCache).forEach(([colorU32, points]) => {
            const color = Number.parseInt(colorU32, 10)
            if (this.triangleMesh[color]) {
                this.triangleMesh[color].geometry = new BufferGeometry().setFromPoints(points)
                const mesh = this.triangleMesh[color]
                mesh.visible = true
            } else {
                const material = this.getMeshMaterial(color, undefined, undefined)
                const geometry = new BufferGeometry().setFromPoints(points)
                const mesh = (this.triangleMesh[color] = new Mesh(geometry, material))
                mesh.layers.set(1)
                this.scene.add(mesh)
            }
        })
        this.geometryList.forEach(({ geometry, color, matrix, cullMode, drawMode }, i) => {
            const material = this.getMeshMaterial(color, cullMode, drawMode)
            let mesh = this.meshList[i]
            if (!mesh) {
                mesh = new Mesh(geometry, material)
                this.meshList[i] = mesh
                mesh.layers.set(1)
                this.scene.add(mesh)
            } else {
                mesh.material = material
                mesh.geometry = geometry
            }
            matrix.decompose(mesh.position, mesh.quaternion, mesh.scale)
            mesh.visible = true
        })
        // this.textList.forEach(({ position, text, color, height }, i) => {
        //     let mesh = this.textCache[i]
        //     if (!this.css3dRender) {
        //         // Lazy construct a CSS3D Renderer.
        //         this.css3dRender = new CSS3DRenderer()
        //         const renderSize = new Vector2()
        //         renderer.getSize(renderSize)
        //         this.css3dRender.setSize(renderSize.x, renderSize.y)
        //         const element = this.css3dRender.domElement
        //         element.style.position = 'absolute'
        //         element.style.left = element.style.right = element.style.top = element.style.bottom = '0'
        //         document.getElementById('container')?.append(element)
        //         window.addEventListener(
        //             'resize',
        //             () => {
        //                 renderer.getSize(renderSize)
        //                 this.css3dRender.setSize(renderSize.x, renderSize.y)
        //             },
        //             false
        //         )
        //     }
        //     if (!mesh) {
        //         mesh = this.textCache[i] = new CSS3DObject(document.createElement('div'))
        //         mesh.element.style.display = 'block'
        //         mesh.element.style.fontSize = '1px'
        //         mesh.layers.set(1)
        //         scene.add(mesh)
        //     } else {
        //         mesh.element.innerText = text
        //         mesh.element.style.color = '#' + ('000000' + color.toString(16)).substr(-6)
        //     }
        //     mesh.position.copy(position)
        //     mesh.visible = true
        // })
        // // Render the CSS 3D here (updates the DIV locations and css transforms)
        // this.css3dRender && this.css3dRender.render(scene, camera)
        // Clear the accumulators of [Draw] requests
        this.geometryList = []
        this.textList = []
        this.lineCache = {}
        this.triangleCache = {}
    }

    render() {
        this.initialize()

        const bodyDrawSettings = new jolt.BodyManagerDrawSettings()
        bodyDrawSettings.mDrawShape = true
        bodyDrawSettings.mDrawShapeColor = jolt.EShapeColor_InstanceColor
        // bodyDrawSettings.mDrawShapeWireframe = true
        // bodyDrawSettings.mDrawBoundingBox = true
        // bodyDrawSettings.mDrawCenterOfMassTransform = true
        // bodyDrawSettings.mDrawWorldTransform = true
        // bodyDrawSettings.mDrawVelocity = true
        // bodyDrawSettings.mDrawMassAndInertia = true
        // bodyDrawSettings.mDrawSleepStats = true

        this.drawBodies(physicsSystem, bodyDrawSettings)
        this.drawConstraints(physicsSystem)
        this.DrawConstraintLimits(physicsSystem)
        this.flush()
    }
}
