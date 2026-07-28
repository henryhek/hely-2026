// @ts-check
import { defineConfig } from 'astro/config';
import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';

// URL exacta con la que se debe vincular el CSS en todos los HTML.
const CSS_HREF = 'https://cloud.comunicaciones.proyectivaseguros.com/ds';
// Base para los <script>: cada JS queda como <BASE>ds<NombreLimpio>
// (ej. .../dsFormularioAutosStep).
const JS_HREF_BASE = 'https://cloud.comunicaciones.proyectivaseguros.com/functions-proyectiva-';

/**
 * Reescribe el <link> del bundle ds.css para que apunte exactamente a CSS_HREF,
 * sin ruta adicional. El archivo se sigue generando en dist/assets/ds.css.
 */
function forzarLinkCss() {
  return {
    name: 'forzar-link-css',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const distDir = fileURLToPath(dir);
        const assetsDir = path.join(distDir, 'assets');

        // 1. Renombra los .js de Astro a nombres limpios (sin sufijos ni hash)
        //    y construye el mapa nombreViejo -> nombreNuevo.
        const mapaJs = new Map();
        const entradasAssets = await readdir(assetsDir, { withFileTypes: true });
        for (const entrada of entradasAssets) {
          if (!entrada.isFile() || !entrada.name.endsWith('.js')) continue;
          const limpio = `${limpiarNombre(entrada.name)}.js`;
          if (limpio === entrada.name) continue;
          await rename(
            path.join(assetsDir, entrada.name),
            path.join(assetsDir, limpio),
          );
          mapaJs.set(entrada.name, limpio);
        }

        // 2. Reescribe los HTML: link del CSS + referencias a los .js renombrados.
        const recorrer = async (carpeta) => {
          const entradas = await readdir(carpeta, { withFileTypes: true });
          for (const entrada of entradas) {
            const ruta = path.join(carpeta, entrada.name);
            if (entrada.isDirectory()) {
              await recorrer(ruta);
            } else if (entrada.name.endsWith('.html')) {
              const html = await readFile(ruta, 'utf-8');
              let reemplazado = html.replace(
                /href="[^"]*assets\/ds\.css"/g,
                `href="${CSS_HREF}"`,
              );
              for (const [viejo, nuevo] of mapaJs) {
                reemplazado = reemplazado.split(viejo).join(nuevo);
              }
              // Reescribe cada <script src="...assets/<Nombre>.js"> a la CDN:
              // src="<JS_HREF_BASE><Nombre>" (ej. .../dsFormularioAutosStep).
              reemplazado = reemplazado.replace(
                /src="[^"]*assets\/([^"/]+)\.js"/g,
                (_coincidencia, nombre) => `src="${JS_HREF_BASE}${nombre}"`,
              );
              if (reemplazado !== html) {
                await writeFile(ruta, reemplazado);
              }
            }
          }
        };

        await recorrer(distDir);
      },
    },
  };
}

/**
 * Extrae un nombre de archivo legible del nombre de chunk de Astro/Rollup.
 * "FormularioAutosStep.astro_astro_type_script_index_0_lang" -> "FormularioAutosStep"
 */
function limpiarNombre(nombre) {
  return (nombre ?? 'script').split('.astro')[0].split('.')[0];
}

// https://astro.build/config
export default defineConfig({
  // Mantiene el HTML sin minificar: salida indentada y legible.
  compressHTML: false,
  integrations: [forzarLinkCss()],
  build: {
    // Evita que Astro incruste el CSS en el HTML: siempre archivo externo.
    inlineStylesheets: 'never',
    // Carpeta de assets generados (JS/CSS): assets/ en vez de _astro/.
    assets: 'assets',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Un solo bundle de CSS para poder darle nombre fijo.
      cssCodeSplit: false,
      // JS legible: sin minificar.
      minify: false,
      // CSS sí se minifica (independiente de `minify`).
      cssMinify: true,
      rollupOptions: {
        output: {
          // JS legible y en assets/ con nombre limpio (sin sufijos ni hash).
          entryFileNames: (chunk) => `assets/${limpiarNombre(chunk.name)}.js`,
          chunkFileNames: (chunk) => `assets/${limpiarNombre(chunk.name)}.js`,
          assetFileNames: (asset) =>
            (asset.names ?? []).some((nombre) => nombre.endsWith('.css'))
              ? 'assets/ds.css'
              : 'assets/[name][extname]',
        },
      },
    },
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});
