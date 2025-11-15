// Componente para proteger rutas que requieren autenticación
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, Spinner, Center } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
