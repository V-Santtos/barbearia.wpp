import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    server: {
      port: 3002,
      host: '0.0.0.0',
    },
    /* O service worker só existe no build (`devOptions.enabled: false` abaixo),
       então conferir o PWA de verdade é `npm run build && npm run preview`. Sem
       este bloco o preview sobe em 4173/localhost e o celular não alcança.
       A porta é a mesma 3002 do dev de propósito: `VITE_CALENDAR_API_URL` e
       `CORS_ORIGINS` do `.env` continuam valendo sem tocar em nada. */
    preview: {
      port: 3002,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false,
        },
        manifest: {
          name: 'Barbearia Admin',
          short_name: 'Admin',
          description: 'Calendário administrativo da barbearia',
          lang: 'pt-BR',
          /* Sem isto o VitePWA escreve `lang: "en"` no manifesto gerado. */
          dir: 'ltr',
          /* Mesmo `--color-background` do `index.css`, e não o preto de antes.
             No iOS a barra de status é transparente de verdade (o
             `black-translucent` do index.html) e quem pinta é o sistema; no
             Android o `theme_color` SEMPRE pinta, não existe transparente no
             manifesto. Igualar ao fundo do app é o mais perto de "não pintar"
             que o Android permite: some a emenda entre barra e conteúdo. */
          theme_color: '#1c1c1c',
          background_color: '#1c1c1c',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            /* Arquivo próprio, com a tesoura menor e o fundo sangrando até a
               borda. Reaproveitar o ícone comum aqui era buraco na certa: o
               Android recorta o `maskable` na forma do sistema. */
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
