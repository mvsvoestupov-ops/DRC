import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const publicDir = path.resolve(__dirname, 'public')
const srcIcon = path.resolve(__dirname, '../iconDRC.png')
if (fs.existsSync(srcIcon)) {
  fs.mkdirSync(publicDir, { recursive: true })
  fs.copyFileSync(srcIcon, path.join(publicDir, 'favicon.png'))
  fs.copyFileSync(srcIcon, path.join(publicDir, 'apple-touch-icon.png'))
}


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function spaGuideRoutes() {
  const rewrite = (url = '') => {
    const pathname = url.split('?')[0]
    if (
      pathname === '/guide' ||
      pathname === '/user-guide' ||
      pathname.startsWith('/guidelines')
    ) {
      return '/index.html'
    }
    return null
  }
  return {
    name: 'spa-guide-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const nextUrl = rewrite(req.url || '')
        if (nextUrl) req.url = nextUrl
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const nextUrl = rewrite(req.url || '')
        if (nextUrl) req.url = nextUrl
        next()
      })
    },
  }
}

export default defineConfig({
  appType: 'spa',
  plugins: [
    spaGuideRoutes(),
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
