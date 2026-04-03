import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, User, Activity, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';

type CommunicationLevel = 'verbal' | 'nonVerbal' | 'limited' | 'developing';
type SensoryPreference = 'seeking' | 'avoiding' | 'mixed';

const Onboarding = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { setChildProfile, completeOnboarding, childProfile, isOnboarded } = useAuth();

  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Pre-fill with existing child profile if present (prevents duplicate creation)
  const [formData, setFormData] = useState({
    name: childProfile?.name || '',
    ageYears: childProfile?.ageYears?.toString() || '',
    ageMonths: childProfile?.ageMonths?.toString() || '',
    communicationLevel: (childProfile?.communicationLevel as CommunicationLevel) || '' as CommunicationLevel,
    sensoryPreference: (childProfile?.sensoryPreference as SensoryPreference) || '' as SensoryPreference,
    notes: childProfile?.notes || '',
  });

  // If already onboarded, skip this page
  React.useEffect(() => {
    if (isOnboarded && childProfile) {
      navigate('/dashboard', { replace: true });
    }
  }, [isOnboarded, childProfile, navigate]);

  const communicationOptions: { value: CommunicationLevel; labelKey: 'verbal' | 'nonVerbal' | 'limited' | 'developing' }[] = [
    { value: 'verbal', labelKey: 'verbal' },
    { value: 'nonVerbal', labelKey: 'nonVerbal' },
    { value: 'limited', labelKey: 'limited' },
    { value: 'developing', labelKey: 'developing' },
  ];

  const sensoryOptions: { value: SensoryPreference; labelKey: 'seeking' | 'avoiding' | 'moderate' }[] = [
    { value: 'seeking', labelKey: 'seeking' },
    { value: 'avoiding', labelKey: 'avoiding' },
    { value: 'mixed', labelKey: 'moderate' },
  ];

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Save profile and complete onboarding
      try {
        await setChildProfile({
          id: childProfile?.id, // update existing if present
          name: formData.name,
          ageYears: parseInt(formData.ageYears) || 0,
          ageMonths: parseInt(formData.ageMonths) || 0,
          communicationLevel: formData.communicationLevel || 'developing',
          sensoryPreference: formData.sensoryPreference || 'mixed',
          notes: formData.notes,
        });
        await completeOnboarding();
        navigate('/dashboard', { replace: true });
      } catch (error) {
        console.error('Onboarding error:', error);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    if (step === 1) return formData.name && formData.ageYears;
    if (step === 2) return formData.communicationLevel;
    return true;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Progress Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">{t('back')}</span>
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => {
              completeOnboarding();
              navigate('/dashboard');
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('skip')}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                i <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold font-display text-foreground mb-2">
            {t('onboardingTitle')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('onboardingSubtitle')}</p>
        </div>

        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="card-elevated p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-semibold">{t('childName')}</h2>
              </div>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('childName')}
                className="input-calm"
              />
            </div>

            <div className="card-elevated p-5">
              <h2 className="font-semibold mb-4">{t('childAge')}</h2>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1.5 block">
                    {t('years')}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="25"
                    value={formData.ageYears}
                    onChange={(e) => setFormData({ ...formData, ageYears: e.target.value })}
                    className="input-calm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1.5 block">
                    {t('months')}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="11"
                    value={formData.ageMonths}
                    onChange={(e) => setFormData({ ...formData, ageMonths: e.target.value })}
                    className="input-calm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="card-elevated p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Activity className="w-5 h-5 text-secondary-foreground" />
                </div>
                <h2 className="font-semibold">{t('communicationLevel')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {communicationOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFormData({ ...formData, communicationLevel: option.value })}
                    className={cn(
                      'p-3 rounded-xl text-sm font-medium transition-all duration-200',
                      formData.communicationLevel === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-foreground hover:bg-muted'
                    )}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="card-elevated p-5">
              <h2 className="font-semibold mb-4">{t('sensoryPreferences')}</h2>
              <div className="flex gap-2">
                {sensoryOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFormData({ ...formData, sensoryPreference: option.value })}
                    className={cn(
                      'flex-1 p-3 rounded-xl text-sm font-medium transition-all duration-200',
                      formData.sensoryPreference === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-foreground hover:bg-muted'
                    )}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="card-elevated p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-accent-foreground" />
                </div>
                <h2 className="font-semibold">{t('notes')}</h2>
              </div>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('developmentalInfo')}
                className="input-calm min-h-[120px] resize-none"
              />
            </div>

            <DisclaimerBanner />
          </div>
        )}
      </div>

      {/* Continue Button */}
      <div className="p-6 pt-0">
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-300',
            canProceed()
              ? 'btn-primary-gradient'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {step === totalSteps ? t('done') : t('next')}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
