import React from 'react';
import { Info, AlertCircle, CheckCircle } from 'lucide-react';
import { ConfidenceLevel } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  explanation?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const ConfidenceBadge = ({ level, explanation, showLabel = true, size = 'md' }: ConfidenceBadgeProps) => {
  const config = {
    low: {
      icon: AlertCircle,
      label: 'Low Confidence',
      color: 'bg-warning/15 text-warning border-warning/30',
      iconColor: 'text-warning',
    },
    medium: {
      icon: Info,
      label: 'Medium Confidence',
      color: 'bg-info/15 text-info border-info/30',
      iconColor: 'text-info',
    },
    high: {
      icon: CheckCircle,
      label: 'High Confidence',
      color: 'bg-success/15 text-success border-success/30',
      iconColor: 'text-success',
    },
  };

  const { icon: Icon, label, color, iconColor } = config[level];

  const badge = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        color,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      )}
    >
      <Icon className={cn(iconColor, size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
      {showLabel && <span>{label}</span>}
    </div>
  );

  if (explanation) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{explanation}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
};

export default ConfidenceBadge;
