'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
}

function NavLinks({
  isLoggedIn,
  userRole,
  pathname,
  onNavigate,
  handleLogout,
  handleLogin,
  isMenuOpen,
}: {
  isLoggedIn: boolean;
  userRole: string | null;
  pathname: string;
  onNavigate: (href: string, e?: React.MouseEvent) => void;
  handleLogout: () => Promise<void>;
  handleLogin: () => void;
  isMenuOpen: boolean;
}) {
  const searchParams = useSearchParams();
  const isLoadPage = pathname === '/load' && searchParams.get('id');

  const navLinks: NavLink[] = isLoggedIn
    ? [
        ...(userRole === 'admin'
          ? [
              { href: '/indents', label: 'Indents' },
              { href: '/clients', label: 'Clients' },
              { href: '/trucks', label: 'Trucks' },
              { href: '/trips', label: 'Trips' },
              { href: '/profiles', label: 'Profiles' },
            ]
          : []),
        ...(userRole === 'truck_owner' ? [{ href: '/trucks', label: 'Trucks' }] : []),
        { href: '/', label: 'Load Board' },
      ]
    : [];

  return (
    <>
      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-6">
        <ul className="flex gap-6">
          {navLinks.map(link => (
            <li key={link.href}>
              {pathname === link.href ? (
                <span className="text-yellow-300 font-bold text-lg cursor-default">
                  {link.label}
                </span>
              ) : (
                <a
                  href={link.href}
                  className="text-white hover:text-yellow-300 text-lg transition-colors"
                  onClick={(e) => onNavigate(link.href, e)}
                >
                  {link.label}
                </a>
              )}
            </li>
          ))}
        </ul>

        {isLoggedIn ? (
          <Button
            className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:scale-105 hover:shadow-lg transition-all w-full md:w-auto"
            onClick={handleLogout}
          >
            Logout
          </Button>
        ) : isLoadPage ? (
          <a
            href="/"
            className="bg-gradient-to-r from-green-400 to-green-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:scale-105 hover:shadow-lg transition-all w-full md:w-auto flex items-center justify-center"
            onClick={(e) => onNavigate('/', e)}
          >
            Load Board
          </a>
        ) : (
          <Button
            className="bg-gradient-to-r from-green-400 to-green-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:scale-105 hover:shadow-lg transition-all w-full md:w-auto"
            onClick={handleLogin}
          >
            Login
          </Button>
        )}
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div className="md:hidden mt-4 bg-gray-800 bg-opacity-90 p-4 rounded-lg">
          <ul className="flex flex-col gap-4">
            {navLinks.map(link => (
              <li key={link.href}>
                {pathname === link.href ? (
                  <span className="block text-yellow-300 font-bold p-2 cursor-default">
                    {link.label}
                  </span>
                ) : (
                  <a
                    href={link.href}
                    className="block text-white hover:text-yellow-300 p-2"
                    onClick={(e) => onNavigate(link.href, e)}
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
            <li>
              {isLoggedIn ? (
                <Button
                  variant="outline"
                  className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:scale-105 hover:shadow-lg transition-all w-full"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              ) : isLoadPage ? (
                <a
                  href="/"
                  className="block bg-gradient-to-r from-green-400 to-green-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:scale-105 hover:shadow-lg transition-all w-full text-center"
                  onClick={(e) => onNavigate('/', e)}
                >
                  Load Board
                </a>
              ) : (
                <Button
                  variant="outline"
                  className="bg-gradient-to-r from-green-400 to-green-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:scale-105 hover:shadow-lg transition-all w-full"
                  onClick={handleLogin}
                >
                  Login
                </Button>
              )}
            </li>
          </ul>
        </div>
      )}
    </>
  );
}

export default function Navbar() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.role || null);
      } else {
        setIsLoggedIn(false);
        setUserRole(null);
      }
    };
    fetchUserData();
  }, []);

  const handleLogin = () => {
    setIsMenuOpen(false);
    router.push('/login');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserRole(null);
    setIsMenuOpen(false);
    router.push('/');
  };

  const toggleMenu = () => setIsMenuOpen(prev => !prev);

  const onNavigate = (href: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsMenuOpen(false);
    router.push(href);
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg p-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="text-2xl font-bold tracking-wide">Freight 24</div>

        {/* Hamburger for mobile */}
        <div className="md:hidden">
          <button
            onClick={toggleMenu}
            aria-label="Toggle menu"
            className="text-white hover:text-gray-200 transition-colors"
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Wrap dynamic links and buttons in Suspense */}
        <Suspense fallback={<div></div>}>
          <NavLinks
            isLoggedIn={isLoggedIn}
            userRole={userRole}
            pathname={pathname}
            onNavigate={onNavigate}
            handleLogout={handleLogout}
            handleLogin={handleLogin}
            isMenuOpen={isMenuOpen}
          />
        </Suspense>
      </div>
    </nav>
  );
}