import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { requestPasswordReset } from '../../api/auth';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    
    try {
      await requestPasswordReset(data.email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Check Your Email</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          If an account exists with that email, we've sent instructions to reset your password.
        </p>
        <Link to="/login">
          <Button variant="outline">Back to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Forgot Password</h2>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Enter your email address and we'll send you instructions to reset your password.
      </p>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            disabled={loading}
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">{errors.email.message}</p>
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
            {loading ? 'Sending...' : 'Reset Password'}
          </Button>
        </div>
      </form>
    </div>
  );
}