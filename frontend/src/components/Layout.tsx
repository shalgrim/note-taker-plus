import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cardsApi } from '../services/api';
import clsx from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/review', label: 'Review', icon: '📥' },
  { path: '/quiz', label: 'Quiz', icon: '🧠' },
  { path: '/sources', label: 'Sources', icon: '📚' },
  { path: '/cards', label: 'Cards', icon: '🗂️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  // Get due cards count for badge
  const { data: dueCards } = useQuery({
    queryKey: ['dueCards'],
    queryFn: () => cardsApi.getDue({ limit: 1 }),
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-white">
                Note Taker+
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors relative',
                    location.pathname === item.path
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  )}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                  {/* Due badge for Quiz */}
                  {item.path === '/quiz' && dueCards && dueCards.total_due > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {dueCards.total_due > 99 ? '99+' : dueCards.total_due}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
