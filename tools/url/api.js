export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);

  const rawUrl = requestUrl.searchParams.get("url");
  const qrcode = requestUrl.searchParams.get("qrcode");

  if (!rawUrl) {
    return json({
      error: "Missing url parameter.",
      usage: "/tools/url/api?url=example.com&qrcode=yes"
    }, 400);
  }

  let target;
  try {
    target = new URL(
      /^https?:\/\//i.test(rawUrl.trim())
        ? rawUrl.trim()
        : "https://" + rawUrl.trim()
    );
  } catch {
    return json({ error: "Invalid URL." }, 400);
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return json({ error: "Only HTTP and HTTPS URLs are supported." }, 400);
  }

  const shortenResponse = await fetch(
    new URL(
      "/api/shorten",
      requestUrl.origin
    ),
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: target.toString()
      })
    }
  );

  const shortened = await shortenResponse.json();

  if (!shortenResponse.ok || !shortened.shortUrl) {
    return json({
      error: shortened.error || "Unable to shorten this URL."
    }, shortenResponse.status || 502);
  }

  const wantsQr =
    qrcode === "yes" ||
    qrcode === "true" ||
    qrcode === "1";

  const response = {
    ok: true,
    url: target.toString(),
    shortUrl: shortened.shortUrl
  };

  if (wantsQr) {
    response.qrCode =
      "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" +
      encodeURIComponent(shortened.shortUrl);
  }

  return json(response, 200);
}

function json(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    }
  });
}
