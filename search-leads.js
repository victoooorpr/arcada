// Netlify Function — busca clientes en la base de datos "Arcada LEADS" de Notion
// Ruta en tu repo: netlify/functions/search-leads.js
// Variable de entorno requerida en Netlify: NOTION_TOKEN (token de tu integración interna de Notion)
// La integración debe estar compartida ("Connect to") con la base de datos Arcada LEADS.

const DATABASE_ID = '3c54995a-b723-4849-82d8-cccf0984cd95';

exports.handler = async (event) => {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const q = ((event.queryStringParameters && event.queryStringParameters.q) || '').trim();

  if (!NOTION_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'NOTION_TOKEN no está configurado en las variables de entorno de Netlify.' }) };
  }
  if (q.length < 2) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results: [] }) };
  }

  try {
    const resp = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          or: [
            { property: 'Project name', title: { contains: q } },
            // OJO: en Arcada LEADS el campo se llama "Phone" (SIN espacio al final).
            // En EPCON LEADS es "Phone " (con espacio) — no confundir si copias/pegas entre repos.
            { property: 'Phone', phone_number: { contains: q } }
          ]
        },
        page_size: 8
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data }) };
    }

    const results = (data.results || []).map(page => {
      const titleProp = page.properties['Project name'];
      const titleText = ((titleProp && titleProp.title) || []).map(t => t.plain_text).join('') || '';
      // Formato esperado: "[Dirección] — [Nombre]"
      const parts = titleText.split(/\s[-—]\s/);
      const address = (parts[0] || titleText).trim();
      const client = (parts[1] || '').trim();
      const phoneProp = page.properties['Phone'];
      const phone = phoneProp ? (phoneProp.phone_number || '') : '';
      // En Arcada LEADS el pipeline vive en "Fase" (tipo select), no "Status" (tipo status) como en EPCON.
      const faseProp = page.properties['Fase'];
      const fase = faseProp ? ((faseProp.select && faseProp.select.name) || (faseProp.status && faseProp.status.name) || '') : '';
      return { id: page.id, address, client, phone, fase };
    });

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
