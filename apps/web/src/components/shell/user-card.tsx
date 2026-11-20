/** Who is signed in: initials, name and role. */
export function UserCard(props: { name: string; role: string }) {
  const initials =
    props.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?";

  return (
    <div className="flex items-center gap-3 px-1">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-from to-brand-to text-xs font-semibold text-white"
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold break-words">
          <span className="sr-only">Signed in as </span>
          {props.name}
        </p>
        <p className="text-xs text-muted-foreground">{props.role}</p>
      </div>
    </div>
  );
}
