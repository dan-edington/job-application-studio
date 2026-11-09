import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import { AppError } from '../config.js';

export function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (
      parsed.kind() === 'ipv6' &&
      (parsed as ipaddr.IPv6).isIPv4MappedAddress()
    )
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}
export async function resolvePublicUrl(value: string) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port))
  )
    throw new AppError(
      400,
      'Use a public HTTP or HTTPS job posting URL without credentials or a custom port.',
    );
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new AppError(400, 'Job URLs must point to a public website.');
  return { url, address: addresses[0] };
}

async function fetchPage(value: string, redirects = 0): Promise<string> {
  if (redirects > 4)
    throw new AppError(
      422,
      'The job page redirected too many times. Paste the job description below.',
    );
  const { url, address } = await resolvePublicUrl(value);
  const response = await new Promise<{
    status: number;
    location?: string;
    type: string;
    body: string;
  }>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(
      url,
      {
        // Pin the checked DNS result to the connection, including every redirect.
        family: address.family,
        lookup: (_host, _options, callback) =>
          callback(null, address.address, address.family),
        headers: {
          'User-Agent': 'ApplicationStudio/1.0 (job description reader)',
          Accept: 'text/html,application/json,text/plain',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2_000_000) {
            request.destroy(
              new AppError(
                422,
                'The job page is too large. Paste the description instead.',
              ),
            );
          } else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () =>
          resolve({
            status: res.statusCode || 500,
            location: res.headers.location,
            type: res.headers['content-type'] || '',
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    const deadline = setTimeout(
      () =>
        request.destroy(
          new AppError(
            422,
            'The job page took too long to load. Paste the description instead.',
          ),
        ),
      15000,
    );
    request.on('close', () => clearTimeout(deadline));
    request.on('error', reject);
  });
  if (response.status >= 300 && response.status < 400 && response.location)
    return fetchPage(new URL(response.location, url).href, redirects + 1);
  if (response.status < 200 || response.status >= 300)
    throw new AppError(
      422,
      `The job website returned ${response.status}. Paste the job description below to continue.`,
    );
  if (!/text\/|application\/(json|ld\+json|xhtml\+xml)/i.test(response.type))
    throw new AppError(
      422,
      'This URL is not a readable job page. Paste the description instead.',
    );
  return response.body;
}

export function extractJobText(html: string) {
  const $ = load(html);
  const postings: unknown[] = [];

  function visit(value: unknown) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      if (
        item['@type'] === 'JobPosting' ||
        (Array.isArray(item['@type']) && item['@type'].includes('JobPosting'))
      )
        postings.push(item);
      else if (item['@graph']) visit(item['@graph']);
    }
  }

  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      visit(JSON.parse($(element).text()));
    } catch {
      /* Fall back to visible page text. */
    }
  });
  if (postings.length)
    return load(JSON.stringify(postings))
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 45000);
  $('script, style, nav, footer, header, noscript, svg').remove();
  $('p, li, div, section, h1, h2, h3, br').append('\n');
  const main = $('main').length ? $('main') : $('body');
  return main
    .text()
    .replace(/[\t ]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .slice(0, 45000);
}
export async function readJob(url: string, pastedText: string) {
  if (pastedText.trim()) {
    if (pastedText.trim().length < 100)
      throw new AppError(
        400,
        'Paste the full job description (at least 100 characters).',
      );
    return pastedText.trim();
  }
  if (!url.trim())
    throw new AppError(
      400,
      'Add a job posting URL or paste the full job description.',
    );
  try {
    const text = extractJobText(await fetchPage(url));
    if (text.length < 150)
      throw new AppError(
        422,
        'There is too little readable text on this page. Paste the job description below.',
      );
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      422,
      'Could not read this job page. It may require a login or block automated access. Paste the job description below.',
    );
  }
}
