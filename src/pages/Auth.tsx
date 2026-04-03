import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Heart, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';

const Auth = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { login, signup, isOnboarded, userRole } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>(() => {
    // For therapists, default to login mode. For parents, default to signup mode.
    const selectedRole = sessionStorage.getItem('selectedRole');
    return (selectedRole === 'therapist') ? 'login' : 'signup';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Check for selected role from language selection
  const selectedRole = sessionStorage.getItem('selectedRole');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        // Redirect therapist signup to therapist registration page
        if (selectedRole === 'therapist') {
          navigate('/therapist/register');
          setIsLoading(false);
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        const result = await signup(formData.email, formData.password, formData.name);
        if (result.success) {
          if (result.needsVerification) {
            // Redirect to verification page
            navigate('/verify-email');
          } else {
            // Email already verified or verification disabled
            navigate('/onboarding');
          }
        } else {
          // Handle rate limit errors specifically
          if (result.error?.toLowerCase().includes('rate limit') ||
            result.error?.toLowerCase().includes('429') ||
            result.error?.toLowerCase().includes('exceeded')) {
            setError('Too many registration attempts. Please wait 1 hour before trying again.');
          } else {
            setError(result.error || 'Failed to create account');
          }
        }
      } else {
        const success = await login(formData.email, formData.password);
        if (success) {
          // Use resolved context role first; fallback to session storage only if needed.
          const resolvedRole = userRole || (sessionStorage.getItem('userRole') as 'parent' | 'therapist' | null) || 'parent';
          if (resolvedRole === 'therapist') {
            navigate('/therapist/dashboard', { replace: true });
          } else {
            navigate(isOnboarded ? '/dashboard' : '/onboarding', { replace: true });
          }
        } else {
          setError('Invalid email or password');
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">{t('back')}</span>
        </button>
      </div>

      {/* Logo */}
      <div className="pt-4 pb-8 px-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Heart className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-display text-foreground">
          {mode === 'login' ? t('welcomeBack') : t('createAccount')}
        </h1>
      </div>

      {/* Form */}
      <div className="flex-1 px-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('Name').replace("'s", '')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-calm pl-12"
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="email"
              placeholder={t('email')}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-calm pl-12"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('password')}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input-calm pl-12 pr-12"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {mode === 'signup' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('confirmPassword')}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="input-calm pl-12"
                required
                minLength={6}
              />
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm text-center bg-destructive/10 rounded-xl py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary-gradient py-6 rounded-2xl font-semibold text-base"
          >
            {isLoading ? '...' : mode === 'login' ? t('signIn') : t('signUp')}
          </Button>

          {mode === 'login' && (
            <button type="button" className="w-full text-sm text-primary hover:underline">
              {t('forgotPassword')}
            </button>
          )}
        </form>

        {/* Toggle Mode */}
        <div className="mt-8 text-center text-sm">
          <p className="text-muted-foreground">
            {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
            <button
              onClick={() => {
                if (mode === 'login' && selectedRole === 'therapist') {
                  navigate('/therapist/register');
                  return;
                }
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
              }}
              className="text-primary font-semibold hover:underline"
            >
              {mode === 'login' ? t('signUp') : t('signIn')}
            </button>
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-6">
        <DisclaimerBanner />
      </div>
    </div>
  );
};

export default Auth;
