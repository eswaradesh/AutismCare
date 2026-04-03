import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { registerTherapistProfile } from '@/lib/therapistApi';

const TherapistProfile = () => {
  const navigate = useNavigate();
  const { user, therapistProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    fullName: therapistProfile?.fullName || '',
    qualification: therapistProfile?.qualification || '',
    specialization: therapistProfile?.specialization || '',
    registrationNumber: therapistProfile?.registrationNumber || '',
    clinicName: therapistProfile?.clinicName || '',
    contactEmail: user?.email || '',
  });

  if (!user || !therapistProfile) {
    return null;
  }

  const handleSave = async () => {
    if (!formData.fullName.trim() || !formData.qualification.trim() || !formData.registrationNumber.trim()) {
      toast({
        title: 'Missing Required Fields',
        description: 'Full name, qualification and registration number are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await registerTherapistProfile({
        user_id: user.id,
        full_name: formData.fullName.trim(),
        qualification: formData.qualification.trim(),
        registration_number: formData.registrationNumber.trim(),
        specialization: formData.specialization.trim() || undefined,
        clinic_name: formData.clinicName.trim() || undefined,
        contact_email: formData.contactEmail.trim() || undefined,
      });

      toast({
        title: 'Profile Updated',
        description: 'Therapist profile saved successfully. Please re-login to refresh session profile details.',
      });
      navigate('/therapist/dashboard');
    } catch (error) {
      console.error('Failed to save therapist profile:', error);
      toast({
        title: 'Save Failed',
        description: 'Unable to save therapist profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/therapist/dashboard')}
          className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold font-display">Therapist Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your professional profile</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card-elevated p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Professional Information
          </h2>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Full Name *</label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
              className="input-calm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Qualification *</label>
            <Input
              value={formData.qualification}
              onChange={(e) => setFormData((prev) => ({ ...prev, qualification: e.target.value }))}
              className="input-calm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Specialization</label>
            <Input
              value={formData.specialization}
              onChange={(e) => setFormData((prev) => ({ ...prev, specialization: e.target.value }))}
              className="input-calm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Registration Number *</label>
            <Input
              value={formData.registrationNumber}
              onChange={(e) => setFormData((prev) => ({ ...prev, registrationNumber: e.target.value }))}
              className="input-calm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Clinic / Hospital</label>
            <Input
              value={formData.clinicName}
              onChange={(e) => setFormData((prev) => ({ ...prev, clinicName: e.target.value }))}
              className="input-calm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Contact Email</label>
            <Input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
              className="input-calm"
            />
          </div>

          <Button onClick={handleSave} className="w-full btn-primary-gradient" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>

        <DisclaimerBanner compact />
      </div>
    </div>
  );
};

export default TherapistProfile;
