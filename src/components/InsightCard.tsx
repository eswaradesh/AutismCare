import React from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { InsightWithConfidence, RoutineBehaviorCorrelation } from '@/lib/analytics';
import ConfidenceBadge from './ConfidenceBadge';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  insight: InsightWithConfidence;
  className?: string;
}

export const InsightCard = ({ insight, className }: InsightCardProps) => {
  return (
    <div className={cn('card-elevated p-4 space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-medium leading-snug">{insight.insight}</p>
        </div>
        <ConfidenceBadge level={insight.confidence} size="sm" showLabel={false} />
      </div>
      <p className="text-xs text-muted-foreground pl-11">{insight.explanation}</p>
    </div>
  );
};

interface CorrelationCardProps {
  correlation: RoutineBehaviorCorrelation;
  className?: string;
}

export const CorrelationCard = ({ correlation, className }: CorrelationCardProps) => {
  const impactConfig = {
    positive: {
      icon: TrendingDown,
      label: 'Calming effect observed',
      color: 'text-success',
      bg: 'bg-success/10',
    },
    neutral: {
      icon: Minus,
      label: 'No clear pattern',
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
    variable: {
      icon: TrendingUp,
      label: 'Variable effect observed',
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
  };

  const { icon: Icon, label, color, bg } = impactConfig[correlation.behaviorImpact];

  return (
    <div className={cn('card-elevated p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
            <Icon className={cn('w-4 h-4', color)} />
          </div>
          <span className="font-medium capitalize">{correlation.routineType}</span>
        </div>
        <ConfidenceBadge level={correlation.confidence} size="sm" />
      </div>
      <p className="text-sm text-muted-foreground">{correlation.description}</p>
      <p className="text-xs text-muted-foreground mt-2">
        Based on {correlation.dataPointsUsed} data points
      </p>
    </div>
  );
};
