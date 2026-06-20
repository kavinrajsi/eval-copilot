import { headers } from "next/headers";

// The public origin used to build auth redirect links (password reset, signup
// confirmation). Prefer the explicit NEXT_PUBLIC_SITE_URL so it stays stable
// across local / preview / prod; fall back to the request's forwarded host.
//   local:      NEXT_PUBLIC_SITE_URL=http://localhost:3000
//   production: NEXT_PUBLIC_SITE_URL=https://eval-copilot.vercel.app
export async function getSiteURL() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
