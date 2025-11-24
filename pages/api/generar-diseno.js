export default async function handler(req, res) {
  console.log("🔵 API generar-diseno ejecutada");
  console.log("BODY RECIBIDO:", req.body);

  try {
    const { prompt, macetaName, plantaName } = req.body;

    if (!prompt) {
      console.log("❌ Falta prompt");
      return res.status(400).json({ error: "Falta prompt." });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.log("❌ OPENAI_API_KEY no configurada en Vercel");
      return res.status(500).json({ error: "OPENAI_API_KEY no configurada." });
    }

    const { OpenAI } = require("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const fullPrompt = `
      Genera un diseño artístico decorativo (PNG con fondo transparente)
      para una maceta llamada "${macetaName}".
      El usuario quiere: "${prompt}".
      No generes macetas ni plantas. Solo el diseño.
      Transparente. 1024x1024.
    `;

    console.log("🔵 Enviando a OpenAI...");

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      size: "1024x1024",
      quality: "high",
      response_format: "b64_json",
    });

    console.log("🟢 Respuesta recibida de OpenAI");

    const imageBase64 = result.data[0].b64_json;

    return res.status(200).json({
      ok: true,
      imageBase64,
    });
  } catch (error) {
    console.log("❌ ERROR OPENAI:", error);
    return res.status(500).json({
      error: "Error generando diseño.",
      details: error?.message || error,
    });
  }
}
