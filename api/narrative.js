module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing OpenAI API key" });
    return;
  }

  const { type = "narrative", location, weather, temperature } = req.body || {};
  if (!location || (type === "narrative" && (!weather || typeof temperature === "undefined"))) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const prompt =
    type === "encouragement"
      ? "Write one short encouragement line (8-16 words). Playful, concise, no emojis. Do not add prefixes or labels."
      : "Return exactly one line in this format:\n" +
        "<City, State>, <Weather>: <one short sentence (12-22 words) about a fun tip or activity>\n" +
        `City: ${location}\n` +
        `Weather: ${weather}\n` +
        `Temperature: ${temperature}F\n` +
        "Tone: playful, concise, no emojis.";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        input: prompt,
      }),
    });

    const rawText = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: rawText });
      return;
    }

    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      res.status(500).json({ error: "Invalid JSON from OpenAI" });
      return;
    }

    const outputText =
      (typeof data.output_text === "string" && data.output_text) ||
      (typeof data.output?.[0]?.content?.[0]?.text === "string" &&
        data.output?.[0]?.content?.[0]?.text) ||
      data.output?.[0]?.content?.[0]?.text?.value ||
      "";

    if (!outputText) {
      res.status(502).json({ error: "No text returned from OpenAI", raw: data });
      return;
    }

    res.status(200).json({ text: outputText });
  } catch (error) {
    res.status(500).json({ error: "OpenAI request failed" });
  }
};
