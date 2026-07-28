interface AvatarProps {
  name: string;
  src?: string;
}

export function Avatar({ name, src }: AvatarProps) {
  if (src) return <img src={src} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
      {name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(-2)}
    </span>
  );
}
