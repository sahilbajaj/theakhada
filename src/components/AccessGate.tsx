import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import PendingAccess from "@/pages/PendingAccess";
import { useAuth } from "@/contexts/AuthContext";

export function AccessGate() {
  const { accessStatus, demoMode, isLoading, session } = useAuth();
  const location = useLocation();

  if (demoMode) return <Outlet />;

  if (isLoading || accessStatus === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading access
        </div>
      </div>
    );
  }

  if (!session || accessStatus === "unauthenticated") {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (accessStatus !== "approved") {
    return <PendingAccess />;
  }

  return <Outlet />;
}
