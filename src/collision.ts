export const makeCollisionGroup = (member: number[], filter: number[]): number => {
    return (member.reduce((a, b) => a + b, 0) << 16) | filter.reduce((a, b) => a + b, 0)
}

const terrainCollision = 1 << 0

export const terrainCollisionGroups = makeCollisionGroup([terrainCollision], [terrainCollision])
