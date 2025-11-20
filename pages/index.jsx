import React, { useState } from 'react';
import { Box, Heading, Text, Button, HStack, VStack, Flex, Badge, useColorModeValue, Menu, MenuButton, MenuList, MenuItem, MenuDivider, Avatar, useToast } from '@chakra-ui/react';
import {
  HiChartBar,
  HiPencilAlt,
  HiCloudDownload,
  HiChartPie,
  HiDatabase,
  HiClipboardList,
  HiLogout,
  HiUser,
} from 'react-icons/hi';
import ODataModule from '../components/ODataModule';
import SnowflakeModule from '../components/SnowflakeModule';
import DataCorrectionModule from '../components/DataCorrectionModule';
import QueryLogModule from '../components/QueryLogModule';
import ModeToggle from '../components/ModeToggle';
import { useAuth } from '../contexts/AuthContext';

export default function IndexPage() {
  const [activeModule, setActiveModule] = useState('odata-monitor');
  const [correctionContext, setCorrectionContext] = useState(null);
  const { user, logout } = useAuth();
  const toast = useToast();

  const modules = [
    { id: 'snowflake-sync', name: 'Snowflake Sync', icon: HiCloudDownload, description: 'Comparación de datos' },
    { id: 'data-correction', name: 'Corrección de Datos', icon: HiPencilAlt, description: 'Scripts de inserción/edición', disabled: false },
    { id: 'odata-monitor', name: 'OData Monitor', icon: HiChartBar, description: 'Consultas Dynamics 365' },
    { id: 'query-logs', name: 'Historial de Scripts', icon: HiClipboardList, description: 'Auditoría y rollbacks', disabled: false },
    { id: 'analytics', name: 'Analytics', icon: HiChartPie, description: 'Reportes y métricas', disabled: true },
  ];

  const bgApp = useColorModeValue('gray.50', 'gray.900');
  const bgSidebar = useColorModeValue('white', 'gray.800');
  const borderCol = useColorModeValue('gray.200', 'gray.700');
  const textPrimary = useColorModeValue('gray.800', 'gray.100');
  const textSecondary = useColorModeValue('gray.500', 'gray.400');

  const handleLogout = () => {
    logout();
    toast({
      title: 'Sesión cerrada',
      description: 'Has cerrado sesión correctamente',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <Flex h="100vh" bg={bgApp}>
      {/* Sidebar */}
      <Box w="280px" bg={bgSidebar} borderRightWidth="1px" borderColor={borderCol} shadow="sm">
        <VStack align="stretch" spacing={0} h="full">
          {/* Sidebar Header */}
          <Box p={6} borderBottomWidth="1px" borderColor={borderCol}>
            <HStack spacing={3}>
              <Box p={2.5} bg="gradient.primary" bgGradient="linear(to-br, blue.500, blue.600)" borderRadius="lg" shadow="sm">
                <HiDatabase size={24} color="white" />
              </Box>
              <Box>
                <Heading size="md" fontWeight="bold" color={textPrimary}>
                  Data Monitor
                </Heading>
                <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                  Full Data Sync
                </Text>
              </Box>
            </HStack>
          </Box>

          {/* Navigation Modules */}
          <Box flex={1} overflowY="auto" p={4}>
            <Text fontSize="xs" fontWeight="bold" color={textSecondary} textTransform="uppercase" letterSpacing="wider" mb={3} px={2}>
              Módulos
            </Text>
            <VStack align="stretch" spacing={2}>
              {modules.map((module) => {
                const Icon = module.icon;
                const isActive = activeModule === module.id;
                const isEnabled = !module.disabled;

                const activeBg = useColorModeValue('blue.50', 'blue.900');
                const activeColor = useColorModeValue('blue.700', 'blue.200');
                const hoverBg = useColorModeValue(isActive ? 'blue.100' : 'gray.100', isActive ? 'blue.800' : 'gray.700');
                const iconBg = useColorModeValue(isActive ? 'blue.100' : 'gray.100', isActive ? 'blue.800' : 'gray.600');
                const inactiveColor = useColorModeValue('gray.700', 'gray.300');
                const iconInactiveColor = useColorModeValue('gray.500', 'gray.400');

                return (
                  <Button
                    key={module.id}
                    onClick={() => isEnabled && setActiveModule(module.id)}
                    isDisabled={!isEnabled}
                    justifyContent="flex-start"
                    h="auto"
                    py={3}
                    px={4}
                    bg={isActive ? activeBg : 'transparent'}
                    color={isActive ? activeColor : inactiveColor}
                    borderRadius="lg"
                    _hover={{ bg: isEnabled ? hoverBg : 'transparent' }}
                    transition="all 0.2s"
                    cursor={isEnabled ? 'pointer' : 'not-allowed'}
                    opacity={isEnabled ? 1 : 0.5}
                    position="relative"
                    _before={
                      isActive
                        ? {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            height: '60%',
                            width: '4px',
                            bg: 'blue.500',
                            borderRadius: 'full',
                          }
                        : {}
                    }
                  >
                    <HStack spacing={3} w="full">
                      <Box p={2} bg={iconBg} borderRadius="md">
                        <Icon size={18} color={isActive ? activeColor : iconInactiveColor} />
                      </Box>
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">
                          {module.name}
                        </Text>
                        <Text fontSize="xs" color={textSecondary}>
                          {module.description}
                        </Text>
                      </VStack>
                    </HStack>
                  </Button>
                );
              })}
            </VStack>
          </Box>

          {/* Sidebar Footer */}
          <Box p={4} borderTopWidth="1px" borderColor={borderCol}>
            <HStack spacing={2} fontSize="xs" color="gray.500">
              <Badge colorScheme="green" variant="subtle">v1.0.0</Badge>
              <Text>•</Text>
              <Text>Patagonia</Text>
            </HStack>
          </Box>
        </VStack>
      </Box>

      {/* Main Content */}
      <Box flex={1} overflow="hidden" display="flex" flexDirection="column">
        {/* Header */}
        <Box bg={useColorModeValue('white','gray.800')} borderBottomWidth="1px" borderColor={borderCol} px={6} py={4} shadow="sm">
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={0}>
              <Heading size="md" color={textPrimary} fontWeight="bold">
                {modules.find(m => m.id === activeModule)?.name}
              </Heading>
              <Text color={useColorModeValue('gray.600','gray.300')} fontSize="xs">
                 {activeModule === 'odata-monitor' && 'Dynamics 365 Finance & Operations · PdSalesVSCostProcesseds'}
                 {activeModule === 'snowflake-sync' && 'Comparación BASE vs VISTA · Ledger 400000'}
                 {activeModule === 'data-correction' && 'Generador seguro de INSERT/UPDATE + Rollback'}
                 {activeModule === 'query-logs' && 'Logs ejecutados + Rollback directo'}
              </Text>
            </VStack>
            <HStack spacing={3}>
              <ModeToggle />
              <Menu>
                <MenuButton
                  as={Button}
                  variant="ghost"
                  leftIcon={<Avatar size="xs" name={user?.name} bg="blue.500" />}
                  rightIcon={<HiUser />}
                  size="sm"
                  _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                >
                  {user?.name}
                </MenuButton>
                <MenuList>
                  <MenuItem icon={<HiUser />} isDisabled>
                    {user?.email}
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem icon={<HiLogout />} onClick={handleLogout} color="red.500">
                    Cerrar Sesión
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          </HStack>
        </Box>

        {/* Module Content */}
        <Box flex={1} overflow="auto" p={6}>
          {activeModule === 'odata-monitor' && <ODataModule />}
          {activeModule === 'snowflake-sync' && (
            <SnowflakeModule
              onLaunchCorrection={(salesId) => {
                if (salesId) {
                  setCorrectionContext({ salesId });
                  setActiveModule('data-correction');
                }
              }}
            />
          )}
          {activeModule === 'data-correction' && (
            <DataCorrectionModule
              salesId={correctionContext?.salesId || ''}
              onPersistSalesId={(value) => {
                setCorrectionContext(value ? { salesId: value } : null);
              }}
            />
          )}
          {activeModule === 'query-logs' && <QueryLogModule />}
        </Box>
      </Box>
    </Flex>
  );
}
