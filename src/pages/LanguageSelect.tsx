import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ChevronRight, Heart, User, Stethoscope, Shield } from 'lucide-react';
import { languages, useLanguage, Language } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type UserRole = 'parent' | 'therapist' | null;

const LanguageSelect = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
  };

  const handleRoleSelect = (role: 'parent' | 'therapist') => {
    setSelectedRole(role);
    // Store role in sessionStorage for auth page
    sessionStorage.setItem('selectedRole', role);
  };

  const handleContinue = () => {
    if (!selectedRole) return;
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="pt-12 pb-8 px-6 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-primary/10 flex items-center justify-center">
          <Heart className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">
          {t('appName')}
        </h1>
        <p className="text-muted-foreground">
          Compassionate care support
        </p>
      </div>

      {/* Role Selection */}
      <div className="flex-1 px-4 pb-4">
        <div className="card-elevated p-4 mb-4">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t('selectRole')}</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleRoleSelect('parent')}
              className={cn(
                'p-4 rounded-xl text-left transition-all duration-200 border-2',
                selectedRole === 'parent'
                  ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                  : 'bg-muted/50 hover:bg-muted text-foreground border-transparent'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5" />
                <span className="font-semibold">{t('parent')}</span>
              </div>
              <p className={cn(
                'text-xs',
                selectedRole === 'parent' ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}>
                {t('parentDesc')}
              </p>
            </button>

            <button
              onClick={() => handleRoleSelect('therapist')}
              className={cn(
                'p-4 rounded-xl text-left transition-all duration-200 border-2',
                selectedRole === 'therapist'
                  ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                  : 'bg-muted/50 hover:bg-muted text-foreground border-transparent'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Stethoscope className="w-5 h-5" />
                <span className="font-semibold">{t('therapist')}</span>
              </div>
              <p className={cn(
                'text-xs',
                selectedRole === 'therapist' ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}>
                {t('therapistDesc')}
              </p>
            </button>

            {/* Admin option removed */}
          </div>
        </div>

        {/* Language Selection */}
        <div className="card-elevated p-4">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t('selectLanguage')}</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className={cn(
                  'p-3 rounded-xl text-left transition-all duration-200',
                  language === lang.code
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'bg-muted/50 hover:bg-muted text-foreground'
                )}
              >
                <span className="block text-sm font-medium">{lang.nativeName}</span>
                <span className={cn(
                  'block text-xs mt-0.5',
                  language === lang.code ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}>
                  {lang.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div className="p-6 pt-0">
        <button
          onClick={handleContinue}
          disabled={!selectedRole}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-all',
            selectedRole
              ? 'btn-primary-gradient'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {t('getStarted')}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default LanguageSelect;
