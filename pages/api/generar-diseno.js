export default async function handler(req, res) {
  try {
    const { prompt, macetaName, plantaName } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Falta prompt." });
    }

    const openai = new (require("openai").OpenAI)({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const fullPrompt = `
      Genera un diseño decorativo artístico con fondo transparente (PNG con alpha)
      para colocar sobre una maceta llamada "${macetaName}".
      El usuario pide: "${prompt}".
      No incluyas imágenes de macetas ni plantas, solo el diseño decorativo.
      Estilo elegante, limpio y apto para impresión física.
      Formato final: PNG 1024x1024, fondo transparente.
    `;

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      size: "1024x1024",
      quality: "high",
      response_format: "b64_json",
    });

    const base64 = result.data[0].b64_json;

    return res.status(200).json({
      imageBase64: base64,
    });
  } catch (error) {
    console.error("Error IA:", error);
    return res.status(500).json({ error: "Error generando diseño." });
  }
}
