import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión de Supabase y manda al login a quien no la tiene.
// Es solo comodidad de navegación: qué pedidos se ven lo decide RLS en la base.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Si Supabase no respondió (red), no sabemos si hay sesión: mejor no mandar al login.
  // Tampoco se redirigen POST (server actions): la acción responde su propio error. Lo que se ve lo sigue decidiendo RLS.
  if (isAuthRetryableFetchError(error) || request.method !== "GET") return response;

  const onLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !onLogin) return NextResponse.redirect(new URL("/login", request.url));
  if (user && (onLogin || request.nextUrl.pathname === "/")) return NextResponse.redirect(new URL("/pedidos", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
