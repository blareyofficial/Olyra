const gatewayUrl = "https://ai-gateway.kilo.ai/api/v1/chat/completions";
const model = "nvidia/nemotron-3.5-lightning:free";
const maxMessages = 20;
const maxMessageLength = 2000;
const maxConversationLength = 12000;
const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};
const json = (body, status = 200) => Response.json(body, { status, headers });

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (url.pathname === "/api/olyra/request") {
    url.pathname += "/";
    return Response.redirect(url.toString(), 308);
  }

  if (request.method !== "POST") {
    return json({ error: "Use POST to send a message." }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "The request must contain valid JSON." }, 400);
  }

  if (!body || typeof body !== "object" || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > maxMessages) {
    return json({ error: "Send between 1 and 20 messages." }, 400);
  }

  let conversationLength = 0;
  const messages = [];
  for (const message of body.messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > maxMessageLength
    ) {
      return json({ error: "A message is empty or invalid." }, 400);
    }
    conversationLength += message.content.length;
    if (conversationLength > maxConversationLength) {
      return json({ error: "This conversation is too long. Start a new one to continue." }, 413);
    }
    messages.push({ role: message.role, content: message.content });
  }

  try {
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are Olyra AI, a friendly, helpful, calm assistant. Be clear, thoughtful, and concise. Be honest when you are unsure, and do not claim to have taken actions you have not taken."
          },
          ...messages
        ],
        max_tokens: 800
      })
    });

    if (!response.ok) {
      console.error("Olyra AI service returned an error", response.status);
      if (response.status === 429) {
        return json({ error: "Olyra AI is a little busy. Please wait a moment and try again." }, 429);
      }
      return json({ error: "Olyra AI could not reply just now. Please try again shortly." }, 502);
    }

    let result;
    try {
      result = await response.json();
    } catch {
      console.error("Olyra AI service returned an invalid response.");
      return json({ error: "Olyra AI returned an unreadable response. Please try again." }, 502);
    }

    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.error("Olyra AI service response did not contain a reply.");
      return json({ error: "Olyra AI returned an empty response. Please try again." }, 502);
    }

    return json({ reply: reply.trim() });
  } catch (error) {
    console.error("Olyra AI request failed.", error);
    return json({ error: "Olyra AI could not connect just now. Please try again shortly." }, 502);
  }
}
