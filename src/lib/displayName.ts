import { ANONYMOUS_NAME, isHiddenId } from "@/lib/anonymity";

interface DisplayNameInput {
  full_name?: string | null;
  nickname?: string | null;
  email?: string | null;
  profile_id?: string | null;
  id?: string | null;
}

interface DisplayPrefs {
  preferNicknames: boolean;
}

function hidden(person: DisplayNameInput) {
  return isHiddenId(person.profile_id ?? person.id);
}

export function displayName(person: DisplayNameInput, prefs: DisplayPrefs): string {
  if (hidden(person)) return ANONYMOUS_NAME;
  const nickname = person.nickname?.trim();
  const fullName = person.full_name?.trim();
  const email = person.email?.trim();

  if (prefs.preferNicknames && nickname) return nickname;
  return fullName || nickname || email || "Member";
}

export function formalName(person: DisplayNameInput): string {
  if (hidden(person)) return ANONYMOUS_NAME;
  const fullName = person.full_name?.trim();
  const nickname = person.nickname?.trim();
  if (fullName && nickname) return `${fullName} “${nickname}”`;
  return fullName || nickname || person.email?.trim() || "Member";
}
