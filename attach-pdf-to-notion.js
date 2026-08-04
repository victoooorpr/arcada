// Netlify Function — sube un PDF y lo adjunta a una página de Notion
// Ruta en tu repo: netlify/functions/attach-pdf-to-notion.js
// Usa la misma variable de entorno NOTION_TOKEN ya configurada en Netlify.
// Requiere Node 18+ (Netlify Functions ya corre en Node 18/20, con FormData/Blob globales).

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

  const { pageId, fileName, pdfBase64 } = body;
  if (!pageId || !pdfBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta pageId o pdfBase64' }) };
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28'
  };

  try {
    // Paso 1: crear el objeto de carga de archivo en Notion
    const createResp = await fetch('https://api.notion.com/v1/file_uploads', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const createData = await createResp.json();
    if (!createResp.ok) {
      return { statusCode: createResp.status, body: JSON.stringify({ error: createData, step: 'create' }) };
    }

    const fileUploadId = createData.id;
    const uploadUrl = createData.upload_url;

    // Paso 2: enviar los bytes del PDF
    const buffer = Buffer.from(pdfBase64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName || 'documento.pdf');

    const sendResp = await fetch(uploadUrl, {
      method: 'POST',
      headers: headers, // OJO: no fijar Content-Type manualmente, FormData pone el boundary correcto
      body: form
    });
    const sendData = await sendResp.json();
    if (!sendResp.ok) {
      return { statusCode: sendResp.status, body: JSON.stringify({ error: sendData, step: 'send' }) };
    }

    // Paso 3: adjuntar el archivo subido como bloque en la página
    const attachResp = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        children: [
          {
            type: 'pdf',
            pdf: {
              type: 'file_upload',
              file_upload: { id: fileUploadId }
            }
          }
        ]
      })
    });
    const attachData = await attachResp.json();
    if (!attachResp.ok) {
      return { statusCode: attachResp.status, body: JSON.stringify({ error: attachData, step: 'attach' }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
