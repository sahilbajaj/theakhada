interface DisplayNameInput {
  full_name?: string | null;
  nickname?: string | null;
  email?: string | null;
}

interface DisplayPrefs {
  preferNicknames: boolean;
}

export function displayName(person: DisplayNameInput, prefs: DisplayPrefs): string {
  const nickname = person.nickname?.trim();
  const fullName = person.full_name?.trim();
  const email = person.email?.trim();

  if (prefs.preferNicknames && nickname) return nickname;
  return fullName || nickname || email || "Member";
}

export function formalName(person: DisplayNameInput): string {
  const fullName = person.full_name?.trim();
  const nickname = person.nickname?.trim();
  if (fullName && nickname) return `${fullName} “${nickname}”`;
  return fullName || nickname || person.email?.trim() || "Member";
}
