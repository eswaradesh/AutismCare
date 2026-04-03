import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  clearTherapistAuthToken,
  clearParentAuthToken,
  getTherapistAuthToken,
  getTherapistSession,
  therapistLogin,
  parentLogin,
  parentRegister,
  getParentMe,
  saveChildProfile,
} from '@/lib/therapistApi';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface ChildProfile {
  id?: string;
  name: string;
  ageYears: number;
  ageMonths: number;
  communicationLevel: 'verbal' | 'nonVerbal' | 'limited' | 'developing';
  sensoryPreference: 'seeking' | 'avoiding' | 'mixed';
  notes?: string;
}

interface TherapistProfile {
  id: string;
  fullName: string;
  qualification: string;
  specialization?: string;
  registrationNumber: string;
  clinicName?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'suspended';
}

type UserRole = 'parent' | 'therapist' | null;

interface AuthContextType {
  user: User | null;
  childProfile: ChildProfile | null;
  therapistProfile: TherapistProfile | null;
  userRole: UserRole;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  isEmailVerified: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; needsVerification: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  setChildProfile: (profile: ChildProfile) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [childProfile, setChildProfileState] = useState<ChildProfile | null>(null);
  const [therapistProfile, setTherapistProfile] = useState<TherapistProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Try therapist backend JWT first (only if token exists)
        if (getTherapistAuthToken()) {
          try {
            const therapistSession = await getTherapistSession();
            if (mounted) {
              applyTherapistSession(therapistSession);
              setIsLoading(false);
            }
            return;
          } catch {
            // Token invalid or expired; try parent backend JWT.
            clearTherapistAuthToken();
          }
        }

        // 2. Try parent backend JWT
        const parentSession = await getParentMe();
        if (parentSession && mounted) {
          await applyParentSession(parentSession.user.id, parentSession.user.email, parentSession.user.full_name);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();
    return () => { mounted = false; };
  }, []);

  const applyTherapistSession = (session: Awaited<ReturnType<typeof getTherapistSession>>) => {
    setUser({ id: session.user.id, email: session.user.email, name: session.user.full_name || undefined });
    setUserRole('therapist');
    setIsOnboarded(false);
    setIsEmailVerified(true);
    setChildProfileState(null);
    setTherapistProfile({
      id: session.therapist_profile.id,
      fullName: session.therapist_profile.full_name,
      qualification: session.therapist_profile.qualification,
      specialization: session.therapist_profile.specialization || undefined,
      registrationNumber: session.therapist_profile.registration_number,
      clinicName: session.therapist_profile.clinic_name || undefined,
      verificationStatus: session.therapist_profile.verification_status as TherapistProfile['verificationStatus'],
    });
    sessionStorage.setItem('userRole', 'therapist');
  };

  const applyParentSession = async (id: string, email: string, fullName?: string) => {
    setUser({ id, email, name: fullName || undefined });
    setUserRole('parent');
    setIsEmailVerified(true);
    setTherapistProfile(null);
    sessionStorage.setItem('userRole', 'parent');

    // Load existing child profile and check onboarding status from the backend
    try {
      const { getParentData } = await import('@/lib/therapistApi');
      const data = await getParentData();

      // Restore child profile if it exists in backend
      const cp = data.child_profiles?.[0];
      if (cp) {
        setChildProfileState({
          id: cp.id,
          name: cp.name,
          ageYears: cp.age_years,
          ageMonths: cp.age_months,
          communicationLevel: cp.communication_level as ChildProfile['communicationLevel'],
          sensoryPreference: cp.sensory_preference as ChildProfile['sensoryPreference'],
          notes: cp.notes || undefined,
        });
        setIsOnboarded(true);
      } else {
        // Fallback: check if entries exist (onboarding might have been skipped)
        const hasEntries =
          (data.routine_entries && data.routine_entries.length > 0) ||
          (data.behavior_entries && data.behavior_entries.length > 0);
        if (hasEntries) {
          setIsOnboarded(true);
        }
      }
    } catch (e) {
      // Expected during first login before any data exists, or if backend is offline
      console.warn('Could not load parent data on login:', e instanceof Error ? e.message : e);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const selectedRole = sessionStorage.getItem('selectedRole');

      if (selectedRole === 'therapist') {
        const therapistSession = await therapistLogin(email, password);
        applyTherapistSession(therapistSession);
        return true;
      }

      // Parent login via backend API
      const parentSession = await parentLogin(email, password);
      await applyParentSession(parentSession.user.id, parentSession.user.email, parentSession.user.full_name);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      return false;
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<{ success: boolean; needsVerification: boolean; error?: string; user?: User }> => {
    try {
      const session = await parentRegister(email, password, name);
      await applyParentSession(session.user.id, session.user.email, session.user.full_name);
      return { success: true, needsVerification: false, user: { id: session.user.id, email: session.user.email, name } };
    } catch (error: any) {
      console.error('Signup error:', error);
      return { success: false, needsVerification: false, error: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      clearTherapistAuthToken();
      clearParentAuthToken();
      setUser(null);
      setChildProfileState(null);
      setTherapistProfile(null);
      setUserRole(null);
      setIsOnboarded(false);
      setIsEmailVerified(false);
      sessionStorage.removeItem('userRole');
      sessionStorage.removeItem('selectedRole');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const setChildProfile = async (profile: ChildProfile) => {
    if (!user) return;

    try {
      const normalizeCommunicationLevel = (value: string | undefined): string => {
        const normalized = (value || '').trim().toLowerCase();
        if (normalized === 'verbal') return 'verbal';
        if (normalized === 'nonverbal' || normalized === 'non-verbal') return 'nonVerbal';
        if (normalized === 'limited') return 'limited';
        return 'developing';
      };

      const normalizeSensoryPreference = (value: string | undefined): string => {
        const normalized = (value || '').trim().toLowerCase();
        if (normalized === 'seeking') return 'seeking';
        if (normalized === 'avoiding') return 'avoiding';
        return 'mixed';
      };

      const communicationLevel = normalizeCommunicationLevel(profile.communicationLevel);
      const sensoryPreference = normalizeSensoryPreference(profile.sensoryPreference);

      // Save via the backend API (no RLS, no Supabase)
      const result = await saveChildProfile({
        user_id: user.id,
        name: profile.name,
        age_years: profile.ageYears,
        age_months: profile.ageMonths,
        communication_level: communicationLevel,
        sensory_preference: sensoryPreference,
        notes: profile.notes,
      });

      if (!result.ok) throw new Error('Failed to save child profile');

      const updatedProfile: ChildProfile = {
        ...profile,
        id: result.id,
        communicationLevel: communicationLevel as ChildProfile['communicationLevel'],
        sensoryPreference: sensoryPreference as ChildProfile['sensoryPreference'],
      };
      setChildProfileState(updatedProfile);
      setIsOnboarded(true);
    } catch (error) {
      console.error('Error saving child profile:', error);
      throw error;
    }
  };

  const completeOnboarding = async () => {
    setIsOnboarded(true);
  };

  // Email verification is no longer required with the backend-only auth
  const resendVerificationEmail = async (_email: string): Promise<{ success: boolean; error?: string }> => {
    return { success: true }; // No-op: backend auth doesn't need email verification
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        childProfile,
        therapistProfile,
        userRole,
        isAuthenticated: !!user,
        isOnboarded,
        isLoading,
        isEmailVerified,
        login,
        signup,
        logout,
        setChildProfile,
        completeOnboarding,
        resendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
