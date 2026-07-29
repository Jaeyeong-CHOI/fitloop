const STEPS = [
  { no: 1, label: '상품' },
  { no: 2, label: '시안' },
  { no: 3, label: '집행' },
  { no: 4, label: '성과' },
]

interface Props {
  current: number
  maxReached: number
  onSelect: (step: number) => void
}

export default function StepIndicator({ current, maxReached, onSelect }: Props) {
  return (
    <nav aria-label="진행 단계" className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const isActive = step.no === current
        const isDone = step.no < current
        const reachable = step.no <= maxReached
        return (
          <div key={step.no} className="flex items-center">
            {i > 0 && (
              <div
                className={`mx-1 h-px w-3 sm:mx-2 sm:w-8 lg:w-14 ${step.no <= current ? 'bg-brand' : 'bg-line'}`}
              />
            )}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onSelect(step.no)}
              className={`group flex items-center gap-2 rounded-full py-1 pr-1 pl-1 transition-colors ${
                reachable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-brand text-white shadow-[0_0_0_4px_#ffedd5]'
                    : isDone
                      ? 'bg-brand-soft text-brand-deep'
                      : 'border border-line bg-white text-faint'
                }`}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path
                      d="M2.5 6.2 5 8.7l4.5-5.4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  step.no
                )}
              </span>
              <span
                className={`hidden text-sm sm:block ${
                  isActive ? 'font-semibold text-ink' : isDone ? 'text-sub' : 'text-faint'
                }`}
              >
                {step.label}
              </span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
