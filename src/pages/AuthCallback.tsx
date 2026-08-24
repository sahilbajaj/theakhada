import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const { accessStatus, isLoading, refreshAccess, session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  useEffect(() => {
    if (isLoading || accessStatus === "loading") return;
    const next = searchParams.get("next") || "/";
    if (!session) {
      const hasPendingOAuth =
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("error") ||
        searchParams.get("code");
      if (hasPendingOAuth) return;
      navigate("/auth", { replace: true });
      return;
    }
    navigate(accessStatus === "approved" ? next : "/", { replace: true });
  }, [accessStatus, isLoading, navigate, searchParams, session]);

  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Finishing sign in
      </div>
    </main>
  );
}
