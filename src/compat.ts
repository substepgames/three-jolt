import { Quaternion, Vector3 } from '@dimforge/rapier3d'
import * as three from 'three'

export const vec3RapierToThree = (v: Vector3): three.Vector3 => new three.Vector3(v.x, v.y, v.z)
export const quatToThree = (quat: Quaternion): three.Quaternion => new three.Quaternion(quat.x, quat.y, quat.z, quat.w)
