import { statusLabel, type Status } from '@/lib/content'

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`status status-${status}`}>
      <i aria-hidden="true" />
      {statusLabel[status]}
    </span>
  )
}
