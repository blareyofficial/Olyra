export async function onRequest(context) {
  const request = context.request;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await request.json();
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

    if (!rawUrl) {
      return json({
        error: "Enter a complete URL beginning with http:// or https://"
      }, 400);
    }

    let target;
    try {
      target = new URL(rawUrl);
    } catch {
      return json({
        error: "Enter a valid URL beginning with http:// or https://"
      }, 400);
    }

    if (!["http:", "https:"].includes(target.protocol)) {
      return json({
        error: "Only HTTP and HTTPS URLs are supported."
      }, 400);
    }

    if (target.toString().length > 8192) {
      return json({
        error: "That URL is too long to shorten."
      }, 413);
    }

    const response = await fetch(
      "https://is.gd/create.php?format=json&url=" +
      encodeURIComponent(target.toString())
    );

    if (!response.ok) {
      return json({
        error: "The URL shortening service is temporarily unavailable."
      }, 502);
    }

    const result = await response.json();

    if (result.errorcode) {
      return json({
        error: result.errormessage || "We could not shorten this URL."
      }, 422);
    }

    if (!result.shorturl) {
      return json({
        error: "The URL shortening service returned an invalid response."
      }, 502);
    }

    return json({
      shortUrl: result.shorturl
    });
  } catch {
    return json({
      error: "Unable to shorten that URL right now."
    }, 400);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
