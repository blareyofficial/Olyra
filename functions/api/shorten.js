export async function onRequestPost(context) {
  try {
    const { url } = await context.request.json();
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
      return Response.json({ error: 'Enter a complete URL beginning with http:// or https://' }, { status: 400 });
    }
    const response = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url.trim())}`);
    const result = await response.json();
    if (result.errorcode) return Response.json({ error: result.errormessage || 'We could not shorten this URL.' }, { status: 422 });
    return Response.json({ shortUrl: result.shorturl });
  } catch {
    return Response.json({ error: 'Unable to shorten that URL right now.' }, { status: 400 });
  }
}
