// Netlify Function — busca la subpágina "Measurements" dentro de la página
// de un proyecto en Notion (creada por la herramienta de Reportes) y regresa
// el JSON más reciente guardado ahí, para que la Calculadora de Materiales
// pueda llenar sus campos automáticamente.
//
// Ruta: netlify/functions/get-measurements-subpage.js
// Variable de entorno requerida: NOTION_TOKEN

exports.handler = async (event) => {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'NOTION_TOKEN no está configurado en las variables de entorno de Netlify.' }) };
  }

  const parentPageId = (event.queryStringParameters && event.queryStringParameters.pageId) || '';
  if (!parentPageId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta pageId' }) };
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28'
  };

  try {
    // Paso 1: buscar entre los bloques hijos de la página del proyecto una
    // subpágina llamada "Measurements".
    const childrenResp = await fetch(`https://api.notion.com/v1/blocks/${parentPageId}/children?page_size=100`, { headers });
    const childrenData = await childrenResp.json();
    if (!childrenResp.ok) {
      return { statusCode: childrenResp.status, body: JSON.stringify({ error: childrenData, step: 'list_children' }) };
    }

    const measurementsPage = (childrenData.results || []).find(b =>
      b.type === 'child_page' && b.child_page && /measurements/i.test(b.child_page.title || '')
    );

    if (!measurementsPage) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ found: false }) };
    }

    // Paso 2: leer los bloques de esa subpágina y encontrar el bloque de
    // código (JSON) más reciente — se van agregando al final cada vez.
    const blocksResp = await fetch(`https://api.notion.com/v1/blocks/${measurementsPage.id}/children?page_size=100`, { headers });
    const blocksData = await blocksResp.json();
    if (!blocksResp.ok) {
      return { statusCode: blocksResp.status, body: JSON.stringify({ error: blocksData, step: 'list_measurements_blocks' }) };
    }

    const codeBlocks = (blocksData.results || []).filter(b => b.type === 'code');
    if (codeBlocks.length === 0) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ found: false }) };
    }

    const lastCodeBlock = codeBlocks[codeBlocks.length - 1];
    const rawText = (lastCodeBlock.code.rich_text || []).map(t => t.plain_text).join('');

    let measurements;
    try {
      measurements = JSON.parse(rawText);
    } catch (e) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ found: false, error: 'No se pudo leer el JSON guardado' }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ found: true, measurements }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
