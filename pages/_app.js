import React from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

const theme = extendTheme({
  config: {
    initialColorMode: 'system',
    useSystemColorMode: true,
  },
  styles: {
    global: {
      body: {
        bg: undefined,
      },
    },
  },
  colors: {
    brand: {
      50: '#E6F0FF',
      100: '#BAD6FF',
      200: '#8DBDFF',
      300: '#61A3FF',
      400: '#3489FF',
      500: '#0870FF',
      600: '#0659CC',
      700: '#054399',
      800: '#032C66',
      900: '#021633',
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Páginas públicas que no requieren autenticación
const publicPages = ['/login'];

export default function App({ Component, pageProps, router }) {
  const isPublicPage = publicPages.includes(router.pathname);

  return (
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {isPublicPage ? (
            <Component {...pageProps} />
          ) : (
            <ProtectedRoute>
              <Component {...pageProps} />
            </ProtectedRoute>
          )}
        </AuthProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}
