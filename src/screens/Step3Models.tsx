import { useState } from 'react'
import {
  MODEL_AXES,
  MODEL_SLOTS,
  filterLibrary,
  modelLabel,
  reconcileModelIds,
  type LibraryModel,
  type ModelSelection,
} from '../lib/models.ts'
import { CREATIVES } from '../lib/creatives.ts'

interface Props {
  selection: ModelSelection
  onChange: (selection: ModelSelection) => void
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onNext: () => void
  apiEnabled: boolean
}

function AttributeChips({ model }: { model: LibraryModel }) {
  return (
    <div className="flex flex-wrap gap-1">
      {[model.age, model.ethnicity, model.skin, model.body].map((value) => (
        <span key={value} className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium text-ink backdrop-blur">
          {value}
        </span>
      ))}
    </div>
  )
}

export default function Step3Models({
  selection,
  onChange,
  selectedIds,
  onSelect,
  onNext,
  apiEnabled,
}: Props) {
  const visible = filterLibrary(selection)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const toggleFilter = (key: keyof ModelSelection, option: string) => {
    const current = selection[key]
    const next =
      key === 'genders'
        ? [option]
        : current.includes(option)
          ? current.filter((value) => value !== option)
          : [...current, option]
    if (!next.length) return

    const nextSelection = { ...selection, [key]: next }
    onChange(nextSelection)
    onSelect(reconcileModelIds(nextSelection, selectedIds))
  }

  const toggleModel = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) onSelect(selectedIds.filter((selectedId) => selectedId !== id))
    } else if (selectedIds.length < MODEL_SLOTS) {
      onSelect([...selectedIds, id])
    }
  }

  return (
    <div className="animate-fade-up mx-auto max-w-3xl pt-8 pb-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">어떤 모델이 입어볼까요?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed break-keep text-sub">
            고객이 공감할 가상 모델을 고르세요. 성별·나이대·피부색·인종·체형으로 거르고,
            최대 {MODEL_SLOTS}명까지 선택하면 포즈 4종과 배경 3종을 조합해 착용샷을 만듭니다.
            광고 카피는 상품에 맞춰 AI가 자동으로 작성합니다.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-mid bg-brand-soft px-3.5 py-1.5 text-xs font-medium text-brand-deep">
          Fliption 가상 모델
        </span>
      </div>

      <div className="space-y-4">
        <section className="rounded-card border border-line bg-white p-6 shadow-soft sm:p-7">
          <h3 className="text-sm font-semibold">모델 필터</h3>
          <div className="mt-4 space-y-4">
            {MODEL_AXES.map((axis) => (
              <div key={axis.key}>
                <p className="mb-2 text-xs font-medium text-faint">{axis.title}</p>
                <div className="flex flex-wrap gap-2">
                  {axis.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleFilter(axis.key, option)}
                      className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        selection[axis.key].includes(option)
                          ? 'bg-ink text-white'
                          : 'border border-line bg-white text-sub hover:border-gray-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-card border border-line bg-white p-6 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">모델 리스트</h3>
            <span className="text-xs font-medium text-sub">{selectedIds.length}/{MODEL_SLOTS}명 선택됨</span>
          </div>
          {!visible.length ? (
            <p className="mt-4 rounded-2xl border border-dashed border-line bg-gray-50/60 px-4 py-8 text-center text-sm text-faint">
              필터에 맞는 모델이 없습니다. 조건을 넓혀보세요.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {visible.map((model) => {
                const selectedIndex = selectedIds.indexOf(model.id)
                const selected = selectedIndex >= 0
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModel(model.id)}
                    aria-pressed={selected}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 text-left transition-all ${
                      selected ? 'border-brand shadow-soft' : 'border-line hover:border-gray-300'
                    }`}
                  >
                    <div className="relative aspect-[3/4] w-full bg-gray-100">
                      {!imageErrors[model.id] ? (
                        <img
                          src={model.img}
                          alt={`${modelLabel(model)} 가상 모델`}
                          loading="lazy"
                          onError={() => setImageErrors((current) => ({ ...current, [model.id]: true }))}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-faint">{model.name}</div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-2 pt-7">
                        <AttributeChips model={model} />
                      </div>
                      {selected && (
                        <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white shadow-soft">
                          {selectedIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-2">
                      <span className="text-xs font-semibold text-ink">{model.name}</span>
                      <span className="text-[10px] text-faint">{model.gender}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed break-keep text-faint">
            모델은 Fliption 가상 인물입니다. 선택한 프로필을 Gemini 생성 프롬프트에 반영하고,
            생성 결과와 함께 캠페인 설정에 저장합니다.
          </p>
        </section>
      </div>

      <div className="mt-8 flex justify-center pb-4">
        <div className="text-center">
          {apiEnabled && <p className="mb-3 text-xs font-medium text-amber-700">Gemini 이미지 {CREATIVES.length}장 생성 비용이 발생합니다.</p>}
          <button
            type="button"
            disabled={!selectedIds.length}
            onClick={onNext}
            className="cursor-pointer rounded-full bg-brand px-10 py-4 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-brand-deep disabled:cursor-default disabled:bg-gray-200 disabled:text-faint disabled:shadow-none"
          >
            {apiEnabled
              ? `Nano Banana로 시안 ${CREATIVES.length}종 생성 →`
              : selectedIds.length === 1
                ? `이 모델로 예시 시안 ${CREATIVES.length}종 보기 →`
                : `이 모델 ${selectedIds.length}명으로 예시 시안 ${CREATIVES.length}종 보기 →`}
          </button>
        </div>
      </div>
    </div>
  )
}
