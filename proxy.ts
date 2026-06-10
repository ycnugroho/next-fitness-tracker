import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { cookies } from "next/headers";

const PUBLIC_ROUTES = ["/login", "/register", "/api/auth/login", "/api/auth/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // PERUBAHAN: Jika user sudah login tapi nekat buka /login, tendang ke /home
  if (session.isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Jika halaman bukan public dan belum login, tendang ke /login
  if (!isPublic && !session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};