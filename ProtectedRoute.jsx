import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasSession } from '../lib/auth';
import FullPageLoader from '../components/ui/FullPageLoader';

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('checking');
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    hasSession()
      .then((ok) => alive && setState(ok ? 'allowed' : 'denied'))
      .catch(() => alive && setState('denied'));
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (state === 'checking') return <FullPageLoader label="Checking your session" />;
  if (state === 'denied') return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return children;
}
