// netlify/functions/extract-receipt.js
//
// Recibe una foto de un recibo (base64) y usa Claude Vision para extraer
// monto, tienda y fecha. El empleado siempre puede corregir estos campos
// antes de guardar, asi que la extraccion no necesita ser perfecta.
//
// Requiere la variable de entorno ANTHROPIC_API_KEY en Netlify.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body || "{}");

    if (!imageBase64) {
      throw new Error("Falta la imagen del recibo");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text:
                  "Lee este recibo de compra y devuelve SOLO un objeto JSON, sin texto adicional y sin markdown, con exactamente estos campos:\n" +
                  '{"monto": <numero total pagado, sin simbolo de moneda, o null si no se distingue con confianza>, "tienda": <nombre de la tienda o proveedor, o null>, "fecha": <fecha de la compra en formato YYYY-MM-DD, o null si no aparece>}\n' +
                  "Si algun dato no se puede leer con confianza, usa null en ese campo en vez de adivinar. No inventes datos.",
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Error de Claude API: ${JSON.stringify(data)}`);
    }

    const textBlock = (data.content || []).find((b) => b.type === "text");
    let parsed = { monto: null, tienda: null, fecha: null };

    if (textBlock && textBlock.text) {
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        monto: parsed.monto ?? null,
        tienda: parsed.tienda ?? null,
        fecha: parsed.fecha ?? null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
