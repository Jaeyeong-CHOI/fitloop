/** 용어 설명 툴팁 — ROAS 같은 전문용어 첫 등장 시 사용 */
export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        tabIndex={0}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-faint transition-colors group-hover:bg-gray-200"
        aria-label="용어 설명"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-xl bg-ink px-3.5 py-2.5 text-left text-[11px] leading-relaxed font-normal tracking-normal text-white normal-case opacity-0 shadow-lift transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
