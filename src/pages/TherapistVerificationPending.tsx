import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Shield, Mail, ArrowLeft, XCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getTherapistProfileStatus } from '@/lib/therapistApi';
import DisclaimerBanner from '@/components/DisclaimerBanner';

const TherapistVerificationPending = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'rejected' | 'suspended'>('pending');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadStatus = async () => {
      try {
        const data = await getTherapistProfileStatus(user.id);
        const status = data.verification_status;
        if (status === 'rejected' || status === 'suspended') {
          setVerificationStatus(status);
          setRejectionReason(data.rejection_reason || null);
        }
      } catch (error) {
        console.error('Failed to load therapist verification status:', error);
      }
    };

    loadStatus();
  }, [user]);

  const getStatusConfig = () => {
    switch (verificationStatus) {
      case 'rejected':
        return {
          icon: <XCircle className="w-10 h-10 text-destructive" />,
          bgColor: 'bg-destructive/10',
          title: 'Verification Rejected',
          description: 'Your registration has been reviewed and could not be approved at this time.',
        };
      case 'suspended':
        return {
          icon: <AlertTriangle className="w-10 h-10 text-warning" />,
          bgColor: 'bg-warning/10',
          title: 'Account Suspended',
          description: 'Your account has been temporarily suspended. Please contact support for more information.',
        };
      default:
        return {
          icon: <Clock className="w-10 h-10 text-warning" />,
          bgColor: 'bg-warning/10',
          title: t('verificationPending'),
          description: 'Your registration has been submitted successfully. Our admin team will review your documents and verify your account.',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="p-4">
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">{t('back')}</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className={`w-20 h-20 mx-auto rounded-3xl ${config.bgColor} flex items-center justify-center`}>
            {config.icon}
          </div>

          <div>
            <h1 className="text-2xl font-bold font-display text-foreground mb-2">
              {config.title}
            </h1>
            <p className="text-muted-foreground">
              {config.description}
            </p>
          </div>

          {/* Rejection Reason */}
          {verificationStatus === 'rejected' && rejectionReason && (
            <div className="card-elevated p-4 border-2 border-destructive/20 text-left">
              <p className="text-xs font-semibold text-destructive mb-1">Reason for Rejection</p>
              <p className="text-sm text-foreground">{rejectionReason}</p>
            </div>
          )}

          <div className="card-elevated p-5 space-y-4">
            {verificationStatus === 'pending' && (
              <>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="font-semibold text-sm mb-1">What happens next?</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Admin will review your qualifications and documents</li>
                      <li>You'll receive an email once verification is complete</li>
                      <li>Only verified therapists can access the platform</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="font-semibold text-sm mb-1">Check your email</p>
                    <p className="text-sm text-muted-foreground">
                      We'll notify you at the email address you provided when your account is verified.
                    </p>
                  </div>
                </div>
              </>
            )}

            {verificationStatus === 'rejected' && (
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold text-sm mb-1">What can I do?</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Review the rejection reason above</li>
                    <li>Ensure your documents are clear and valid</li>
                    <li>Contact support if you believe this is an error</li>
                  </ul>
                </div>
              </div>
            )}

            {verificationStatus === 'suspended' && (
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="font-semibold text-sm mb-1">Account Suspended</p>
                  <p className="text-sm text-muted-foreground">
                    Your access has been temporarily suspended. An admin may re-verify your account after review. Contact support for more details.
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/auth')}
            className="w-full btn-primary-gradient py-4 rounded-2xl font-semibold"
          >
            Return to Sign In
          </button>
        </div>
      </div>

      <div className="p-6">
        <DisclaimerBanner />
      </div>
    </div>
  );
};

export default TherapistVerificationPending;
