import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Os packages do monorepo sao TypeScript cru, o Next compila junto.
  transpilePackages: ['@ct/db', '@ct/shared'],

  // Raiz explicita do monorepo. Sem ela o Next adivinha errado quando existe
  // outro package-lock.json acima na arvore do sistema de arquivos.
  outputFileTracingRoot: path.join(aqui, '../../'),
}

export default nextConfig
