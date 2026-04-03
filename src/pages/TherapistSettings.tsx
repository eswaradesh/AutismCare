import React, { useState, useEffect } from 'react';
import { ChevronLeft, LogOut, Shield, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import TherapistAvailability from '@/components/TherapistAvailability';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { cn } from '@/lib/utils';

const TherapistSettings = () => {
  const navigate = useNavigate();
  const { user, therapistProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'availability' | 'profile'>('availability');

  if (!user || !therapistProfile) {
    return null;
  }

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/');
    }
  };

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/therapist/dashboard')}
          className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-display">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and availability</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-muted/50 rounded-xl">
        {[
          { id: 'availability', label: 'Availability', icon: Settings },
          { id: 'profile', label: 'Profile', icon: Shield },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'availability' && (
        <div className="space-y-4">
          <TherapistAvailability therapistId={user.id} readOnly={false} />
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-4">
          {/* Profile Info */}
          <div className="card-elevated p-5">
            <h2 className="font-semibold mb-4">Profile Information</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Full Name
                </label>
                <p className="text-sm font-medium">{therapistProfile.fullName}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Qualification
                </label>
                <p className="text-sm font-medium">{therapistProfile.qualification}</p>
              </div>
              {therapistProfile.specialization && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Specialization
                  </label>
                  <p className="text-sm font-medium">{therapistProfile.specialization}</p>
                </div>
              )}
              {therapistProfile.clinicName && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Clinic / Hospital
                  </label>
                  <p className="text-sm font-medium">{therapistProfile.clinicName}</p>
                </div>
              )}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-success" />
                  <p className="text-xs font-medium text-success">Verified Therapist</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your profile has been verified and you can accept parent invitations.
                </p>
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="card-elevated p-5">
            <h2 className="font-semibold mb-4">Account</h2>
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-lg bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          <DisclaimerBanner compact />
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default TherapistSettings;
