import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const EmailVerification = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Since we use backend JWT auth, email verification is not required.
  // Redirect authenticated users straight to onboarding.
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/onboarding');
    } else {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h1 className="text-xl font-bold font-display">Account Created</h1>
        <p className="text-sm text-muted-foreground">Redirecting you…</p>
      </div>
    </div>
  );
};

export default EmailVerification;
