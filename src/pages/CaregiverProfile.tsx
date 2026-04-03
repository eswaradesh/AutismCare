import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import DisclaimerBanner from '@/components/DisclaimerBanner';

type CommunicationLevel = 'verbal' | 'nonVerbal' | 'limited' | 'developing';
type SensoryPreference = 'seeking' | 'avoiding' | 'mixed';

const CaregiverProfile = () => {
  const navigate = useNavigate();
  const { user, childProfile, setChildProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: childProfile?.name || '',
    ageYears: childProfile?.ageYears?.toString() || '',
    ageMonths: childProfile?.ageMonths?.toString() || '0',
    communicationLevel: (childProfile?.communicationLevel || 'developing') as CommunicationLevel,
    sensoryPreference: (childProfile?.sensoryPreference || 'mixed') as SensoryPreference,
    notes: childProfile?.notes || '',
  });

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.ageYears.trim()) {
      toast({
        title: 'Missing Required Fields',
        description: 'Child name and age (years) are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await setChildProfile({
        id: childProfile?.id,
        name: formData.name.trim(),
        ageYears: parseInt(formData.ageYears, 10) || 0,
        ageMonths: parseInt(formData.ageMonths, 10) || 0,
        communicationLevel: formData.communicationLevel,
        sensoryPreference: formData.sensoryPreference,
        notes: formData.notes.trim() || undefined,
      });

      toast({
        title: 'Profile Updated',
        description: 'Caregiver profile and child details saved successfully.',
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to save caregiver profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to save profile. Please try again.';
      toast({
        title: 'Save Failed',
        description: errorMessage,
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
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold font-display">Caregiver Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your child profile details</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card-elevated p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Account
          </h2>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email</label>
            <Input value={user?.email || ''} disabled className="input-calm" />
          </div>
        </div>

        <div className="card-elevated p-5 space-y-4">
          <h2 className="font-semibold">Child Profile</h2>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Child Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="input-calm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Age (Years) *</label>
              <Input
                type="number"
                min="0"
                max="25"
                value={formData.ageYears}
                onChange={(e) => setFormData((prev) => ({ ...prev, ageYears: e.target.value }))}
                className="input-calm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Age (Months)</label>
              <Input
                type="number"
                min="0"
                max="11"
                value={formData.ageMonths}
                onChange={(e) => setFormData((prev) => ({ ...prev, ageMonths: e.target.value }))}
                className="input-calm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Communication Level</label>
            <select
              value={formData.communicationLevel}
              onChange={(e) => setFormData((prev) => ({ ...prev, communicationLevel: e.target.value as CommunicationLevel }))}
              className="w-full input-calm"
            >
              <option value="developing">Developing</option>
              <option value="verbal">Verbal</option>
              <option value="limited">Limited</option>
              <option value="nonVerbal">Non-Verbal</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Sensory Preference</label>
            <select
              value={formData.sensoryPreference}
              onChange={(e) => setFormData((prev) => ({ ...prev, sensoryPreference: e.target.value as SensoryPreference }))}
              className="w-full input-calm"
            >
              <option value="mixed">Mixed</option>
              <option value="seeking">Seeking</option>
              <option value="avoiding">Avoiding</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="input-calm min-h-[110px] resize-none"
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

export default CaregiverProfile;
