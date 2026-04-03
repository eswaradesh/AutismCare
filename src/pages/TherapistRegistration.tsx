import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Upload, FileText, Building, Award, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';
import { registerTherapistAccount } from '@/lib/therapistApi';

const TherapistRegistration = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    qualification: '',
    specialization: '',
    registrationNumber: '',
    clinicName: '',
    contactEmail: '',
  });

  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Document uploads are optional

    setIsLoading(true);

    try {
      // Create therapist account + profile and store backend JWT.
      setUploading(true);
      try {
        await registerTherapistAccount(
          {
            email: formData.email,
            password: formData.password,
            full_name: formData.name,
            qualification: formData.qualification,
            registration_number: formData.registrationNumber,
            specialization: formData.specialization || undefined,
            clinic_name: formData.clinicName || undefined,
            contact_email: formData.contactEmail || formData.email,
          },
          {
            degree_certificate: certificateFile,
            license_document: licenseFile,
          }
        );
      } finally {
        setUploading(false);
      }

      sessionStorage.setItem('userRole', 'therapist');
      sessionStorage.setItem('selectedRole', 'therapist');

      const loginSuccess = await login(formData.email, formData.password);
      if (!loginSuccess) {
        setError('Account created, but automatic sign-in failed. Please sign in from the login page.');
        navigate('/auth');
        return;
      }

      // Redirect to therapist dashboard
      navigate('/therapist/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      const message = err instanceof Error ? err.message : '';
      if (message) {
        setError(message);
      } else {
        setError('Unable to connect to backend API. Please ensure the backend server is running and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-4">
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">{t('back')}</span>
        </button>
      </div>

      {/* Logo */}
      <div className="pt-4 pb-8 px-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-display text-foreground">
          Therapist Registration
        </h1>

        <p className="text-sm text-muted-foreground mt-2">
          Complete verification required for access
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 overflow-y-auto pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="card-elevated p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Basic Information
            </h2>

            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-calm"
                required
              />
              <Input
                type="email"
                placeholder={t('email')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-calm"
                required
              />
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
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('confirmPassword')}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="input-calm"
                required
                minLength={6}
              />
            </div>
          </div>

          {/* Professional Info */}
          <div className="card-elevated p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Professional Information
            </h2>

            <div className="space-y-3">
              <Input
                type="text"
                placeholder={t('qualification')}
                value={formData.qualification}
                onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                className="input-calm"
                required
              />
              <Input
                type="text"
                placeholder={t('specialization')}
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                className="input-calm"
              />
              <Input
                type="text"
                placeholder={t('registrationNumber')}
                value={formData.registrationNumber}
                onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                className="input-calm"
                required
              />
              <Input
                type="text"
                placeholder={t('clinicName')}
                value={formData.clinicName}
                onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                className="input-calm"
              />
              <Input
                type="email"
                placeholder="Contact Email (optional)"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="input-calm"
              />
            </div>
          </div>

          {/* Document Upload */}
          <div className="card-elevated p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Verification Documents
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  {t('uploadCertificate')} *
                </label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    className="input-calm"
                  />
                  {certificateFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {certificateFile.name}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  {t('uploadLicense')} *
                </label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                    className="input-calm"
                  />
                  {licenseFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {licenseFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-destructive text-sm text-center bg-destructive/10 rounded-xl py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading || uploading}
            className="w-full btn-primary-gradient py-6 rounded-2xl font-semibold text-base"
          >
            {isLoading || uploading ? 'Processing...' : 'Submit for Verification'}
          </Button>
        </form>
      </div>

      {/* Disclaimer */}
      <div className="p-6">
        <DisclaimerBanner />
      </div>
    </div>
  );
};

export default TherapistRegistration;
