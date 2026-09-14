"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Button from "@/components/ui/Button";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleLogout}
      loading={loading}
      variant="secondary"
      size="sm"
      fullWidth
      className="hover:bg-rose-50 hover:text-rose-700"
    >
      {!loading && <LogOut className="w-3.5 h-3.5" />}
      {loading ? "Logging out..." : "Sign Out"}
    </Button>
  );
}
