export function MemberColorInput({
  defaultValue,
  compact = false,
}: {
  defaultValue: string;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="memberColor"
        className="text-sm font-medium text-foreground-muted"
      >
        สีประจำสมาชิก
      </label>
      <input
        id="memberColor"
        name="memberColor"
        type="color"
        defaultValue={defaultValue.toLowerCase()}
        aria-describedby="member-color-help"
        className={`${compact ? "h-11" : "h-13"} w-full cursor-pointer rounded-control border border-border/70 bg-surface p-1 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-primary-soft`}
      />
      <span id="member-color-help" className="text-xs text-foreground-muted">
        แตะเพื่อเลือกสีที่ชอบได้อย่างอิสระ
      </span>
    </div>
  );
}
