import { env } from 'process'
import { defineConfig } from 'vite'
// @ts-ignore
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation'
import solid from 'vite-plugin-solid'

const debugMode = env.DEBUG !== undefined
if (debugMode) {
    console.debug('debug mode')
}

export default defineConfig({
    plugins: [solid(), crossOriginIsolation()],
    define: {
        'import.meta.env.debugMode': debugMode
    },
    server: {
        port: 3000,
        hmr: false,
        watch: undefined
    },
    optimizeDeps: {
        exclude: debugMode ? [] : ['jolt-physics']
    },
    build: {
        target: 'esnext'
    }
})
