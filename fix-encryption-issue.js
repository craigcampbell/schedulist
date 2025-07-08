// Fix for patient encryption issue
// Run this in browser console to clear localStorage and force re-authentication

console.log('🔧 Fixing patient encryption issue...');

// Clear the potentially invalid token
localStorage.removeItem('token');
console.log('✅ Cleared authentication token from localStorage');

// Clear any React Query cache
if (window.queryClient) {
  window.queryClient.clear();
  console.log('✅ Cleared React Query cache');
}

// Reload the page to force re-authentication
console.log('🔄 Reloading page to force re-authentication...');
setTimeout(() => {
  window.location.reload();
}, 1000);