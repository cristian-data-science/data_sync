import React from "react";
import { Box, Heading, Text, Button, HStack, VStack, Flex, Badge } from "@chakra-ui/react";
import { useState } from "react";
import { 
  HiChartBar, 
  HiPencilAlt, 
  HiCloudDownload, 
  HiChartPie,
  HiDatabase,
  HiClipboardList
} from "react-icons/hi";
import ODataModule from "./components/ODataModule";
import SnowflakeModule from "./components/SnowflakeModule";
import DataCorrectionModule from "./components/DataCorrectionModule";
import QueryLogModule from "./components/QueryLogModule";

export default function App() {
  const [activeModule, setActiveModule] = useState("odata-monitor");
  const [correctionContext, setCorrectionContext] = useState(null);

  const modules = [
    { 
      id: "snowflake-sync", 
      name: "Snowflake Sync", 
      icon: HiCloudDownload, 
      description: "Comparación de datos",
      color: "cyan"
    },
    { 
      id: "data-correction", 
      name: "Corrección de Datos", 
      icon: HiPencilAlt, 
      description: "Scripts de inserción/edición",
      color: "purple",
      disabled: false
    },
    { 
      id: "odata-monitor", 
      name: "OData Monitor", 
      icon: HiChartBar, 
      description: "Consultas Dynamics 365",
      color: "blue"
    },
    { 
      id: "query-logs", 
      name: "Historial de Scripts", 
      icon: HiClipboardList, 
      description: "Auditoría y rollbacks",
      color: "teal",
      disabled: false
    },
    { 
      id: "analytics", 
      name: "Analytics", 
      icon: HiChartPie, 
      description: "Reportes y métricas",
      color: "orange",
      disabled: true
    }
  ];

  return (
    <Flex h="100vh" bg="gray.50">
      {/* Sidebar Profesional */}
      <Box 
        w="280px" 
        bg="white" 
        borderRightWidth="1px" 
        borderColor="gray.200"
        shadow="sm"
      >
        <VStack align="stretch" spacing={0} h="full">
          {/* Logo/Header */}
          <Box p={6} borderBottomWidth="1px" borderColor="gray.200">
            <HStack spacing={3}>
              <Box 
                p={2.5} 
                bg="gradient.primary" 
                bgGradient="linear(to-br, blue.500, blue.600)"
                borderRadius="xl"
                shadow="md"
              >
                <HiDatabase size={24} color="white" />
              </Box>
              <Box>
                <Heading size="md" fontWeight="bold" color="gray.800">
                  Data Monitor
                </Heading>
                <Text fontSize="xs" color="gray.500" fontWeight="medium">
                  Full Data Sync
                </Text>
              </Box>
            </HStack>
          </Box>

          {/* Módulos */}
          <Box flex={1} overflowY="auto" p={4}>
            <Text 
              fontSize="xs" 
              fontWeight="bold" 
              color="gray.500" 
              textTransform="uppercase" 
              letterSpacing="wider"
              mb={3}
              px={2}
            >
              Módulos
            </Text>
            <VStack align="stretch" spacing={2}>
              {modules.map(module => {
                const Icon = module.icon;
                const isActive = activeModule === module.id;
                const isEnabled = !module.disabled;
                
                return (
                  <Button
                    key={module.id}
                    onClick={() => isEnabled && setActiveModule(module.id)}
                    isDisabled={!isEnabled}
                    justifyContent="flex-start"
                    h="auto"
                    py={3}
                    px={4}
                    bg={isActive ? `${module.color}.50` : "transparent"}
                    color={isActive ? `${module.color}.700` : "gray.700"}
                    borderRadius="xl"
                    border="2px solid"
                    borderColor={isActive ? `${module.color}.200` : "transparent"}
                    _hover={{
                      bg: isEnabled ? (isActive ? `${module.color}.100` : "gray.50") : "transparent",
                      transform: isEnabled ? "translateX(2px)" : "none",
                    }}
                    transition="all 0.2s"
                    cursor={isEnabled ? "pointer" : "not-allowed"}
                    opacity={isEnabled ? 1 : 0.5}
                  >
                    <HStack spacing={3} w="full">
                      <Box
                        p={2}
                        bg={isActive ? `${module.color}.100` : "gray.100"}
                        borderRadius="lg"
                      >
                        <Icon size={18} color={isActive ? undefined : "#718096"} />
                      </Box>
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">
                          {module.name}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {module.description}
                        </Text>
                      </VStack>
                    </HStack>
                  </Button>
                );
              })}
            </VStack>
          </Box>

          {/* Footer */}
          <Box p={4} borderTopWidth="1px" borderColor="gray.200">
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
        <Box 
          bg="white" 
          borderBottomWidth="1px" 
          borderColor="gray.200"
          px={8}
          py={6}
          shadow="sm"
        >
          <Heading size="lg" color="gray.800" fontWeight="bold">
            {activeModule === "odata-monitor" && "Monitor de Datos"}
            {activeModule === "snowflake-sync" && "Snowflake Sync"}
            {activeModule === "data-correction" && "Corrección de Datos"}
            {activeModule === "query-logs" && "Historial de Scripts"}
          </Heading>
          <Text color="gray.600" fontSize="sm" mt={1}>
            {activeModule === "odata-monitor" && "Dynamics 365 Finance & Operations · PdSalesVSCostProcesseds"}
            {activeModule === "snowflake-sync" && "Comparación BASE vs VISTA · Ledger 400000"}
            {activeModule === "data-correction" && "Generador seguro de INSERT/UPDATE + Rollback"}
            {activeModule === "query-logs" && "Logs ejecutados + Rollback directo"}
          </Text>
        </Box>

        {/* Content Area */}
        <Box flex={1} overflow="auto" p={8}>
          {activeModule === "odata-monitor" && <ODataModule />}
          {activeModule === "snowflake-sync" && (
            <SnowflakeModule
              onLaunchCorrection={(salesId) => {
                if (salesId) {
                  setCorrectionContext({ salesId });
                  setActiveModule("data-correction");
                }
              }}
            />
          )}
          {activeModule === "data-correction" && (
            <DataCorrectionModule
              salesId={correctionContext?.salesId || ""}
              onPersistSalesId={(value) => {
                setCorrectionContext(value ? { salesId: value } : null);
              }}
            />
          )}
          {activeModule === "query-logs" && <QueryLogModule />}
        </Box>
      </Box>
    </Flex>
  );
}
