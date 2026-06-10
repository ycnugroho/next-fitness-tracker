import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  const { pathname } = request.nextUrl;

  // Jika sudah login dan buka /login, lempar ke dashboard (/home)
  if (session.isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Jika belum login, paksa ke /login untuk semua halaman selain /login dan /register
  if (!session.isLoggedIn && pathname !== "/login" && pathname !== "/register") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};