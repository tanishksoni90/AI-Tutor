import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Lock, CheckCircle, AlertCircle, Loader2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'success';

interface InvitationInfo {
  email: string;
  full_name?: string;
  courses: string[];
  expires_at: string;
}

export function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthenticatedUser } = useAuthStore();
  
  const token = searchParams.get('token');
  
  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      setErrorMessage('No invitation token provided');
      return;
    }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const info = await api.validateInvitation(token!);
      setInvitationInfo(info);
      setPageState('valid');
    } catch (error: any) {
      if (error.status === 410) {
        setPageState('expired');
        setErrorMessage('This invitation has expired. Please contact your administrator for a new invitation.');
      } else {
        setPageState('invalid');
        setErrorMessage('This invitation link is invalid or has already been used.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.acceptInvitation(token!, password);
      setPageState('success');
      
      // Fetch user info and set in store
      const user = await api.getMe();
      setAuthenticatedUser(user);
      
      toast.success('Account activated successfully!');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to set password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired state
  if (pageState === 'invalid' || pageState === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">
                {pageState === 'expired' ? 'Invitation Expired' : 'Invalid Invitation'}
              </CardTitle>
              <CardDescription className="mt-2">
                {errorMessage}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate('/login')} variant="outline">
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <CardTitle className="text-xl">Account Activated!</CardTitle>
              <CardDescription className="mt-2">
                Your account is ready. Redirecting to dashboard...
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Valid invitation - show password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to AI Tutor!</CardTitle>
            <CardDescription>
              Set your password to complete account setup
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitationInfo && (
              <div className="mb-6 p-4 bg-secondary/50 rounded-lg space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Email</span>
                  <p className="font-medium">{invitationInfo.email}</p>
                </div>
                {invitationInfo.full_name && (
                  <div>
                    <span className="text-sm text-muted-foreground">Name</span>
                    <p className="font-medium">{invitationInfo.full_name}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-muted-foreground">Enrolled Courses</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {invitationInfo.courses.map((course, i) => (
                      <Badge key={i} variant="secondary" className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {course}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-xs text-muted-foreground">At least 8 characters</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Activate Account'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
