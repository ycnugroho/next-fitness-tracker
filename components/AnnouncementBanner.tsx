"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

const AnnouncementBanner = () => {
  const isEnabled = process.env.NEXT_PUBLIC_BANNER_ENABLED === "true";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed saat pathname berubah
  useEffect(() => {
    setDismissed(false);
  }, [pathname]);

  if (!isEnabled || dismissed) return null;

  // Banner selamat datang di Home
  if (pathname === "/") {
    return (
      <Banner
        message="👋 Selamat datang di Lifting Log! Catat dan pantau progres latihan kamu di sini."
        style="bg-blue-50 text-blue-800 border-blue-200"
        onDismiss={() => setDismissed(true)}
      />
    );
  }

  // Banner sukses setelah create workout
  if (pathname === "/workouts" && searchParams.get("created") === "true") {
    return (
      <Banner
        message="✅ Workout berhasil ditambahkan! Terus semangat latihan."
        style="bg-green-50 text-green-800 border-green-200"
        onDismiss={() => setDismissed(true)}
      />
    );
  }

  return null;
};

function Banner({
  message,
  style,
  onDismiss,
}: {
  message: string;
  style: string;
  onDismiss: () => void;
}) {
  return (
    <div className={`w-full border-b px-4 py-2 text-sm ${style}`}>
      <div className="relative flex items-center justify-center">
        <span className="pr-6 text-center">{message}</span>
        <button
          onClick={onDismiss}
          className="absolute right-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss banner"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default AnnouncementBanner;