import type Jolt from 'jolt-physics'
import * as three from 'three'
import { jolt } from './jolt'

export const vec3ToThree = (v: Jolt.Vec3 | Jolt.RVec3): three.Vector3 => new three.Vector3(v.GetX(), v.GetY(), v.GetZ())
export const vec3ToJolt = (v: three.Vector3): Jolt.Vec3 => new jolt.Vec3(v.x, v.y, v.z)
export const vec3ToJoltR = (v: three.Vector3): Jolt.RVec3 => new jolt.RVec3(v.x, v.y, v.z)
export const quatToThree = (q: Jolt.Quat): three.Quaternion =>
    new three.Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW())
export const quatToJolt = (q: three.Quaternion): Jolt.Quat => new jolt.Quat(q.x, q.y, q.z, q.w)
