import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { resetPassword } from '../../api/auth';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Redirect if no token is provided
  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Invalid Reset Link</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          This password reset link is invalid or has expired.
        </p>
        <Link to="/forgot-password">
          <Button>Request a new link</Button>
        </Link>
      </div>
    );
  }

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    
    try {
      await resetPassword(token, data.newPassword);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. This link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Password Reset Successful</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Your password has been reset. You will be redirected to the login page in a few seconds.
        </p>
        <Link to="/login">
          <Button>Login Now</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Reset Password</h2>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Enter your new password below.
      </p>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            New Password
          </label>
          <Input
            id="newPassword"
            type="password"
            disabled={loading}
            {...register('newPassword')}
          />
          {errors.newPassword && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">{errors.newPassword.message}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Confirm Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            disabled={loading}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {error && (
          <div className="p-2 text-sm text-center rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            Back to login
          </Link>
          
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </div>
      </form>
    </div>
  );
}