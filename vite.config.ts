import { defineConfig } from 'vite'
// @ts-ignore
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation'
import solid from 'vite-plugin-solid'

export default defineConfig({
    plugins: [solid(), crossOriginIsolation()],
    server: {
        port: 3000,
        hmr: false,
        watch: undefined
    },
    optimizeDeps: {
        exclude: ['jolt-physics']
    },
    build: {
        target: 'esnext'
    }
})
