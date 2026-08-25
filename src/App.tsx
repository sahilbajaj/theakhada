import { Navigate, Route, Routes } from "react-router-dom";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import AcceptInvite from "@/pages/AcceptInvite";
import Dashboard from "@/pages/Dashboard";
import Bookings from "@/pages/Bookings";
import Scores from "@/pages/Scores";
import Attendance from "@/pages/Attendance";
import Tournaments from "@/pages/Tournaments";
import Players from "@/pages/Players";
import PlayerDetail from "@/pages/PlayerDetail";
import Seeding from "@/pages/Seeding";
import Admin from "@/pages/Admin";
import Insights from "@/pages/Insights";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import Landing from "@/pages/Landing";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route element={<AccessGate />}>
        <Route element={<AppShell />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/scores" element={<Scores />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:profileId" element={<PlayerDetail />} />
          <Route path="/seeding" element={<Seeding />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
