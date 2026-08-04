# Arcada Hub

Suite interna de herramientas para **Arcada Integrated Construction Group LLC**
(Arcada Roofing), adaptada del EPCON Hub.

## Estructura

- `index.html` — Hub principal (nav + cards) — mismo patron que EPCON: cada
  herramienta vive en su propio archivo y se muestra dentro de un iframe.
- `estimados.html`, `contratos.html`, `financiamiento.html`, `appraisal.html`,
  `carta-asistencia.html`, `gastos.html` — herramientas individuales.
- `netlify/functions/` — funciones serverless (copiadas de tu EPCON Hub real
  y adaptadas a los IDs/nombres de campo de Arcada):
  - `search-leads.js` — busca clientes/proyectos en **Arcada LEADS**
  - `create-lead.js` — crea un lead nuevo cuando el inspector encuentra a
    alguien en campo que todavia no esta en Notion
  - `update-lead-status.js` — actualiza la **Fase** de un proyecto
  - `attach-pdf-to-notion.js` — adjunta un PDF generado a la pagina del proyecto
  - `add-comment.js` — agrega comentarios internos al hilo de discusion de una pagina
  - `get-measurements-subpage.js` / `sync-measurements-subpage.js` — leen y
    guardan las medidas del techo en la subpagina "Measurements" de cada
    proyecto (usadas por la Calculadora de Materiales, que todavia no se ha
    adaptado — ver pendientes abajo)
  - `extract-receipt.js` — lee un recibo con Claude Vision (monto/tienda/fecha)
  - `submit-gasto.js` — guarda el gasto en **Arcada Gastos**, con relacion
    opcional al proyecto y el recibo adjunto

## Variables de entorno (configurar en Netlify -> Site settings -> Environment variables)

| Variable | Para que se usa |
|---|---|
| `NOTION_TOKEN` | Token de tu integracion interna de Notion. Debe tener acceso compartido a las bases **Arcada LEADS** y **Arcada Gastos**, y las capacidades "Insert content" e "Insert comments" activadas. |
| `ANTHROPIC_API_KEY` | Para `extract-receipt.js` (lectura de recibos con Claude Vision). |

**Importante:** en Notion, comparte explicitamente las bases "Arcada LEADS" y
"Arcada Gastos" con tu integracion (... -> Connections -> tu integracion), o
las funciones recibiran error 404/"object not found" aunque el token sea
correcto.

## IDs de Notion usados en el codigo

- **Arcada LEADS** -- database ID (para REST API): `3c54995a-b723-4849-82d8-cccf0984cd95`
- **Arcada LEADS** -- data source ID (solo para MCP / Claude): `bbfccff6-d272-4e27-94e0-c6f68765e13f`
- **Arcada Gastos** -- database ID: `8d4c00d9-dce2-428c-a3c0-2e9832961c16`
- **Arcada Gastos** -- data source ID (usado directamente en `submit-gasto.js`, igual que en tu version de EPCON): `0475441e-2a70-4572-909f-e72e0b63ad09`

## Diferencias de schema vs EPCON LEADS (importante -- ya reflejadas en el codigo)

- El campo de pipeline se llama **`Fase`** (tipo *select*) en vez de `Status`
  (tipo *status* en EPCON). `create-lead.js`, `update-lead-status.js` y
  `search-leads.js` ya usan `Fase` y prueban `select` antes que `status`.
- **`Phone`** NO lleva espacio al final (EPCON usa `"Phone "` con espacio).
  Si copias/pegas codigo entre los dos repos en el futuro, este es el error
  mas facil de cometer -- Notion regresa "property not found" en silencio si
  te equivocas de nombre.
- El campo **`Fecha de Lead`** ya existia solo en EPCON; lo agregue a Arcada
  LEADS para que `create-lead.js` funcione igual en ambos.
- Estado inicial en `create-lead.js`: `"Arcada Inspection"` (equivalente a
  `"EPCON Inspection"` en el original) -- ya existe como opcion en el campo
  `Fase` de Arcada LEADS.
- Arcada LEADS **no tiene** una propiedad de archivos en su schema (tampoco
  la tiene EPCON LEADS). `attach-pdf-to-notion.js` sube el PDF con la File
  Upload API de Notion y lo agrega como **bloque `pdf` al final del
  contenido de la pagina** (no como propiedad) -- igual que en tu EPCON Hub.

## Pendiente / a verificar despues de desplegar

1. **Materiales (Calculadora) y Reportes Fotograficos** -- estos dos archivos
   HTML no se subieron en esta conversacion, asi que no los pude adaptar.
   Las funciones que usan (`get-measurements-subpage.js`,
   `sync-measurements-subpage.js`, `create-lead.js`, `update-lead-status.js`,
   `add-comment.js`) ya estan listas del lado de Notion/Arcada -- solo falta
   el HTML de esas dos herramientas. Mandamelos cuando los tengas y te los
   adapto igual que el resto.
2. Prueba el flujo completo una vez desplegado: `search-leads` ->
   `attach-pdf-to-notion` -> `submit-gasto`, en ese orden, para confirmar que
   el `NOTION_TOKEN` tiene los permisos correctos en ambas bases.
3. Registro DNS / dominio: el sitio esta listo para desplegarse en un nuevo
   sitio de Netlify (ej. `arcada-hub.netlify.app`), independiente de EPCON Hub.
4. Logo: ya integrado (nav en las 7 paginas + hero grande en `index.html`).
   Es rojo y el resto de la interfaz sigue usando el azul de EPCON
   (`#4a9fe0`) -- avisame si quieres que ajuste los acentos a la paleta roja
   de Arcada.
