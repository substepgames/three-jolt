export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(n, max))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
