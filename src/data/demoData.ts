import type { ClubSnapshot } from "@/types/club";

const today = new Date();

function at(hour: number, minute = 0) {
  const date = new Date(today);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export const demoClubSnapshot: ClubSnapshot = {
  club: {
    id: "club-demo",
    name: "The Akhada Tennis Club",
    city: "Bengaluru",
    timezone: "Asia/Kolkata",
  },
  courts: [
    { id: "court-1", clubId: "club-demo", name: "Court 1", surface: "hard", indoor: false, active: true },
    { id: "court-2", clubId: "club-demo", name: "Court 2", surface: "hard", indoor: false, active: true },
    { id: "court-3", clubId: "club-demo", name: "Clay 1", surface: "clay", indoor: false, active: true },
    { id: "court-4", clubId: "club-demo", name: "Indoor A", surface: "synthetic", indoor: true, active: true },
  ],
  players: [
    { id: "player-1", clubId: "club-demo", fullName: "Maya Kapoor", role: "player", rating: 4.8, seed: 1, status: "active", attendanceRate: 94, wins: 18, losses: 5 },
    { id: "player-2", clubId: "club-demo", fullName: "Ethan Brooks", role: "coach", rating: 5.0, seed: null, status: "active", attendanceRate: 100, wins: 22, losses: 4 },
    { id: "player-3", clubId: "club-demo", fullName: "Sofia Alvarez", role: "player", rating: 4.4, seed: 2, status: "active", attendanceRate: 89, wins: 15, losses: 7 },
    { id: "player-4", clubId: "club-demo", fullName: "Noah Singh", role: "player", rating: 4.2, seed: 3, status: "active", attendanceRate: 82, wins: 13, losses: 8 },
    { id: "player-5", clubId: "club-demo", fullName: "Lena Chen", role: "admin", rating: 4.0, seed: 4, status: "active", attendanceRate: 91, wins: 12, losses: 9 },
    { id: "player-6", clubId: "club-demo", fullName: "Arjun Mehta", role: "player", rating: 3.8, seed: null, status: "visitor", attendanceRate: 64, wins: 8, losses: 8 },
  ],
  bookings: [
    { id: "booking-1", clubId: "club-demo", courtId: "court-1", courtName: "Court 1", startsAt: at(7), endsAt: at(8), status: "completed", players: ["Maya Kapoor", "Sofia Alvarez"], purpose: "practice" },
    { id: "booking-2", clubId: "club-demo", courtId: "court-2", courtName: "Court 2", startsAt: at(9), endsAt: at(10, 30), status: "checked_in", players: ["Ethan Brooks", "Junior Clinic"], purpose: "coaching" },
    { id: "booking-3", clubId: "club-demo", courtId: "court-3", courtName: "Clay 1", startsAt: at(12), endsAt: at(13), status: "confirmed", players: ["Noah Singh", "Arjun Mehta"], purpose: "league" },
    { id: "booking-4", clubId: "club-demo", courtId: "court-4", courtName: "Indoor A", startsAt: at(18), endsAt: at(20), status: "confirmed", players: ["Club Ladder"], purpose: "tournament" },
  ],
  matches: [
    { id: "match-1", clubId: "club-demo", format: "singles", courtName: "Court 2", startsAt: at(9), status: "live", home: ["Maya Kapoor"], away: ["Sofia Alvarez"], sets: [{ home: 6, away: 4 }, { home: 3, away: 2 }] },
    { id: "match-2", clubId: "club-demo", format: "doubles", courtName: "Indoor A", startsAt: at(18), status: "scheduled", home: ["Lena Chen", "Noah Singh"], away: ["Arjun Mehta", "Ethan Brooks"], sets: [] },
    { id: "match-3", clubId: "club-demo", format: "singles", courtName: "Clay 1", startsAt: at(7), status: "final", home: ["Noah Singh"], away: ["Arjun Mehta"], sets: [{ home: 7, away: 6, tieBreak: "7-4" }, { home: 6, away: 2 }] },
  ],
  attendance: [
    { id: "attendance-1", clubId: "club-demo", name: "Junior Clinic", startsAt: at(9), expectedCount: 16, checkedInCount: 14 },
    { id: "attendance-2", clubId: "club-demo", name: "Women Ladder", startsAt: at(17), expectedCount: 12, checkedInCount: 9 },
    { id: "attendance-3", clubId: "club-demo", name: "Evening Social", startsAt: at(19), expectedCount: 28, checkedInCount: 0 },
  ],
  tournaments: [
    { id: "tournament-1", clubId: "club-demo", name: "August Singles Ladder", status: "live", format: "singles", entrants: 24, seeded: 8, startsAt: at(18) },
    { id: "tournament-2", clubId: "club-demo", name: "Fall Doubles Open", status: "registration", format: "doubles", entrants: 14, seeded: 0, startsAt: new Date(today.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString() },
  ],
};
