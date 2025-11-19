import React, { useState } from 'react';
import { Box, Heading, Text, Button, HStack, VStack, Flex, Badge, useColorModeValue, IconButton, Menu, MenuButton, MenuList, MenuItem, MenuDivider, Avatar, useToast } from '@chakra-ui/react';
import {
  HiChartBar,
  HiPencilAlt,
  HiCloudDownload,
  HiChartPie,
  HiDatabase,
  HiClipboardList,
  HiLogout,
  HiUser,
  HiDownload,
} from 'react-icons/hi';
import ODataModule from '../components/ODataModule';
import SnowflakeModule from '../components/SnowflakeModule';
import DataCorrectionModule from '../components/DataCorrectionModule';
import QueryLogModule from '../components/QueryLogModule';
import LineDownloadModule from '../components/LineDownloadModule';
import ModeToggle from '../components/ModeToggle';
import { useAuth } from '../contexts/AuthContext';

export default function IndexPage() {
  const [activeModule, setActiveModule] = useState('odata-monitor');
  const [correctionContext, setCorrectionContext] = useState(null);
  const { user, logout } = useAuth();
  const toast = useToast();

  const modules = [
    {
      id: 'snowflake-sync',
      name: 'Snowflake Sync',
      icon: HiCloudDownload,
      description: 'Comparación de datos',
      color: 'cyan',
    },
    {
      id: 'line-downloads',
      name: 'Descarga de Líneas',
      icon: HiDownload,
      description: 'Descarga y filtros',
      color: 'teal',
    },
    {
      id: 'data-correction',
      name: 'Corrección de Datos',
      icon: HiPencilAlt,
      description: 'Scripts de inserción/edición',
      color: 'purple',
      disabled: false,
    },
    {
      id: 'odata-monitor',
      name: 'OData Monitor',
      icon: HiChartBar,
      description: 'Consultas Dynamics 365',
      color: 'blue',
    },
    {
      id: 'query-logs',
      name: 'Historial de Scripts',
      icon: HiClipboardList,
      description: 'Auditoría y rollbacks',
      color: 'teal',
      disabled: false,
    },
    {
      id: 'analytics',
      name: 'Analytics',
      icon: HiChartPie,
      description: 'Reportes y métricas',
      color: 'orange',
      disabled: true,
    },
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
      <Box w="280px" bg={bgSidebar} borderRightWidth="1px" borderColor={borderCol} shadow="sm">
        <VStack align="stretch" spacing={0} h="full">
          <Box p={6} borderBottomWidth="1px" borderColor={borderCol}>
            <HStack spacing={3}>
              <Box p={2.5} bg="gradient.primary" bgGradient="linear(to-br, blue.500, blue.600)" borderRadius="xl" shadow="md">
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

          <Box flex={1} overflowY="auto" p={4}>
            <Text fontSize="xs" fontWeight="bold" color={textSecondary} textTransform="uppercase" letterSpacing="wider" mb={3} px={2}>
              Módulos
            </Text>
            <VStack align="stretch" spacing={2}>
              {modules.map((module) => {
                const Icon = module.icon;
                const isActive = activeModule === module.id;
                const isEnabled = !module.disabled;
                const activeBg = useColorModeValue(`${module.color}.50`, `${module.color}.900`);
                const activeColor = useColorModeValue(`${module.color}.700`, `${module.color}.200`);
                const activeBorder = useColorModeValue(`${module.color}.200`, `${module.color}.600`);
                const hoverBg = useColorModeValue(isActive ? `${module.color}.100` : 'gray.50', isActive ? `${module.color}.800` : 'gray.700');
                const iconBg = useColorModeValue(isActive ? `${module.color}.100` : 'gray.100', isActive ? `${module.color}.700` : 'gray.600');
                const inactiveColor = useColorModeValue('gray.700', 'gray.300');
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
                    borderRadius="xl"
                    border="2px solid"
                    borderColor={isActive ? activeBorder : 'transparent'}
                    _hover={{ bg: isEnabled ? hoverBg : 'transparent', transform: isEnabled ? 'translateX(2px)' : 'none' }}
                    transition="all 0.2s"
                    cursor={isEnabled ? 'pointer' : 'not-allowed'}
                    opacity={isEnabled ? 1 : 0.5}
                 >
                    <HStack spacing={3} w="full">
                      <Box p={2} bg={iconBg} borderRadius="lg">
                        <Icon size={18} color={isActive ? undefined : '#718096'} />
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

          <Box p={4} borderTopWidth="1px" borderColor={borderCol}>
            <HStack spacing={2} fontSize="xs" color="gray.500">
              <Badge colorScheme="green" variant="subtle">v1.0.0</Badge>
              <Text>•</Text>
              <Text>Patagonia</Text>
            </HStack>
          </Box>
        </VStack>
      </Box>

      <Box flex={1} overflow="hidden" display="flex" flexDirection="column">
        <Box bg={useColorModeValue('white','gray.800')} borderBottomWidth="1px" borderColor={borderCol} px={8} py={6} shadow="sm">
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Heading size="lg" color={textPrimary} fontWeight="bold">
                {activeModule === 'odata-monitor' && 'Monitor de Datos'}
                {activeModule === 'snowflake-sync' && 'Snowflake Sync'}
                {activeModule === 'line-downloads' && 'Descarga de Líneas'}
                {activeModule === 'data-correction' && 'Corrección de Datos'}
                {activeModule === 'query-logs' && 'Historial de Scripts'}
              </Heading>
              <Text color={useColorModeValue('gray.600','gray.300')} fontSize="sm">
                {activeModule === 'odata-monitor' && 'Dynamics 365 Finance & Operations · PdSalesVSCostProcesseds'}
                {activeModule === 'snowflake-sync' && 'Comparación BASE vs VISTA · Ledger 400000'}
                {activeModule === 'line-downloads' && 'Descarga flexible · Vista o ERP_PROCESSED_SALESLINE'}
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
                  leftIcon={<Avatar size="xs" name={user?.name} bg="brand.500" />}
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

        <Box flex={1} overflow="auto" p={8}>
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
          {activeModule === 'line-downloads' && <LineDownloadModule />}
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
