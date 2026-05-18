// Vercel serverless function — proxies all requests to the TanStack Start SSR handler.
// The handler is the Web-standard fetch handler emitted by `vite build`.
// @ts-expect-error - built artifact only exists after `vite build`
import server from "../dist/server/index.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Yang diubah: config harus kosong. Jangan ada runtime di sini.
export const config = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers.host || "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const url = new URL(req.url || "/", `${proto}://${host}`);

  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
  });

  const method = req.method || "GET";
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : req.body
        ? typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body)
        : undefined;

  const webRequest = new Request(url.toString(), { method, headers, body });

  try {
    const response = await (server as { fetch: (r: Request, env?: unknown, ctx?: unknown) => Promise<Response> }).fetch(webRequest, {}, {});
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status);
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (error) {
    console.error("SSR Handler Error:", error);
    res.status(500).send("Internal Server Error");
  }
    }
        
