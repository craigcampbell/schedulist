import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/theme-provider';
import { 
  Sun, 
  Moon, 
  Menu, 
  X, 
  Home, 
  Calendar, 
  Users, 
  UserCircle, 
  LogOut, 
  Settings,
  MapPin
} from 'lucide-react';
import { Button } from '../components/ui/button';

export default function DashboardLayout() {
  const { user, logout, isAdmin, isBCBA, organizationInfo } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div 
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b dark:border-gray-700">
          <div className="flex items-center space-x-2">
            {organizationInfo?.logoUrl ? (
              <img 
                src={organizationInfo.logoUrl} 
                alt="Organization Logo" 
                className="h-8 w-auto"
              />
            ) : (
              <h1 className="text-xl font-bold">TheraThere</h1>
            )}
          </div>
          <button 
            className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
            onClick={closeSidebar}
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-4 py-2 border-b dark:border-gray-700">
          <div className="flex items-center space-x-2 py-3">
            <UserCircle className="h-8 w-8 text-gray-400" />
            <div>
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.roles?.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(', ')}
              </p>
              {organizationInfo && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {organizationInfo.name}
                </p>
              )}
            </div>
          </div>
        </div>

        <nav className="mt-4 px-2 space-y-1">
          {/* Show different navigation based on role */}
          {isAdmin() && (
            <>
              <NavLink 
                to="/admin/dashboard" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Home className="mr-3 h-5 w-5" />
                Dashboard
              </NavLink>
              <NavLink 
                to="/admin/users" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Users className="mr-3 h-5 w-5" />
                Users
              </NavLink>
              <NavLink 
                to="/admin/locations" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <MapPin className="mr-3 h-5 w-5" />
                Locations
              </NavLink>
              <NavLink 
                to="/admin/patients" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Users className="mr-3 h-5 w-5" />
                Patients
              </NavLink>
              <NavLink 
                to="/admin/schedule" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Calendar className="mr-3 h-5 w-5" />
                Schedule
              </NavLink>
              <NavLink 
                to="/admin/subscription" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Settings className="mr-3 h-5 w-5" />
                Subscription
              </NavLink>
            </>
          )}

          {isBCBA() && !isAdmin() && (
            <>
              <NavLink 
                to="/bcba/dashboard" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Home className="mr-3 h-5 w-5" />
                Dashboard
              </NavLink>
              <NavLink 
                to="/bcba/schedule" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Calendar className="mr-3 h-5 w-5" />
                Schedule
              </NavLink>
              <NavLink 
                to="/bcba/patients" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Users className="mr-3 h-5 w-5" />
                Patients
              </NavLink>
              <NavLink 
                to="/bcba/therapists" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Users className="mr-3 h-5 w-5" />
                Therapists
              </NavLink>
            </>
          )}

          {!isAdmin() && !isBCBA() && (
            <>
              <NavLink 
                to="/therapist/schedule" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Calendar className="mr-3 h-5 w-5" />
                Schedule
              </NavLink>
              <NavLink 
                to="/therapist/patients" 
                className={({ isActive }) => 
                  `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`
                }
                onClick={closeSidebar}
              >
                <Users className="mr-3 h-5 w-5" />
                Patients
              </NavLink>
            </>
          )}

          {/* Common navigation */}
          <NavLink 
            to="/profile" 
            className={({ isActive }) => 
              `flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                isActive 
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              }`
            }
            onClick={closeSidebar}
          >
            <Settings className="mr-3 h-5 w-5" />
            Profile
          </NavLink>

          <button 
            onClick={logout}
            className="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex justify-between items-center h-16 px-4">
            <button 
              className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              onClick={toggleSidebar}
            >
              <Menu size={24} />
            </button>
            <div className="flex-1 px-4 md:px-0"></div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}