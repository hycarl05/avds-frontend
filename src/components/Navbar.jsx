// components/Navbar.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaSignOutAlt, FaLayerGroup, FaChevronDown, FaUsers, FaGlobe } from 'react-icons/fa';
import { MdOutlineSpeed } from 'react-icons/md';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext.jsx';
import plusLogo from '../img/plus-logo.png';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('/peta');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    setActiveTab(location.pathname);
    setIsMobileMenuOpen(false);
  }, [location]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Settings menu items
  const settingsItems = [
    {
      path: '/zones/manage',
      label: 'Manage Regions',
      icon: FaLayerGroup,
      description: 'Configure regions and subregions'
    },
    {
      path: '/users/manage',
      label: 'Manage Users',
      icon: FaUsers,
      description: 'Manage user accounts and permissions'
    },
    {
      path: '/services/manage',
      label: 'Manage Services',
      icon: FaGlobe,
      description: 'Manage services and external links'
    },
  ];

  // Logout handler
  const handleLogout = () => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to log out of your account?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, log out',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await logout();
        navigate('/login', { replace: true });
        Swal.fire({
          title: 'Logged out!',
          text: 'You have been successfully logged out.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  const isAvdsActive = activeTab === '/avds-heat' || activeTab.startsWith('/avds');

  const activeClass = 'bg-yellow-400 text-black shadow-lg';
  const inactiveClass = 'text-black hover:text-black hover:bg-gray-100';
  const navBtnBase = 'group relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200';

  return (
    <>
      <nav className="bg-white border-b border-gray-200 shadow-lg sticky top-0 z-50">
        <div className="w-full px-4 lg:px-6">
          <div className="relative flex items-center h-16">

            {/* Logo/Brand */}
            <div className="flex items-center flex-shrink-0">
              <Link to="/peta" className="flex items-center space-x-2 group">
                <div className="bg-gray-100 p-1.5 rounded-lg group-hover:bg-yellow-400 transition-colors">
                  <img src={plusLogo} alt="Logo" className="w-7 h-7 object-contain" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-base font-bold text-gray-900 group-hover:text-yellow-500 transition-colors">
                    PLUS-CCS
                  </h1>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation - Absolutely centered */}
            <div className="hidden lg:flex items-center space-x-3 absolute left-1/2 -translate-x-1/2">

              {/* AVDS */}
              <Link
                to="/avds-heat"
                className={`${navBtnBase} ${isAvdsActive ? activeClass : inactiveClass}`}
              >
                <MdOutlineSpeed size={17} className="mr-1.5 text-black" />
                <span>AVDS</span>
                {isAvdsActive && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rounded-full"></div>
                )}
              </Link>

            </div>

            {/* Desktop Right Side - User Dropdown */}
            <div className="hidden lg:flex items-center justify-end flex-shrink-0 ml-auto">
              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold text-sm">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className={`font-medium text-gray-800 max-w-[140px] truncate leading-tight ${user.name?.length > 14 ? 'text-xs' : 'text-sm'}`}>
                      {user.name}
                    </span>
                    <FaChevronDown
                      size={11}
                      className={`text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* User Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      {/* Profile info header */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold">
                            {user.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-sm font-semibold text-gray-800 truncate">{user.name}</div>
                            <div className="text-xs text-gray-500 truncate">{user.email}</div>
                          </div>
                        </div>
                      </div>
                      {/* Settings items */}
                      <div className="border-b border-gray-100 pb-1 mb-1">
                        <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Settings</div>
                        {settingsItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Icon size={15} className="mr-3 text-gray-500" />
                              <div>
                                <div className="font-medium">{item.label}</div>
                                <div className="text-xs text-gray-400">{item.description}</div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                      {/* Logout */}
                      <button
                        onClick={() => { setIsUserMenuOpen(false); handleLogout(); }}
                        className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <FaSignOutAlt size={15} className="mr-3 text-red-500" />
                        <div>
                          <div className="font-medium">Logout</div>
                          <div className="text-xs text-gray-400">Sign out of your account</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button
                onClick={toggleMobileMenu}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`lg:hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="bg-white border-t border-gray-200">
            <div className="px-4 py-3 space-y-1">
              {/* Mobile User Info */}
              {user && (
                <div className="flex items-center space-x-3 px-4 py-3 bg-gray-50 rounded-lg mb-2">
                  <div className="w-9 h-9 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                </div>
              )}

              {/* AVDS */}
              <Link
                to="/avds-heat"
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isAvdsActive ? 'bg-yellow-400 text-black' : 'text-black hover:bg-gray-100'
                }`}
              >
                <MdOutlineSpeed size={17} className="mr-3 text-black" />
                AVDS
              </Link>

              {/* Settings Section */}
              <div className="pt-3 border-t border-gray-200">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Settings</div>
                {settingsItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-yellow-400 text-black' : 'text-black hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={16} className="mr-3 text-black" />
                      <div>
                        <div>{item.label}</div>
                        <div className={`text-xs ${isActive ? 'text-gray-700' : 'text-gray-500'}`}>
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Logout */}
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  className="flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left text-black hover:text-red-700 hover:bg-red-100"
                >
                  <FaSignOutAlt size={16} className="mr-3 text-black" />
                  <div>
                    <div>Logout</div>
                    <div className="text-xs text-gray-500">Sign out of your account</div>
                  </div>
                </button>
              </div>

            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}
    </>
  );
};

export default Navbar;
