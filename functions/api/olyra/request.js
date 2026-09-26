export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (url.pathname === "/api/olyra/request") {
    url.pathname += "/";
    return Response.redirect(url.toString(), 308);
  }

  const rawQuery = url.search.slice(1);
  const query = rawQuery ? decodeURIComponent(rawQuery) : "";

  if (!query.trim()) {
    return new Response(JSON.stringify({
      error: "Missing query.",
      usage: "/api/olyra/request/?your-question"
    }, null, 2), {
      status: 400,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      }
    });
  }

  if (query.length > 4000) {
    return new Response(JSON.stringify({
      error: "Query is too long. Maximum length is 4000 characters."
    }, null, 2), {
      status: 413,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      }
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    query,
    message: "Olyra API received your request."
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    }
  });
}
