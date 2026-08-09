// Чистое правило «кто может завести тему в этой цели» (M9). Вынесено из маршрута
// /chat/topic, чтобы матрица роль×scope проверялась юнит-тестами, а не только руками.
//
// Раньше проверка группы была `allowed.school || groups.includes(...)` — а `school`
// у любого тренера true (общешкольные темы ему разрешены по матрице ролей). Итог:
// первая половина условия съедала вторую, и тренер мог завести тему В ЛЮБОЙ группе
// школы. Здесь scope'ы разведены: school-флаг открывает только school-темы.
//
// owner — всюду; гейт «своя группа у тренера» ещё жёстче этого правила (targets.groups
// у тренера — все группы его филиалов) и живёт в guardTopicGroup (beforeValidate).

export type TopicTargets = {
  owner: boolean
  school: boolean
  groups: (string | number)[]
  branches: (string | number)[]
}

export type TopicTarget = {
  scope: 'group' | 'branch' | 'school'
  groupId: number | null
  branchId: number | null
}

export const canCreateTopic = (targets: TopicTargets, input: TopicTarget): boolean => {
  if (targets.owner) return true
  if (input.scope === 'school') return targets.school
  if (input.scope === 'branch')
    return input.branchId != null && targets.branches.map(String).includes(String(input.branchId))
  return input.groupId != null && targets.groups.map(String).includes(String(input.groupId))
}
