import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import Bookings from "@/pages/Bookings";
import Scores from "@/pages/Scores";
import Attendance from "@/pages/Attendance";
import Tournaments from "@/pages/Tournaments";
import Players from "@/pages/Players";
import Admin from "@/pages/Admin";
import Insights from "@/pages/Insights";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/scores" element={<Scores />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/players" element={<Players />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
