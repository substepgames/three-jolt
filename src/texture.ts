import { RepeatWrapping, Texture, TextureLoader } from 'three'

export const texture = {
    grid: new Texture()
}

export const loadTextures = async () => {
    const grid = await new TextureLoader().loadAsync('texture/grid.png')
    grid.wrapS = RepeatWrapping
    grid.wrapT = RepeatWrapping
    grid.repeat.set(8, 8)
    texture.grid.copy(grid)
}
