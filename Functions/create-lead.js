// Netlify Function — crea un lead nuevo en la base de datos "Arcada LEADS" de Notion
// Ruta en tu repo: netlify/functions/create-lead.js
// Se usa cuando el inspector encuentra a alguien en campo (ej. un vecino) que
// todavía no está en Notion. Se crea con Fase = "Arcada Inspection" porque,
// por definición, si se está usando esta función es porque ya hubo una
// inspección en el momento.
//
// Variable de entorno requerida en Netlify: NOTION_TOKEN
// Requiere que la integración tenga activada la capacidad "Insert content".

const DATABASE_ID = '3c54995a-b723-4849-82d8-cccf0984cd95';

// En Arcada LEADS el campo de pipeline se llama "Fase" (en EPCON LEADS es "Status").
const STATUS_PROPERTY = 'Fase';
const INITIAL_STATUS = 'Arcada Inspection';

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

  const address = (body.address || '').trim();
  const client = (body.client || '').trim();
  const phone = (body.phone || '').trim();

  if (!address || !client) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta address o client' }) };
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  const today = new Date().toISOString().slice(0, 10);

  const baseProperties = {
    // OJO: en Arcada LEADS el campo se llama "Phone" (SIN espacio al final).
    // En EPCON LEADS es "Phone " (con espacio) — no confundir si copias/pegas entre repos.
    'Project name': { title: [{ text: { content: `${address} — ${client}` } }] },
    'Phone': { phone_number: phone || null },
    'Fecha de Lead': { date: { start: today } }
  };

  async function attemptCreate(statusPropertyShape) {
    const properties = { ...baseProperties };
    if (statusPropertyShape) properties[STATUS_PROPERTY] = statusPropertyShape;
    const resp = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify({ parent: { database_id: DATABASE_ID }, properties })
    });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  }

  try {
    // "Fase" en Arcada LEADS es tipo "select". Probamos "select" primero y,
    // por si acaso, reintentamos con "status" si Notion se queja del tipo.
    let result = await attemptCreate({ select: { name: INITIAL_STATUS } });
    if (!result.ok && result.data && result.data.code === 'validation_error') {
      result = await attemptCreate({ status: { name: INITIAL_STATUS } });
    }

    if (!result.ok) {
      return { statusCode: result.status, body: JSON.stringify({ error: result.data }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, id: result.data.id, status: INITIAL_STATUS })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
