/**
 * Gera o favicon e os ícones do PWA a partir do "H" da marca.
 *
 * A fonte é o próprio `components/shell/MarcaHubBarber.tsx`: os `path` são lidos
 * de lá, e não copiados para um SVG à parte. Se a marca mudar, rodar este script
 * de novo basta — não existe segunda cópia para ficar para trás.
 *
 * O que sai daqui, e por quê:
 *
 * - `favicon.svg` — o ícone da aba. Mesmo desenho do avatar padrão do UserMenu:
 *   círculo roxo, H branco ocupando metade. O círculo é o que o torna legível em
 *   aba clara e escura sem precisar trocar de cor.
 * - `icon-192` / `icon-512` (`purpose: any`) — H branco sobre o roxo, fundo
 *   cheio até a borda.
 * - `icon-maskable-512` (`purpose: maskable`) — o Android recorta o ícone na
 *   forma do sistema (círculo, squircle, gota). O que estiver fora do círculo
 *   central de 80% É CORTADO, então o H encolhe e o roxo sangra até a borda.
 * - `apple-touch-icon` 180×180 — o iOS ignora o manifesto para o ícone da tela
 *   de início e lê esta tag. Tem que ser opaco: transparência ali é composta
 *   sobre preto sem aviso. Os cantos arredondados quem faz é o iOS.
 *
 * Rodar com `npm run icones`, de dentro de `CALENDARIO/`.
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ORIGEM = path.join(RAIZ, 'components', 'shell', 'MarcaHubBarber.tsx');
const PUBLICO = path.join(RAIZ, 'public');
const DESTINO = path.join(PUBLICO, 'icons');

/** O `--color-accent` do `index.css`: o roxo principal. */
const ROXO = '#5650f9';
const FUNDO = { r: 0x56, g: 0x50, b: 0xf9, alpha: 1 };

/**
 * Quanto do quadrado o H ocupa. O `maskable` é o menor de propósito: um
 * quadrado de lado L só cabe inteiro num círculo de 80% se L ≤ 0,566 do lado.
 */
const SAIDAS = [
  { arquivo: 'icon-192.png', tamanho: 192, escala: 0.56 },
  { arquivo: 'icon-512.png', tamanho: 512, escala: 0.56 },
  { arquivo: 'icon-maskable-512.png', tamanho: 512, escala: 0.46 },
  { arquivo: 'apple-touch-icon.png', tamanho: 180, escala: 0.56 },
];

const componente = await readFile(ORIGEM, 'utf8');
const viewBox = componente.match(/viewBox="([^"]+)"/)?.[1];
const caminhos = [...componente.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
if (!viewBox || caminhos.length === 0) {
  throw new Error(`Não achei viewBox/paths em ${ORIGEM} — o formato do componente mudou?`);
}
const paths = caminhos.map((d) => `<path d="${d}"/>`).join('');

/* Favicon: quadro de 100, círculo cheio, H em 50×50 no centro — a mesma
   proporção do `h-1/2 w-1/2` do avatar. O `svg` interno encaixa o viewBox da
   marca nesse espaço sem precisar recalcular coordenada nenhuma. */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<circle cx="50" cy="50" r="50" fill="${ROXO}"/>
<svg x="25" y="25" width="50" height="50" viewBox="${viewBox}" fill="#ffffff">${paths}</svg>
</svg>
`;
await writeFile(path.join(PUBLICO, 'favicon.svg'), favicon);
console.log('favicon.svg              círculo roxo, H branco');

/* Rasteriza grande UMA vez e reusa. O `trim` reencosta o recorte no desenho —
   o viewBox tem folga, e sem tirar isso a escala de cada saída seria calculada
   em cima de espaço vazio. */
const svgBranco = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="#ffffff">${paths}</svg>`;
const marca = await sharp(Buffer.from(svgBranco), { density: 600 })
  .resize({ width: 1400, height: 1400, fit: 'inside' })
  .trim()
  .png()
  .toBuffer();

for (const { arquivo, tamanho, escala } of SAIDAS) {
  const lado = Math.round(tamanho * escala);

  const h = await sharp(marca)
    .resize({ width: lado, height: lado, fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: FUNDO },
  })
    .composite([{ input: h, gravity: 'center' }])
    /* Achata o alfa: `maskable` e `apple-touch-icon` exigem opaco, e não há
       motivo para os outros dois carregarem um canal que ninguém usa. */
    .flatten({ background: FUNDO })
    .png()
    .toFile(path.join(DESTINO, arquivo));

  console.log(`${arquivo.padEnd(24)} ${tamanho}×${tamanho}  H ${lado}px`);
}
