import { isAdmin } from "@/lib/auth";
import { parseAnswerPathname, streamBlob } from "@/lib/store";

/** Streams a private recording to a logged-in admin, passing Range through so seeking works. */
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const pathname = url.searchParams.get("path") ?? "";
  if (!parseAnswerPathname(pathname)) return new Response("Bad path", { status: 400 });

  const result = await streamBlob(pathname, request.headers.get("range"));
  if (!result || !result.stream) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "content-type": result.blob.contentType ?? "video/webm",
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = result.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (url.searchParams.has("download")) {
    headers.set("content-disposition", `attachment; filename="${pathname.split("/").pop()}"`);
  }

  return new Response(result.stream, {
    status: result.headers.get("content-range") ? 206 : 200,
    headers,
  });
}
