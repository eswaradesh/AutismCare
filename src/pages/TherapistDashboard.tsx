import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { Stethoscope, Users, AlertTriangle, FileText, ChevronRight, LogOut, Shield, Settings } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getTherapistChildren } from '@/lib/therapistApi';
import BottomNav from '@/components/BottomNav';
import DisclaimerBanner from '@/components/DisclaimerBanner';

interface SharedChild {
  id: string;
  child_id: string | null;
  parent_id: string;
  child_name: string;
  parent_name: string;
  status: string;
  last_report_date: string | null;
  routine_count: number;
  behavior_count: number;
  needs_attention: boolean;
}

const TherapistDashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, therapistProfile, logout } = useAuth();
  const [sharedChildren, setSharedChildren] = useState<SharedChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !therapistProfile) return;
    loadSharedChildren();
  }, [user, therapistProfile]);

  const loadSharedChildren = async () => {
    if (!user) return;

    try {
      setLoadError(null);
      const apiChildren = await getTherapistChildren(user.id);
      const mappedChildren: SharedChild[] = apiChildren.map((c) => ({
        id: c.relationship_id,
        child_id: c.child_id || null,
        parent_id: c.parent_id,
        child_name: c.child_name || 'Child',
        parent_name: c.parent_name || 'Parent',
        status: c.status,
        last_report_date: c.last_report_date || null,
        routine_count: c.routine_count || 0,
        behavior_count: c.behavior_count || 0,
        needs_attention: c.needs_attention || false,
      }));
      setSharedChildren(mappedChildren);
    } catch (err) {
      console.error('Error:', err);
      setLoadError('Unable to load therapist data from backend API. Check backend service and API URL configuration.');
      setSharedChildren([]);
    } finally {
      setLoading(false);
    }
  };


  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold font-display text-lg text-foreground">
              Therapist Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Shield className="w-4 h-4 text-success" />
              <p className="text-sm text-success font-medium">{t('verifiedTherapist')}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/therapist/profile')}
            className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-primary/10 transition-colors"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mb-6">
        <DisclaimerBanner compact />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card-elevated p-4 text-center">
          <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{sharedChildren.length}</p>
          <p className="text-xs text-muted-foreground">Children</p>
        </div>
        <div className="card-elevated p-4 text-center">
          <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-warning" />
          <p className="text-2xl font-bold">
            {sharedChildren.filter(c => c.needs_attention).length}
          </p>
          <p className="text-xs text-muted-foreground">Needs Attention</p>
        </div>
        <div className="card-elevated p-4 text-center">
          <FileText className="w-6 h-6 mx-auto mb-2 text-info" />
          <p className="text-2xl font-bold">
            {sharedChildren.reduce((sum, c) => sum + c.routine_count, 0)}
          </p>
          <p className="text-xs text-muted-foreground">Total Reports</p>
        </div>
      </div>

      {/* Shared Children List */}
      <section className="mb-6">
        <h2 className="section-title mb-3">Shared Children</h2>
        {loadError && (
          <div className="card-elevated p-4 mb-3 border border-warning/30 bg-warning/5 text-sm text-warning">
            {loadError}
          </div>
        )}
        {sharedChildren.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-2">No children shared with you yet</p>
            <p className="text-sm text-muted-foreground">
              Parents will invite you to view their child's data
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sharedChildren.map((child) => (
              <Link
                key={child.id}
                to={child.child_id ? `/therapist/child/${child.child_id}` : '#'}
                state={{
                  childName: child.child_name,
                  parentName: child.parent_name,
                  relationshipId: child.id,
                  childId: child.child_id,
                }}
                className="block card-elevated p-4 hover:shadow-lg transition-shadow relative"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{child.child_name}</h3>
                    <p className="text-sm text-muted-foreground">Parent: {child.parent_name}</p>
                  </div>
                  {child.needs_attention && (
                    <div className="px-2 py-1 rounded-full bg-warning/20 text-warning text-xs font-medium">
                      Needs Attention
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{child.routine_count} routines</span>
                  <span>{child.behavior_count} alerts</span>
                  {child.last_report_date && (
                    <span>Last: {format(new Date(child.last_report_date), 'MMM d')}</span>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
};

export default TherapistDashboard;
