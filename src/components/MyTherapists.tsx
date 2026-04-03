import React, { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Shield, X, Users, Settings, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  connectParentToTherapist,
  getParentTherapistRelationships,
  getVerifiedTherapistDirectory,
  revokeParentTherapistRelationship,
  updateRelationshipAccess,
} from '@/lib/therapistApi';

interface Therapist {
  id: string;
  user_id: string;
  full_name: string;
  qualification: string;
  specialization: string | null;
  clinic_name: string | null;
  contact_email?: string | null;
  verification_status: string;
  is_connectable?: boolean;
}

interface Relationship {
  id: string;
  parent_id?: string;
  therapist_id: string;
  child_id?: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  access_routines?: boolean;
  access_behaviors?: boolean;
  access_summaries?: boolean;
  access_reports?: boolean;
  access_medications?: boolean;
  therapist?: Therapist;
}

interface EffectiveChildProfile {
  id: string;
  name: string;
}

const MyTherapists = () => {
  const { user, childProfile } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [verifiedTherapists, setVerifiedTherapists] = useState<Therapist[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConsentPanel, setShowConsentPanel] = useState<string | null>(null);

  const getEffectiveChildProfile = useCallback(async (): Promise<EffectiveChildProfile | null> => {
    if (!user) return null;
    if (childProfile?.id) {
      return {
        id: childProfile.id,
        name: childProfile.name,
      };
    }
    return null;
  }, [user, childProfile]);

  const loadData = useCallback(async (showSpinner = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (showSpinner) {
      setRefreshing(true);
    }

    try {
      // Load verified therapists from backend directory and map to connectable Supabase therapist IDs.
      let backendTherapists: Therapist[] = [];
      try {
        const directory = await getVerifiedTherapistDirectory();
        backendTherapists = directory.map((item) => ({
          id: item.id,
          user_id: item.user_id,
          full_name: item.full_name,
          qualification: item.qualification,
          specialization: item.specialization,
          clinic_name: item.clinic_name,
          contact_email: item.contact_email,
          verification_status: item.verification_status,
          is_connectable: true,
        }));
      } catch (directoryError) {
        console.error('Error loading backend therapist directory:', directoryError);
      }

      const therapists = backendTherapists.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setVerifiedTherapists(therapists);
      const therapistByUserId = new Map(therapists.map((therapist) => [therapist.user_id, therapist]));

      const effectiveChildProfile = await getEffectiveChildProfile();
      if (effectiveChildProfile?.id) {
        const rels = await getParentTherapistRelationships(user.id, effectiveChildProfile.id);
        const relationshipsWithProfiles = (rels || []).map((r: any) => ({
          ...r,
          status: r.status as Relationship['status'],
          therapist: therapistByUserId.get(r.therapist_id),
        }));

        setRelationships(relationshipsWithProfiles);
      } else {
        setRelationships([]);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, getEffectiveChildProfile]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();

    const refreshInterval = window.setInterval(() => {
      loadData();
    }, 15000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [user, childProfile, loadData]);

  const handleInvite = async (therapist: Therapist) => {
    if (!user) return;

    const effectiveChildProfile = await getEffectiveChildProfile();
    if (!effectiveChildProfile?.id) {
      toast({
        title: 'Child Profile Required',
        description: 'Please complete child profile onboarding before connecting with therapists.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await connectParentToTherapist({
        parent_id: user.id,
        parent_email: user.email,
        parent_name: user.name,
        child_id: effectiveChildProfile.id,
        child_name: effectiveChildProfile.name,
        therapist_id: therapist.user_id,
      });

      toast({
        title: 'Therapist Connected',
        description: 'You are now connected with this therapist.',
      });
      loadData();
    } catch (err) {
      console.error('Error sending invitation:', err);
      toast({
        title: 'Error',
        description: 'Failed to send invitation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRevoke = async (relationshipId: string) => {
    if (!user) return;

    try {
      await revokeParentTherapistRelationship(relationshipId, user.id);

      toast({
        title: 'Access Revoked',
        description: 'Therapist access has been revoked.',
      });
      loadData();
    } catch (err) {
      console.error('Error revoking access:', err);
      toast({
        title: 'Error',
        description: 'Failed to revoke access.',
        variant: 'destructive',
      });
    }
  };

  const filteredTherapists = verifiedTherapists.filter(t => {
    const query = searchQuery.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(query) ||
      t.qualification.toLowerCase().includes(query) ||
      (t.specialization && t.specialization.toLowerCase().includes(query)) ||
      (t.clinic_name && t.clinic_name.toLowerCase().includes(query))
    );
  });

  const getRelationshipStatus = (therapistId: string) => {
    return relationships.find(r => r.therapist_id === therapistId);
  };

  const activeRelationships = relationships.filter(
    (r) => r.status === 'accepted' && r.therapist?.verification_status === 'verified',
  );

  if (loading) {
    return (
      <div className="card-elevated p-6 text-center">
        <p className="text-muted-foreground">Loading therapists...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search therapists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-calm pl-12"
        />
      </div>

      {/* Active Relationships */}
      {activeRelationships.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-muted-foreground">Active Connections</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="space-y-2">
            {activeRelationships
              .map((rel) => (
                <div key={rel.id} className="card-elevated p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{rel.therapist?.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {rel.therapist?.qualification}
                          {rel.therapist?.specialization && ` • ${rel.therapist.specialization}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowConsentPanel(showConsentPanel === rel.id ? null : rel.id)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(rel.id)}
                        className="text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {showConsentPanel === rel.id && (
                    <ConsentPanel relationshipId={rel.id} relationship={rel} onUpdate={loadData} />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Available Therapists */}
      <div>
        <h3 className="font-semibold mb-3 text-sm text-muted-foreground">
          Find Verified Therapists ({filteredTherapists.length})
        </h3>
        {filteredTherapists.length === 0 ? (
          <div className="card-elevated p-6 text-center">
            <p className="text-muted-foreground">No therapists found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTherapists.map((therapist) => {
              const existingRel = getRelationshipStatus(therapist.user_id);
              const isInvited = existingRel?.status === 'pending';
              const isAccepted = existingRel?.status === 'accepted';
              const isConnectable = therapist.is_connectable !== false;

              return (
                <div key={therapist.id} className="card-elevated p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{therapist.full_name}</p>
                        <Shield className="w-4 h-4 text-success" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {therapist.qualification}
                        {therapist.specialization && ` • ${therapist.specialization}`}
                      </p>
                      {therapist.clinic_name && (
                        <p className="text-xs text-muted-foreground">{therapist.clinic_name}</p>
                      )}
                    </div>
                    <div>
                      {isAccepted ? (
                        <span className="px-2 py-1 rounded-full bg-success/20 text-success text-xs font-medium">
                          Connected
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!isConnectable}
                          onClick={() => handleInvite(therapist)}
                          className="btn-primary-gradient"
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          {isConnectable ? 'Connect' : 'Unavailable'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface ConsentPanelProps {
  relationshipId: string;
  relationship: Relationship;
  onUpdate: () => void;
}

const ConsentPanel = ({ relationshipId, relationship, onUpdate }: ConsentPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accessSettings, setAccessSettings] = useState({
    access_routines: relationship.access_routines ?? true,
    access_behaviors: relationship.access_behaviors ?? true,
    access_summaries: relationship.access_summaries ?? true,
    access_reports: relationship.access_reports ?? true,
    access_medications: relationship.access_medications ?? true,
  });

  const handleUpdate = async () => {
    if (!user) return;

    try {
      await updateRelationshipAccess(relationshipId, accessSettings);
      toast({
        title: 'Access Updated',
        description: 'Therapist access permissions have been updated.',
      });
      onUpdate();
    } catch (err) {
      console.error('Error updating access:', err);
      toast({
        title: 'Error',
        description: 'Failed to update access settings.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <h4 className="font-semibold text-sm">Access Control</h4>
      <div className="space-y-2">
        {[
          { key: 'access_routines', label: 'Routine Logs' },
          { key: 'access_behaviors', label: 'Behavior Notes' },
          { key: 'access_summaries', label: 'Daily Summaries' },
          { key: 'access_reports', label: 'Reports' },
          { key: 'access_medications', label: 'Medications (Read-only)' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <input
              type="checkbox"
              checked={accessSettings[key as keyof typeof accessSettings]}
              onChange={(e) =>
                setAccessSettings({ ...accessSettings, [key]: e.target.checked })
              }
              className="w-4 h-4 rounded"
            />
          </label>
        ))}
      </div>
      <Button onClick={handleUpdate} size="sm" className="w-full">
        Save Changes
      </Button>
    </div>
  );
};

export default MyTherapists;
