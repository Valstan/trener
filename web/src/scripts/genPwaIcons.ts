/**
 * Генерация иконок PWA («Футбольная школа — координатор», веха PR3) — для манифеста
 * (установка «на экран») и apple-touch. Генерим один раз брендовый набор (футбольный
 * мяч на поле) и коммитим в web/public/icons/. Растеризация SVG → png через sharp.
 *
 *   node web/src/scripts/genPwaIcons.ts
 *   (Node 24 исполняет .ts напрямую; Payload здесь не используется.)
 *
 * Перегенерировать при смене палитры/мотива.
 *
 * Набор:
 *   icon-192.png / icon-512.png       — purpose: any (мяч на скруглённом поле)
 *   icon-maskable-512.png             — purpose: maskable (full-bleed фон, мяч в safe-zone)
 *   apple-touch-icon.png (180×180)    — iOS «добавить на экран»
 */
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import sharp from 'sharp'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(dirname, '../../public/icons')

const C = 256 // центр канвы 512×512

// Пятиугольник вершиной вверх вокруг (cx, cy) радиуса r — центральная грань мяча.
function pentagon(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + i * 72) * Math.PI) / 180
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

// Швы: от вершин центрального пятиугольника наружу к кромке мяча.
function seams(cx: number, cy: number, rInner: number, rOuter: number): string {
  let d = ''
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + i * 72) * Math.PI) / 180
    const x1 = cx + rInner * Math.cos(a)
    const y1 = cy + rInner * Math.sin(a)
    const x2 = cx + rOuter * Math.cos(a)
    const y2 = cy + rOuter * Math.sin(a)
    d += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
  }
  return d
}

// Футбольный мяч: белый круг + центральный тёмный пятиугольник + швы.
function ball(ballR: number): string {
  const penR = ballR * 0.34
  return `
    <circle cx="${C}" cy="${C}" r="${ballR}" fill="#ffffff" stroke="#0b1f17" stroke-width="6"/>
    <polygon points="${pentagon(C, C, penR)}" fill="#0b1f17"/>
    <g stroke="#0b1f17" stroke-width="7" stroke-linecap="round">
      ${seams(C, C, penR * 1.05, ballR * 0.82)}
    </g>`
}

const bgGradient = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0b1f17"/>
    <stop offset="0.6" stop-color="#15533a"/>
    <stop offset="1" stop-color="#16a34a"/>
  </linearGradient>`

// purpose: any — скруглённое поле, мяч с воздухом по краям.
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>${bgGradient}</defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  ${ball(150)}
</svg>`

// purpose: maskable — фон full-bleed (без скруглений), мяч меньше (safe-zone ~60%).
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>${bgGradient}</defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  ${ball(120)}
</svg>`

await fs.mkdir(outDir, { recursive: true })

async function png(svg: string, size: number, name: string): Promise<void> {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await fs.writeFile(path.join(outDir, name), buf)
  console.log(`${name}: ${buf.length} байт`)
}

await png(anySvg, 192, 'icon-192.png')
await png(anySvg, 512, 'icon-512.png')
await png(maskableSvg, 512, 'icon-maskable-512.png')
await png(anySvg, 180, 'apple-touch-icon.png')

console.log(`Иконки записаны в ${outDir}`)
