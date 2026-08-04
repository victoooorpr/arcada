// Netlify Function — agrega un comentario al hilo de discusión de una página de Notion
// Ruta en tu repo: netlify/functions/add-comment.js
//
// Se usa para los "comentarios internos" del reporte fotográfico: cada vez que
// se genera el PDF de una etapa (Before/During/After) con un comentario interno
// escrito, se manda aquí. Notion acumula los comentarios en orden cronológico
// por su cuenta — no hace falta borrar ni reemplazar nada, cada llamada agrega
// una entrada nueva al hilo.
//
// Requiere que la integración de Notion tenga activada la capacidad
// "Insert comments" (Notion > Integraciones > tu integración > Capabilities).
//
// Variable de entorno requerida en Netlify: NOTION_TOKEN

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

  const { pageId, text } = body;
  if (!pageId || !text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta pageId o text' }) };
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  try {
    const resp = await fetch('https://api.notion.com/v1/comments', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        parent: { page_id: pageId },
        rich_text: [{ text: { content: text.slice(0, 2000) } }] // Notion limita ~2000 caracteres por bloque de texto
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, id: data.id }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
