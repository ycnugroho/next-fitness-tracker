"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

function BannerContent({
  message,
  style,
}: {
  message: string;
  style: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={`w-full border-b px-4 py-2 text-sm ${style}`}>
      <div className="relative flex items-center justify-center">
        <span className="pr-6 text-center">{message}</span>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss banner"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

const AnnouncementBanner = () => {
  const isEnabled = process.env.NEXT_PUBLIC_BANNER_ENABLED === "true";
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!isEnabled) return null;

  if (pathname === "/") {
    return (
      <BannerContent
        key="home"
        message="👋 Selamat datang di Lifting Log! Catat dan pantau progres latihan kamu di sini."
        style="bg-blue-50 text-blue-800 border-blue-200"
      />
    );
  }

  if (pathname === "/workouts" && searchParams.get("created") === "true") {
    return (
      <BannerContent
        key="workout-created"
        message="✅ Workout berhasil ditambahkan! Terus semangat latihan."
        style="bg-green-50 text-green-800 border-green-200"
      />
    );
  }

  return null;
};

export default AnnouncementBanner;