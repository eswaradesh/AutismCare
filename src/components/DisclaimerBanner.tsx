import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface DisclaimerBannerProps {
  compact?: boolean;
}

const DisclaimerBanner = ({ compact = false }: DisclaimerBannerProps) => {
  const { t } = useLanguage();

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="line-clamp-1">{t('disclaimer')}</span>
      </div>
    );
  }

  return (
    <div className="disclaimer-banner flex items-start gap-3">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-accent-foreground/70" />
      <p className="text-sm leading-relaxed">{t('disclaimer')}</p>
    </div>
  );
};

export default DisclaimerBanner;
