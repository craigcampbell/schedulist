import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { getOrganizationDetails, updateSubscription, uploadLogo } from '../../api/organization';
import { useNavigate } from 'react-router-dom';

// Import UI components
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';

export default function SubscriptionPage() {
  const { user, organizationInfo } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    paidLocationsCount: 1,
    additionalUsersCount: 0,
    subscriptionActive: false
  });
  
  const navigate = useNavigate();

  // Get organization details
  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const data = await getOrganizationDetails();
        setOrganization(data);
        setFormData({
          paidLocationsCount: data.paidLocationsCount || 1,
          additionalUsersCount: data.additionalUsersCount || 0,
          subscriptionActive: data.subscriptionActive || false
        });
      } catch (err) {
        setError('Failed to load organization details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, []);

  // Calculate subscription cost
  const calculateCost = () => {
    const basePrice = 10; // $10 for first location with 5 users
    const additionalLocationPrice = 5; // $5 per additional location (includes 5 users per location)
    const additionalUserPrice = 1; // $1 per additional user
    
    const locationsCount = parseInt(formData.paidLocationsCount) || 0;
    const additionalUsers = parseInt(formData.additionalUsersCount) || 0;
    
    if (locationsCount === 0) return 0;
    
    // First location costs base price, additional locations cost additionalLocationPrice
    const locationsCost = basePrice + (Math.max(0, locationsCount - 1) * additionalLocationPrice);
    const usersCost = additionalUsers * additionalUserPrice;
    
    return locationsCost + usersCost;
  };

  // Calculate included users count
  const calculateIncludedUsers = () => {
    const usersPerLocation = 5;
    const locationsCount = parseInt(formData.paidLocationsCount) || 0;
    return locationsCount * usersPerLocation;
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Handle logo selection
  const handleLogoChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedLogo(e.target.files[0]);
    }
  };

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!selectedLogo) return;
    
    try {
      setError(null);
      setSuccess(null);
      setUploadProgress(0);
      
      const result = await uploadLogo(selectedLogo);
      
      // Update organization with new logo URL
      setOrganization({
        ...organization,
        logoUrl: result.logoUrl
      });
      
      setSuccess('Logo uploaded successfully');
      setSelectedLogo(null);
    } catch (err) {
      setError('Failed to upload logo: ' + (err.response?.data?.message || err.message));
      console.error(err);
    }
  };

  // Handle subscription update
  const handleUpdateSubscription = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      const updatedData = {
        ...formData,
        paidLocationsCount: parseInt(formData.paidLocationsCount),
        additionalUsersCount: parseInt(formData.additionalUsersCount),
        includedUsersCount: calculateIncludedUsers()
      };
      
      const result = await updateSubscription(updatedData);
      
      setOrganization({
        ...organization,
        ...result.subscription
      });
      
      setSuccess('Subscription updated successfully');
    } catch (err) {
      setError('Failed to update subscription: ' + (err.response?.data?.message || err.message));
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-6">Loading subscription details...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Subscription Management</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Organization Details</h2>
        
        <div className="mb-4">
          <p><span className="font-medium">Name:</span> {organization?.name}</p>
          <p><span className="font-medium">Slug:</span> {organization?.slug}</p>
          <p><span className="font-medium">Subdomain:</span> {organization?.slug}.therathere.com</p>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Organization Logo</h3>
          
          {organization?.logoUrl && (
            <div className="mb-4">
              <img 
                src={organization.logoUrl} 
                alt="Organization Logo" 
                className="max-h-32 mb-2 border rounded p-2"
              />
            </div>
          )}
          
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="text-sm"
            />
            
            <Button 
              onClick={handleLogoUpload}
              disabled={!selectedLogo}
              variant="outline"
              size="sm"
            >
              Upload Logo
            </Button>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Subscription Settings</h2>
        
        <div className="mb-6">
          <p className="mb-2"><span className="font-medium">Current Status:</span> {organization?.subscriptionActive ? 'Active' : 'Inactive'}</p>
          <p className="mb-2"><span className="font-medium">Current Tier:</span> {organization?.subscriptionTier || 'None'}</p>
          <p className="mb-4"><span className="font-medium">Monthly Rate:</span> ${organization?.monthlyRate || '0.00'}</p>
          
          <label className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              name="subscriptionActive"
              checked={formData.subscriptionActive}
              onChange={handleChange}
              className="form-checkbox h-5 w-5"
            />
            <span>Subscription Active</span>
          </label>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Locations & Users</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Paid Locations
              </label>
              <Input
                type="number"
                name="paidLocationsCount"
                value={formData.paidLocationsCount}
                onChange={handleChange}
                min="0"
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                Each location includes 5 users
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Additional Users
              </label>
              <Input
                type="number"
                name="additionalUsersCount"
                value={formData.additionalUsersCount}
                onChange={handleChange}
                min="0"
                className="w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                $1 per additional user
              </p>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded mb-4">
            <h4 className="font-medium mb-2">Summary</h4>
            <p><span className="font-medium">Locations:</span> {formData.paidLocationsCount} ({formData.paidLocationsCount > 0 ? `$${10 + (Math.max(0, formData.paidLocationsCount - 1) * 5)}` : '$0'})</p>
            <p><span className="font-medium">Included Users:</span> {calculateIncludedUsers()}</p>
            <p><span className="font-medium">Additional Users:</span> {formData.additionalUsersCount} ({formData.additionalUsersCount > 0 ? `$${formData.additionalUsersCount * 1}` : '$0'})</p>
            <p className="font-medium mt-2">Total Monthly Cost: ${calculateCost().toFixed(2)}</p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4 mt-4">
          <Button
            onClick={() => navigate('/admin/dashboard')}
            variant="outline"
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleUpdateSubscription}
          >
            Update Subscription
          </Button>
        </div>
      </div>
    </div>
  );
}