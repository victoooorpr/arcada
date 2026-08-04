// Netlify Function — actualiza la Fase de un lead en Notion
// Ruta en tu repo: netlify/functions/update-lead-status.js
//
// Nota importante: esta función NO decide si debe o no avanzar la fase —
// simplemente pone la fase que se le indique. La lógica de "nunca retroceder"
// vive en el frontend (Reportes), que solo llama a esta función cuando la
// nueva fase representa un avance real para ese proyecto.
//
// Variable de entorno requerida en Netlify: NOTION_TOKEN

// En Arcada LEADS el campo de pipeline se llama "Fase" (en EPCON LEADS es "Status").
const STATUS_PROPERTY = 'Fase';

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

  const { pageId, status } = body;
  if (!pageId || !status) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta pageId o status' }) };
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  async function attemptUpdate(statusPropertyShape) {
    const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties: { [STATUS_PROPERTY]: statusPropertyShape } })
    });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  }

  try {
    // "Fase" es tipo "select" en Arcada LEADS. Probamos "select" primero y,
    // por si acaso, reintentamos con "status" si Notion se queja del tipo.
    let result = await attemptUpdate({ select: { name: status } });
    if (!result.ok && result.data && result.data.code === 'validation_error') {
      result = await attemptUpdate({ status: { name: status } });
    }

    if (!result.ok) {
      return { statusCode: result.status, body: JSON.stringify({ error: result.data }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
