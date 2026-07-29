export interface ModelSelection {
  genders: string[]
  ages: string[]
  skins: string[]
  ethnicities: string[]
  bodies: string[]
}

export const MODEL_AXES: { key: keyof ModelSelection; title: string; options: string[] }[] = [
  { key: 'genders', title: '성별', options: ['여성', '남성'] },
  { key: 'ages', title: '나이대', options: ['20대', '30대', '40대+'] },
  { key: 'skins', title: '피부색', options: ['밝은 톤', '중간 톤', '어두운 톤'] },
  { key: 'ethnicities', title: '인종', options: ['아시아', '백인', '흑인', '히스패닉'] },
  { key: 'bodies', title: '체형', options: ['슬림', '스탠다드', '플러스사이즈'] },
]

export const DEFAULT_SELECTION: ModelSelection = {
  genders: ['여성'],
  ages: ['20대', '30대', '40대+'],
  skins: ['밝은 톤', '중간 톤', '어두운 톤'],
  ethnicities: ['아시아', '백인', '흑인', '히스패닉'],
  bodies: ['슬림', '스탠다드', '플러스사이즈'],
}

export interface LibraryModel {
  id: string
  name: string
  gender: string
  age: string
  skin: string
  ethnicity: string
  body: string
  img: string
}

export const MODEL_LIBRARY: LibraryModel[] = [
  { id: 'f1', name: 'FL-W01', gender: '여성', age: '20대', skin: '밝은 톤', ethnicity: '아시아', body: '슬림', img: '/models/f1.jpg' },
  { id: 'f2', name: 'FL-W02', gender: '여성', age: '30대', skin: '중간 톤', ethnicity: '아시아', body: '스탠다드', img: '/models/f2.jpg' },
  { id: 'f3', name: 'FL-W03', gender: '여성', age: '30대', skin: '밝은 톤', ethnicity: '아시아', body: '플러스사이즈', img: '/models/f3.jpg' },
  { id: 'f4', name: 'FL-W04', gender: '여성', age: '20대', skin: '중간 톤', ethnicity: '아시아', body: '슬림', img: '/models/f4.jpg' },
  { id: 'f5', name: 'FL-W05', gender: '여성', age: '40대+', skin: '중간 톤', ethnicity: '아시아', body: '스탠다드', img: '/models/f5.jpg' },
  { id: 'm1', name: 'FL-M01', gender: '남성', age: '20대', skin: '어두운 톤', ethnicity: '흑인', body: '스탠다드', img: '/models/m1.jpg' },
  { id: 'm2', name: 'FL-M02', gender: '남성', age: '20대', skin: '중간 톤', ethnicity: '아시아', body: '슬림', img: '/models/m2.jpg' },
  { id: 'm3', name: 'FL-M03', gender: '남성', age: '30대', skin: '밝은 톤', ethnicity: '백인', body: '스탠다드', img: '/models/m3.jpg' },
  { id: 'm4', name: 'FL-M04', gender: '남성', age: '30대', skin: '중간 톤', ethnicity: '히스패닉', body: '플러스사이즈', img: '/models/m4.jpg' },
  { id: 'm5', name: 'FL-M05', gender: '남성', age: '40대+', skin: '밝은 톤', ethnicity: '백인', body: '스탠다드', img: '/models/m5.jpg' },
]

export const MODEL_SLOTS = 4
export const DEFAULT_MODEL_IDS = ['f1', 'f2', 'f3', 'f4']

export function libraryModel(id: string): LibraryModel | undefined {
  return MODEL_LIBRARY.find((model) => model.id === id)
}

export function modelLabel(model: LibraryModel): string {
  return `${model.gender}·${model.age}·${model.ethnicity}·${model.skin}·${model.body}`
}

export function slotLabels(ids: string[]): string[] {
  const picked = ids.map(libraryModel).filter((model): model is LibraryModel => Boolean(model))
  if (!picked.length) return []
  return Array.from({ length: MODEL_SLOTS }, (_, index) => modelLabel(picked[index % picked.length]))
}

export function filterLibrary(selection: ModelSelection): LibraryModel[] {
  return MODEL_LIBRARY.filter(
    (model) =>
      selection.genders.includes(model.gender) &&
      selection.ages.includes(model.age) &&
      selection.skins.includes(model.skin) &&
      selection.ethnicities.includes(model.ethnicity) &&
      selection.bodies.includes(model.body),
  )
}

export function reconcileModelIds(
  selection: ModelSelection,
  selectedIds: string[],
): string[] {
  const eligible = filterLibrary(selection)
  const eligibleIds = new Set(eligible.map((model) => model.id))
  const kept = selectedIds.filter((id) => eligibleIds.has(id))
  return [...new Set([...kept, ...eligible.map((model) => model.id)])].slice(0, MODEL_SLOTS)
}
