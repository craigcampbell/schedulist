import { useAuth } from '../context/auth-context';
import { Link } from 'react-router-dom';
import Button from '../components/ui/button';

export default function SubscriptionRequiredPage() {
  const { organizationInfo, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-600">Subscription Required</h1>
        
        {organizationInfo?.logoUrl && (
          <div className="mb-6 flex justify-center">
            <img 
              src={organizationInfo.logoUrl} 
              alt={organizationInfo.name} 
              className="max-h-16"
            />
          </div>
        )}
        
        <p className="text-xl mb-6">
          {organizationInfo?.name 
            ? `${organizationInfo.name}'s subscription is inactive.` 
            : "Your organization's subscription is inactive."}
        </p>
        
        <div className="mb-8 text-gray-600">
          <p className="mb-4">
            Please contact your administrator to activate the subscription, or sign up for a new account.
          </p>
          
          {isAdmin() && (
            <div className="mt-6 bg-blue-50 p-4 rounded text-left">
              <h3 className="font-medium text-blue-800 mb-2">Administrator Notice</h3>
              <p className="text-blue-700 text-sm mb-2">
                As an administrator, you can activate the subscription for your organization.
              </p>
              <Link to="/admin/subscription">
                <Button className="w-full mt-2">
                  Manage Subscription
                </Button>
              </Link>
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/login">
            <Button variant="outline" className="w-full">
              Return to Login
            </Button>
          </Link>
          
          <Button onClick={logout} variant="outline" className="w-full">
            Logout
          </Button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <p>
            Need help? Contact <a href="mailto:support@therathere.com" className="text-blue-600 hover:underline">support@therathere.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}