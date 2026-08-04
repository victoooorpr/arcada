// netlify/functions/submit-gasto.js
//
// Crea un registro en la base de datos "Arcada Gastos" de Notion:
// sube la foto del recibo (Notion Direct File Upload), crea la pagina
// con las propiedades del gasto, y liga el proyecto si fue seleccionado
// en el search bar.
//
// Requiere la variable de entorno NOTION_TOKEN en Netlify (la misma
// integracion que ya usan search-leads.js y attach-pdf-to-notion.js).

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = "2025-09-03";
const GASTOS_DATA_SOURCE_ID = "0475441e-2a70-4572-909f-e72e0b63ad09";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      monto,
      tienda,
      fecha,
      comprador,
      nota,
      proyectoPageId,
      imageBase64,
      mediaType,
      filename,
    } = JSON.parse(event.body || "{}");

    let fileUploadId = null;

    if (imageBase64) {
      const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error("No se pudo iniciar la subida del recibo: " + JSON.stringify(createData));
      }
      fileUploadId = createData.id;

      const buffer = Buffer.from(imageBase64, "base64");
      const blob = new Blob([buffer], { type: mediaType || "image/jpeg" });
      const form = new FormData();
      form.append("file", blob, filename || "recibo.jpg");

      const sendRes = await fetch(
        "https://api.notion.com/v1/file_uploads/" + fileUploadId + "/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            "Notion-Version": NOTION_VERSION,
          },
          body: form,
        }
      );
      if (!sendRes.ok) {
        const sendData = await sendRes.json();
        throw new Error("No se pudo subir el recibo: " + JSON.stringify(sendData));
      }
    }

    const tituloTienda = tienda || "Gasto";
    const tituloFecha = fecha || new Date().toISOString().slice(0, 10);

    const properties = {
      Gasto: {
        title: [{ text: { content: tituloTienda + " - " + tituloFecha } }],
      },
    };

    if (monto !== undefined && monto !== null && monto !== "") {
      properties.Monto = { number: Number(monto) };
    }
    if (tienda) {
      properties.Tienda = { rich_text: [{ text: { content: tienda } }] };
    }
    if (fecha) {
      properties.Fecha = { date: { start: fecha } };
    }
    if (comprador) {
      properties.Comprador = { rich_text: [{ text: { content: comprador } }] };
    }
    if (nota) {
      properties.Nota = { rich_text: [{ text: { content: nota } }] };
    }
    if (proyectoPageId) {
      properties.Proyecto = { relation: [{ id: proyectoPageId }] };
    }
    if (fileUploadId) {
      properties.Recibo = {
        files: [
          {
            type: "file_upload",
            file_upload: { id: fileUploadId },
            name: filename || "recibo.jpg",
          },
        ],
      };
    }

    const pageRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { data_source_id: GASTOS_DATA_SOURCE_ID },
        properties: properties,
      }),
    });

    const pageData = await pageRes.json();
    if (!pageRes.ok) {
      throw new Error("No se pudo crear el registro en Notion: " + JSON.stringify(pageData));
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, pageUrl: pageData.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
