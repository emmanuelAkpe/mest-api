async function extractUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MEST-Bot/1.0' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
  const html = await res.text();

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? '';
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? '';

  const noScript = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  const noStyle = noScript.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  const noTags = noStyle.replace(/<[^>]+>/g, ' ');
  const bodyText = noTags.replace(/\s{2,}/g, ' ').trim().slice(0, 4000);

  return [title, description, bodyText].filter(Boolean).join('\n\n');
}

module.exports = { extractUrl };
