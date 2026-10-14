import { Navigate } from 'react-router-dom';
import useAdminRole from '../hooks/useAdminRole';
import FullPageLoader from '../components/ui/FullPageLoader';

// Lets Super Admins through; sends Junior Admins to the Management Portal.
export default function RoleRoute({ children }) {
  const { email, isSuper } = useAdminRole();
  if (email === null) return <FullPageLoader label="Checking your access" />;
  if (!isSuper) return <Navigate to="/admin/portal" replace />;
  return children;
}
