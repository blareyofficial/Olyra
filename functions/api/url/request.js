export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (url.pathname === "/api/url/request") {
    url.pathname += "/";
    return Response.redirect(url.toString(), 308);
  }

  const target = url.searchParams.get("url");

  if (!target) {
    return new Response(JSON.stringify({
      error: "Missing URL.",
      usage: "/api/url/request/?url=https%3A%2F%2Fexample.com"
    }, null, 2), {
      status: 400,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      }
    });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response(JSON.stringify({
      error: "Invalid URL."
    }, null, 2), {
      status: 400,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      }
    });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new Response(JSON.stringify({
      error: "Only HTTP and HTTPS URLs are supported."
    }, null, 2), {
      status: 400,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      }
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    url: parsed.toString(),
    protocol: parsed.protocol.replace(":", ""),
    hostname: parsed.hostname,
    port: parsed.port || null,
    pathname: parsed.pathname,
    search: parsed.search || null,
    hash: parsed.hash || null
  }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    }
  });
}
