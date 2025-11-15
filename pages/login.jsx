import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  useColorModeValue,
  useToast,
  InputGroup,
  InputRightElement,
  IconButton,
  Flex,
  Container,
  Image,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { HiEye, HiEyeOff, HiLockClosed } from 'react-icons/hi';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const toast = useToast();

  // Si ya está autenticado, redirigir a la página principal
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(username, password);
      toast({
        title: 'Bienvenido',
        description: 'Has iniciado sesión correctamente',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      // La redirección se hace automáticamente en el useEffect
    } catch (error) {
      toast({
        title: 'Error de autenticación',
        description: error.message || 'Usuario o contraseña incorrectos',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg={bgColor}>
      <Container maxW="md" py={12}>
        <Box
          bg={cardBg}
          p={8}
          borderRadius="xl"
          boxShadow="2xl"
          border="1px"
          borderColor={borderColor}
        >
          {/* Header con logo/icono */}
          <VStack spacing={6} mb={8}>
            <Flex
              w={16}
              h={16}
              align="center"
              justify="center"
              bg="brand.500"
              borderRadius="xl"
              boxShadow="lg"
            >
              <HiLockClosed size={32} color="white" />
            </Flex>
            
            <VStack spacing={2}>
              <Heading size="xl" textAlign="center">
                Data Sync
              </Heading>
              <Text color="gray.500" textAlign="center">
                Sistema de Monitoreo y Sincronización
              </Text>
            </VStack>
          </VStack>

          {/* Información de acceso */}
          <Alert status="info" mb={6} borderRadius="md">
            <AlertIcon />
            <Box fontSize="sm">
              <Text fontWeight="bold">Acceso:</Text>
              <Text>Ingresa tus credenciales configuradas</Text>
            </Box>
          </Alert>

          {/* Formulario */}
          <form onSubmit={handleSubmit}>
            <VStack spacing={5}>
              <FormControl isRequired>
                <FormLabel>Usuario</FormLabel>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  size="lg"
                  autoComplete="username"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Contraseña</FormLabel>
                <InputGroup size="lg">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    autoComplete="current-password"
                  />
                  <InputRightElement>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={showPassword ? <HiEyeOff /> : <HiEye />}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <Button
                type="submit"
                colorScheme="brand"
                size="lg"
                width="full"
                isLoading={isLoading}
                loadingText="Iniciando sesión..."
                mt={4}
              >
                Iniciar Sesión
              </Button>
            </VStack>
          </form>

          {/* Footer */}
          <Text fontSize="sm" color="gray.500" textAlign="center" mt={8}>
            Patagonia - Dynamics 365 & Snowflake Integration
          </Text>
        </Box>
      </Container>
    </Flex>
  );
}
