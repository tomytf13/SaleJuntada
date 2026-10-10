import { initials } from "../utils/gatheringHelpers";

export function ParticipantAvatar({
  name,
  avatarUrl,
  color = "peach",
}: {
  name: string;
  avatarUrl?: string | null;
  color?: string;
}) {
  if (avatarUrl?.startsWith("emoji:")) {
    return (
      <span
        className={`person-avatar avatar-emoji ${color}`}
        aria-label={`Avatar de ${name}`}
      >
        {avatarUrl.slice(6)}
      </span>
    );
  }
  if (avatarUrl) {
    return (
      <span className={`person-avatar avatar-photo ${color}`}>
        <img src={avatarUrl} alt={`Avatar de ${name}`} />
      </span>
    );
  }
  return <span className={`person-avatar ${color}`}>{initials(name)}</span>;
}
