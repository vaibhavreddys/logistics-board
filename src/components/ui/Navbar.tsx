'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

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
    router.push('/login');
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserRole(null);
    router.push('/');
    setIsMenuOpen(false);
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navLinks = isLoggedIn
    ? [
        ...(userRole === 'admin'
          ? [
              { href: '/indents', label: 'Indents' },
              { href: '/clients', label: 'Clients' },
              { href: '/trucks', label: 'Trucks' },
            ]
          : []),
        ...(userRole === 'truck_owner' ? [{ href: '/trucks', label: 'Trucks' }] : []),
        { href: '/', label: 'Load Board' },
      ]
    : [];

  return (
    <nav className="bg-white shadow-md p-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="text-xl font-bold">Freight 24</div>
        <div className="md:hidden">
          <button onClick={toggleMenu} aria-label="Toggle menu">
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        <div className={`md:flex items-center gap-4 ${isMenuOpen ? 'block' : 'hidden'} md:block`}>
          <ul className="flex flex-col md:flex-row gap-4 md:gap-6">
            {navLinks.map(link => (
              <li key={link.href}>
                {pathname === link.href ? (
                  <span className="text-blue-600 font-bold cursor-default">
                    {link.label}
                  </span>
                ) : (
                  <a
                    href={link.href}
                    className="text-gray-600 hover:text-blue-600"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(link.href);
                      setIsMenuOpen(false);
                    }}
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          {isLoggedIn ? (
            <Button
              variant="outline"
              className="mt-4 md:mt-0 md:ml-4"
              onClick={handleLogout}
            >
              Logout
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-4 md:mt-0 md:ml-4"
              onClick={handleLogin}
            >
              Login
            </Button>
          )}
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden mt-2">
          <ul className="flex flex-col gap-2">
            {navLinks.map(link => (
              <li key={link.href}>
                {pathname === link.href ? (
                  <span className="block text-blue-600 font-bold p-2 cursor-default">
                    {link.label}
                  </span>
                ) : (
                  <a
                    href={link.href}
                    className="block text-gray-600 hover:text-blue-600 p-2"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(link.href);
                      setIsMenuOpen(false);
                    }}
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
                  className="w-full"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLogin}
                >
                  Login
                </Button>
              )}
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}