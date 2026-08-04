/**
 * Gera os ícones do PWA a partir da tesoura do FAB (`assets/Ativo 4.svg`).
 *
 * O SVG é a mesma arte que o `PresencialFAB` desenha, e vem com os traços em
 * preto sobre transparente — no app ela é embranquecida por `filter: invert(1)`
 * em tempo de render. Aqui a inversão não serve: ícone de PWA é arquivo, não
 * elemento com CSS. Por isso o branco entra como `fill` no próprio SVG antes de
 * rasterizar.
 *
 * Três formatos saem daqui, e cada um existe por um motivo diferente:
 *
 * - `icon-192` / `icon-512` (`purpose: any`) — o ícone comum.
 * - `icon-maskable-512` (`purpose: maskable`) — o Android recorta o ícone na
 *   forma do sistema (círculo, squircle, gota). O que estiver fora do círculo
 *   central de 80% É CORTADO, então a tesoura encolhe e o fundo sangra até a
 *   borda. Antes desta rodada o `maskable` reaproveitava o ícone comum, que era
 *   branco sobre TRANSPARENTE — o recorte deixava buraco.
 * - `apple-touch-icon` 180×180 — o iOS ignora o manifesto para o ícone da tela
 *   de início e lê esta tag. Tem que ser opaco: transparência ali é composta
 *   sobre preto sem aviso.
 *
 * Rodar com `npm run icones`, de dentro de `CALENDARIO/`.
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ORIGEM = path.join(RAIZ, 'assets', 'Ativo 4.svg');
const DESTINO = path.join(RAIZ, 'public', 'icons');

/** Mesmo `--color-background` do `index.css`: o ícone não pode destoar do app. */
const FUNDO = { r: 0x1c, g: 0x1c, b: 0x1c, alpha: 1 };

/** Os mesmos 40° que o FAB aplica na tesoura — é a forma que ele reconhece. */
const ROTACAO = 40;

/**
 * Quanto do quadrado a tesoura ocupa. O `maskable` é o menor de propósito: um
 * quadrado de lado L só cabe inteiro num círculo de 80% se L ≤ 0,566 do lado.
 */
const SAIDAS = [
  { arquivo: 'icon-192.png', tamanho: 192, escala: 0.68 },
  { arquivo: 'icon-512.png', tamanho: 512, escala: 0.68 },
  { arquivo: 'icon-maskable-512.png', tamanho: 512, escala: 0.56 },
  { arquivo: 'apple-touch-icon.png', tamanho: 180, escala: 0.66 },
];

const svg = await readFile(ORIGEM, 'utf8');

/* O `fill` entra no elemento raiz porque os `path` não declaram nenhum — sem
   isso herdariam o preto padrão e o ícone sairia invisível no fundo escuro. */
const svgBranco = svg.replace('<svg ', '<svg fill="#ffffff" ');

/* Rasteriza grande UMA vez e reusa: girar depois de reduzir serrilha a lâmina.
   O `trim` reencosta o recorte no desenho — a rotação infla a caixa com
   transparente nos cantos, e sem tirar isso a escala de cada saída seria
   calculada em cima de espaço vazio. */
const tesoura = await sharp(Buffer.from(svgBranco), { density: 600 })
  .resize({ width: 1400, height: 1400, fit: 'inside' })
  .rotate(ROTACAO, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .trim()
  .png()
  .toBuffer();

for (const { arquivo, tamanho, escala } of SAIDAS) {
  const lado = Math.round(tamanho * escala);

  const lamina = await sharp(tesoura)
    .resize({ width: lado, height: lado, fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: FUNDO },
  })
    .composite([{ input: lamina, gravity: 'center' }])
    /* Achata o alfa: `maskable` e `apple-touch-icon` exigem opaco, e não há
       motivo para os outros dois carregarem um canal que ninguém usa. */
    .flatten({ background: FUNDO })
    .png()
    .toFile(path.join(DESTINO, arquivo));

  console.log(`${arquivo.padEnd(24)} ${tamanho}×${tamanho}  tesoura ${lado}px`);
}
