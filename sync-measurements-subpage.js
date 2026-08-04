// Netlify Function — crea (una sola vez) una subpágina "Measurements" dentro
// de la página del proyecto en Notion, y le agrega una entrada fechada cada
// vez que las medidas cambian: una lista legible + un bloque de código con el
// JSON (para que la Calculadora de Materiales lo lea directo, sin adivinar).
//
// Ruta: netlify/functions/sync-measurements-subpage.js
// Variable de entorno requerida: NOTION_TOKEN
// Requiere que la integración tenga activada "Insert content".

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'NOTION_TOKEN no está configurado en las variables de entorno de Netlify.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido en el body' }) };
  }

  const { parentPageId, existingPageId, title, entryTitle, rows, jsonData } = body;
  if (!parentPageId || !Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta parentPageId o rows' }) };
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  try {
    let pageId = existingPageId;

    // Paso 1: crear la subpágina "Measurements" solo si todavía no existe
    if (!pageId) {
      const createResp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parent: { page_id: parentPageId },
          properties: { title: { title: [{ text: { content: (title || 'Measurements').slice(0, 2000) } }] } }
        })
      });
      const createData = await createResp.json();
      if (!createResp.ok) {
        return { statusCode: createResp.status, body: JSON.stringify({ error: createData, step: 'create_page' }) };
      }
      pageId = createData.id;
    }

    // Paso 2: agregar una entrada fechada (lista legible + JSON en bloque de código)
    const children = [
      { type: 'heading_3', heading_3: { rich_text: [{ text: { content: (entryTitle || 'Medidas').slice(0, 2000) } }] } },
      ...rows.map(r => ({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ text: { content: `${r[0]}: ${r[1]}`.slice(0, 2000) } }] }
      })),
      {
        type: 'code',
        code: {
          language: 'json',
          rich_text: [{ text: { content: JSON.stringify(jsonData || {}, null, 2).slice(0, 2000) } }]
        }
      }
    ];

    const appendResp = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ children })
    });
    const appendData = await appendResp.json();
    if (!appendResp.ok) {
      return { statusCode: appendResp.status, body: JSON.stringify({ error: appendData, step: 'append', pageId }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, pageId }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
