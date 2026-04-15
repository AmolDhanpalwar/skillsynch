import type { FormStatus } from '../../types';
import { STATUS_CONFIG } from '../../types/form';

interface StatusBadgeProps {
  status: FormStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-heading
        border tracking-wide ${cfg.classes}
      `}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 mr-1.5" />
      {cfg.label}
    </span>
  );
}
