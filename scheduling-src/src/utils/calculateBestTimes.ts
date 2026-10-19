import { calculateTable } from '/src/utils/calculateTable'

interface Availability {
  date: string
  /** Names of everyone who is available at this date */
  people: string[]
}

export interface BestTime {
  /** Each 15 minute slot in this window, as `HHmm-DDMMYYYY` or `HHmm-d` strings */
  times: string[]
  /** Names of everyone available for the whole window */
  people: string[]
}

/**
 * Finds the windows of time with the most people available. Back-to-back slots
 * on the same day are grouped into one window while the same people are free.
 * @returns Up to `limit` windows, ranked by people available, then length, then earliest first
 */
export const calculateBestTimes = (
  columns: ReturnType<typeof calculateTable>['columns'],
  availabilities: Availability[],
  limit = 3,
): BestTime[] => {
  const peopleAt = new Map(availabilities.map(a => [a.date, a.people]))
  const windows: BestTime[] = []

  for (const column of columns) {
    let current: BestTime | undefined
    for (const cell of column?.cells ?? []) {
      const people = cell ? peopleAt.get(cell.serialized) ?? [] : []
      if (!cell || people.length === 0) {
        current = undefined
      } else if (current && isSamePeople(current.people, people)) {
        current.times.push(cell.serialized)
      } else {
        current = { times: [cell.serialized], people }
        windows.push(current)
      }
    }
  }

  // Sort is stable, so ties stay in calendar order
  return windows
    .sort((a, b) => b.people.length - a.people.length || b.times.length - a.times.length)
    .slice(0, limit)
}

// calculateAvailability lists names in the same order for every slot
const isSamePeople = (a: string[], b: string[]) =>
  a.length === b.length && a.every((name, i) => name === b[i])
