import { Vector3 } from 'three'

export const gravity = new Vector3(0, -9.8, 0)
export const fps = 60
export const substeps = 2
export const dt = 1 / (substeps * fps)
