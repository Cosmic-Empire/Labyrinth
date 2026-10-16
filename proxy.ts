import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const authPath = "/auth";
const homePath = "/workspace/notes";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = pathname === authPath || pathname === `${authPath}/callback`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    if (isPublicRoute) return NextResponse.next();
    return NextResponse.redirect(new URL(authPath, request.url));
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  if (pathname === `${authPath}/callback`) return supabaseResponse;

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  if (!isAuthenticated && !isPublicRoute) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = NextResponse.redirect(new URL(authPath, request.url));
    supabaseResponse.headers.getSetCookie().forEach((cookie) => response.headers.append("Set-Cookie", cookie));
    return response;
  }

  if (isAuthenticated && pathname === authPath) {
    const response = NextResponse.redirect(new URL(homePath, request.url));
    supabaseResponse.headers.getSetCookie().forEach((cookie) => response.headers.append("Set-Cookie", cookie));
    return response;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"],
};
