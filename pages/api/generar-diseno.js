export default async function handler(req, res) {
  try {
    const { prompt, macetaName, plantaName } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Falta prompt." });
    }

    const openai = new (require("openai").OpenAI)({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Construimos el prompt para OpenAI
    const fullPrompt = `
      Genera un diseño gráfico transparente (PNG con alpha) 
      para decorar una maceta llamada "${macetaName}". 
      El usuario quiere: "${prompt}".  
      El diseño debe ser limpio, elegante y usable en un objeto físico.
      No incluyas imágenes de la maceta ni la planta, solo el diseño.
      Fondo transparente.
      Formato: PNG 1024x1024.
    `;

    const result = await openai.images.generate({
      model: "gpt-image-1", // OpenAI Images 3.5
      prompt: fullPrompt,
      size: "1024x1024",
      quality: "high",
      response_format: "b64_json",
    });

    const imageBase64 = result.data[0].b64_json;

    return res.status(200).json({
      imageBase64,
    });
  } catch (err) {
    console.error("Error en generación IA:", err);
    return res.status(500).json({ error: "Error generando diseño." });
  }
}
