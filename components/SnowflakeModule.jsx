import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  ButtonGroup,
  VStack,
  HStack,
  Table,
  TableContainer,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Spinner,
  Badge,
  useToast,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Grid,
  GridItem,
  Wrap,
  WrapItem,
  Tag,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
  FormControl,
  FormLabel,
  Input,
  List,
  ListItem,
  ListIcon,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { HiRefresh, HiCloudDownload, HiClipboardCopy, HiInformationCircle, HiPencilAlt } from 'react-icons/hi';

const api = axios.create({ baseURL: '/api' });

const tableScrollStyles = {
  '&::-webkit-scrollbar': { height: '8px', width: '8px' },
  '&::-webkit-scrollbar-track': { background: '#EDF2F7', borderRadius: '999px' },
  '&::-webkit-scrollbar-thumb': { background: '#A0AEC0', borderRadius: '999px' },
};

const DEFAULT_DATE_FROM = '2020-01-01';
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

function SnowflakeModule({ onLaunchCorrection }) {
  const toast = useToast();
  const [analysisTarget, setAnalysisTarget] = useState(null);
  const [isAnalysisOpen, setAnalysisOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const canalSectionRef = useRef(null);
  const mismatchSectionRef = useRef(null);
  const yesterdayIso = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }, []);
  const [dateFilters, setDateFilters] = useState(() => ({
    from: DEFAULT_DATE_FROM,
    to: yesterdayIso,
  }));
  const [pendingDateFilters, setPendingDateFilters] = useState(() => ({
    from: DEFAULT_DATE_FROM,
    to: yesterdayIso,
  }));

  const handleSectionJump = (sectionRef) => {
    sectionRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDateInputChange = (field) => (event) => {
    const value = event.target.value;
    setPendingDateFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyDateFilters = () => {
    const { from, to } = pendingDateFilters;
    if (!isoDateRegex.test(from) || !isoDateRegex.test(to)) {
      toast({
        title: 'Formato de fecha inválido',
        description: 'Usa el formato YYYY-MM-DD para ambas fechas',
        status: 'warning',
        duration: 4000,
      });
      return;
    }

    if (from > to) {
      toast({
        title: 'Rango de fechas inválido',
        description: 'La fecha "desde" debe ser anterior o igual a la fecha "hasta"',
        status: 'warning',
        duration: 4000,
      });
      return;
    }

    const nextRange = { from, to };
    setPendingDateFilters(nextRange);
    setDateFilters(nextRange);
  };

  const handleResetDateFilters = () => {
    const defaults = { from: DEFAULT_DATE_FROM, to: yesterdayIso };
    setPendingDateFilters(defaults);
    setDateFilters(defaults);
  };

  const isApplyDisabled = dateFilters.from === pendingDateFilters.from && dateFilters.to === pendingDateFilters.to;

  const queryFilters = useMemo(
    () => ({
      canal: [
        { label: 'Ledger Account', value: '400000' },
        { label: 'Fechas', value: `${dateFilters.from} a ${dateFilters.to}` },
        { label: 'SalesId', value: 'Solo registros con valor' },
        { label: 'Warehouse', value: 'COMPUTE_WH' },
      ],
      mismatch: [
        { label: 'Ledger Account', value: '400000' },
        { label: 'Fechas', value: `${dateFilters.from} a ${dateFilters.to}` },
        { label: 'SalesId', value: 'Solo registros con valor' },
        { label: 'Tolerancia', value: '0.5% (0.005)' },
        { label: 'Warehouse', value: 'COMPUTE_WH' },
      ],
    }),
    [dateFilters]
  );

  const {
    data: canalData,
    isFetching: isFetchingCanal,
    refetch: refetchCanal,
    isLoading: isLoadingCanal,
  } = useQuery({
    queryKey: ['snowflake-canal', dateFilters.from, dateFilters.to],
    queryFn: async () => {
      const { data } = await api.get('/snowflake/comparacion-canal', { params: dateFilters });
      return data;
    },
    refetchOnMount: 'always',
    staleTime: 0,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast({ title: 'Error al cargar comparación por canal', description: error.message, status: 'error', duration: 5000 });
    },
  });

  const {
    data: mismatchData,
    isFetching: isFetchingMismatch,
    refetch: refetchMismatch,
    isLoading: isLoadingMismatch,
  } = useQuery({
    queryKey: ['snowflake-mismatch', dateFilters.from, dateFilters.to],
    queryFn: async () => {
      const { data } = await api.get('/snowflake/mismatch-pedidos', { params: dateFilters });
      return data;
    },
    refetchOnMount: 'always',
    staleTime: 0,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast({ title: 'Error al cargar pedidos con diferencias', description: error.message, status: 'error', duration: 5000 });
    },
  });

  const handleRefresh = () => {
    refetchCanal();
    refetchMismatch();
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  const canalSummary = useMemo(() => {
    const rows = canalData?.data || [];
    if (!rows.length) return null;
    const baseTotal = rows.reduce((acc, row) => acc + (row.BASE_TOTAL || 0), 0);
    const viewTotal = rows.reduce((acc, row) => acc + (row.VIEW_TOTAL || 0), 0);
    const totalDiff = rows.reduce((acc, row) => acc + (row.DIFF_BASE_VIEW || 0), 0);
    const absoluteDiff = rows.reduce((acc, row) => acc + Math.abs(row.DIFF_BASE_VIEW || 0), 0);
    const worstRow = rows.reduce((worst, row) => {
      if (!worst) return row;
      return Math.abs(row.DIFF_BASE_VIEW || 0) > Math.abs(worst.DIFF_BASE_VIEW || 0) ? row : worst;
    }, null);
    return { totalDiff, absoluteDiff, worstRow, baseTotal, viewTotal };
  }, [canalData]);

  const mismatchSummary = useMemo(() => {
    const rows = mismatchData?.data || [];
    if (!rows.length) return null;
    const absoluteDiff = rows.reduce((acc, row) => acc + Math.abs(row.DIFF_AMT || 0), 0);
    const baseOnly = rows.filter((row) => row.MATCH_STATUS === 'ONLY_IN_BASE').length;
    const viewOnly = rows.filter((row) => row.MATCH_STATUS === 'ONLY_IN_VIEW').length;
    const dualMismatches = rows.length - baseOnly - viewOnly;
    const worstRow = rows.reduce((worst, row) => {
      if (!worst) return row;
      return Math.abs(row.DIFF_AMT || 0) > Math.abs(worst.DIFF_AMT || 0) ? row : worst;
    }, null);
    return { absoluteDiff, baseOnly, viewOnly, dualMismatches, worstRow };
  }, [mismatchData]);

  const formatNumber = (num) => {
    if (num == null) return '—';
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const formatPercent = (num) => {
    if (num == null) return '—';
    return new Intl.NumberFormat('es-AR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const analysisMutation = useMutation({
    mutationFn: async (salesId) => {
      if (!salesId) throw new Error('SalesId requerido');
      const { data } = await api.get(`/snowflake/mismatch-analysis/${encodeURIComponent(salesId)}`);
      return data;
    },
    onSuccess: (data) => {
      setAnalysisData(data);
    },
    onError: (error) => {
      toast({ title: 'No se pudo analizar el pedido', description: error?.response?.data?.message || error.message, status: 'error', duration: 5000 });
    },
  });

  const handleCopySalesId = async (salesId) => {
    if (!salesId) return;
    try {
      await navigator.clipboard?.writeText(salesId);
      toast({ title: 'SalesId copiado', description: salesId, status: 'success', duration: 2000, isClosable: true });
    } catch (error) {
      toast({ title: 'No se pudo copiar', description: error.message, status: 'error', duration: 3000, isClosable: true });
    }
  };

  const openAnalysis = (salesId) => {
    setAnalysisTarget(salesId);
    setAnalysisData(null);
    setAnalysisOpen(true);
    analysisMutation.mutate(salesId);
  };

  const closeAnalysis = () => {
    setAnalysisOpen(false);
    setAnalysisTarget(null);
  };

  const statusColorMap = {
    MATCH: 'green',
    MISSING_IN_ODATA: 'orange',
    MISSING_IN_SNOWFLAKE: 'purple',
    AMOUNT_MISMATCH: 'red',
    ITEM_MISMATCH: 'yellow',
    INVOICE_MISMATCH: 'pink',
    DATE_MISMATCH: 'cyan',
    CANAL_MISMATCH: 'teal',
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const subtleBg = useColorModeValue('gray.50', 'gray.700');
  const borderCol = useColorModeValue('gray.100', 'gray.700');
  const borderColStrong = useColorModeValue('gray.200', 'gray.600');
  const textPrimary = useColorModeValue('gray.800', 'gray.100');
  const textSecondary = useColorModeValue('gray.600', 'gray.300');

  return (
    <VStack align="stretch" spacing={6}>
      <Box bg={cardBg} borderRadius="2xl" shadow="md" p={8} borderWidth="1px" borderColor={borderCol}>
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between">
            <HStack>
              <Box p={3} bg="cyan.50" borderRadius="xl">
                <HiCloudDownload size={24} color="#00B5D8" />
              </Box>
              <Box>
                <Heading size="md" color={textPrimary}>
                  Snowflake - Comparación de Datos
                </Heading>
                <Text fontSize="sm" color={textSecondary}>
                  BASE (ERP_ACCOUNTING_TRANSACTION) vs VISTA (VW_VENTA_COSTO_LINEAS_TEST)
                </Text>
              </Box>
            </HStack>
            <Button leftIcon={<HiRefresh />} onClick={handleRefresh} isLoading={isFetchingCanal || isFetchingMismatch} colorScheme="cyan" size="md">
              Actualizar
            </Button>
          </HStack>
          <HStack justify="space-between" align="center" flexWrap="wrap" spacing={4}>
            <Text fontSize="sm" color={textSecondary}>
              Navega directo a cada bloque y revisa los agregados antes de escrolear.
            </Text>
            <ButtonGroup size="sm" variant="ghost" colorScheme="cyan">
              <Button onClick={() => handleSectionJump(canalSectionRef)}>Canales</Button>
              <Button onClick={() => handleSectionJump(mismatchSectionRef)}>SalesId</Button>
            </ButtonGroup>
          </HStack>
          <Divider />
          <Box borderWidth="1px" borderColor={borderColStrong} borderRadius="xl" p={4} bg={useColorModeValue('gray.50', 'gray.900')} w="full">
            <HStack justify="space-between" align="flex-end" flexWrap="wrap" spacing={4}>
              <HStack spacing={4} align="flex-end" flexWrap="wrap">
                <FormControl minW="180px">
                  <FormLabel fontSize="sm" color={textSecondary}>Fecha desde</FormLabel>
                  <Input type="date" value={pendingDateFilters.from} max={pendingDateFilters.to || undefined} onChange={handleDateInputChange('from')} bg={cardBg} borderColor={borderColStrong} />
                </FormControl>
                <FormControl minW="180px">
                  <FormLabel fontSize="sm" color={textSecondary}>Fecha hasta</FormLabel>
                  <Input type="date" value={pendingDateFilters.to} min={pendingDateFilters.from || undefined} onChange={handleDateInputChange('to')} bg={cardBg} borderColor={borderColStrong} />
                </FormControl>
              </HStack>
              <HStack spacing={3} align="center">
                <Button variant="ghost" onClick={handleResetDateFilters} size="sm">
                  Restablecer
                </Button>
                <Button colorScheme="cyan" onClick={applyDateFilters} isDisabled={isApplyDisabled} size="sm">
                  Aplicar fechas
                </Button>
              </HStack>
            </HStack>
            <Text fontSize="xs" color={textSecondary} mt={2}>
              El rango seleccionado se aplica simultáneamente a ambas consultas de Snowflake.
            </Text>
          </Box>
        </VStack>
      </Box>

      <VStack align="stretch" spacing={6}>
        <Box ref={canalSectionRef} bg={cardBg} borderRadius="2xl" shadow="md" borderWidth="1px" borderColor={borderCol} overflow="hidden">
          {isLoadingCanal || isFetchingCanal ? (
            <VStack py={16} spacing={4}>
              <Spinner size="xl" color="cyan.500" thickness="4px" />
              <Text fontSize="lg" fontWeight="medium" color={textSecondary}>
                Consultando Snowflake...
              </Text>
            </VStack>
          ) : canalData?.data?.length ? (
            <>
              <HStack justify="space-between" px={8} py={5} borderBottomWidth="1px" borderColor={borderColStrong}>
                <HStack>
                  <Heading size="md" color={textPrimary}>
                    Comparación por Canal
                  </Heading>
                  <Badge colorScheme="cyan" fontSize="md" px={4} py={1.5} borderRadius="full">
                    {canalData.count} canal{canalData.count !== 1 ? 'es' : ''}
                  </Badge>
                </HStack>
                <Text fontSize="xs" color={useColorModeValue('gray.500','gray.400')}>{new Date(canalData.timestamp).toLocaleString('es-AR')}</Text>
              </HStack>
              {(() => {
                const s = canalSummary;
                return s ? (
                  <Grid templateColumns={{ base: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }} px={8} py={4} gap={4} bg={subtleBg} borderBottomWidth="1px" borderColor={borderColStrong}>
                    <GridItem>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={useColorModeValue('white','gray.800')}>
                        <Stat>
                          <StatLabel>Dif. neta</StatLabel>
                          <StatNumber fontSize="xl">{formatNumber(s.totalDiff)}</StatNumber>
                          <StatHelpText color="gray.500">BASE - VISTA</StatHelpText>
                        </Stat>
                      </Box>
                    </GridItem>
                    <GridItem>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={useColorModeValue('white','gray.800')}>
                        <Stat>
                          <StatLabel>Dif. absoluta</StatLabel>
                          <StatNumber fontSize="xl">{formatNumber(s.absoluteDiff)}</StatNumber>
                          <StatHelpText color="gray.500">Suma de desvíos</StatHelpText>
                        </Stat>
                      </Box>
                    </GridItem>
                    <GridItem>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={useColorModeValue('white','gray.800')}>
                        <Stat>
                          <StatLabel>Peor canal</StatLabel>
                          <StatNumber fontSize="lg">{s.worstRow?.CANAL || '—'}</StatNumber>
                          <StatHelpText color="gray.500">{formatNumber(s.worstRow?.DIFF_BASE_VIEW)} (dif.)</StatHelpText>
                        </Stat>
                      </Box>
                    </GridItem>
                    <GridItem>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={useColorModeValue('white','gray.800')}>
                        <Stat>
                          <StatLabel>% peor canal</StatLabel>
                          <StatNumber fontSize="xl">{formatPercent(s.worstRow?.PCT_BASE_VIEW)}</StatNumber>
                          <StatHelpText color="gray.500">Referencia inmediata</StatHelpText>
                        </Stat>
                      </Box>
                    </GridItem>
                  </Grid>
                ) : null;
              })()}
              <Box px={8} py={4} bg={subtleBg} borderBottomWidth="1px" borderColor={borderColStrong}>
                <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">Filtros aplicados</Text>
                <Wrap mt={3} spacing={3}>
                  {queryFilters.canal.map((filter) => (
                    <WrapItem key={`${filter.label}-${filter.value}`}>
                      <Tag size="lg" variant="subtle" colorScheme="cyan" borderRadius="full" px={4} py={2} bg={useColorModeValue('white','gray.800')} borderWidth="1px" borderColor="cyan.100" shadow="xs">
                        <VStack align="start" spacing={0}>
                          <Text fontSize="10px" textTransform="uppercase" color="cyan.600" fontWeight="bold">{filter.label}</Text>
                          <Text fontSize="sm" color={textPrimary} fontWeight="semibold">{filter.value}</Text>
                        </VStack>
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
              <Box px={{ base: 4, md: 8 }} pb={8} pt={2}>
                <TableContainer overflowX="auto" sx={tableScrollStyles}>
                  <Table variant="simple" size="sm">
                    <Thead position="sticky" top={0} bg={subtleBg} zIndex={1}>
                      <Tr>
                        <Th>Canal</Th>
                        <Th isNumeric>BASE Total</Th>
                        <Th isNumeric>VISTA Total</Th>
                        <Th isNumeric>Diferencia</Th>
                        <Th isNumeric>% Diferencia</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {canalData.data.map((row, i) => (
                        <Tr key={i} _hover={{ bg: subtleBg }}>
                          <Td fontWeight="semibold">{row.CANAL}</Td>
                          <Td isNumeric>{formatNumber(row.BASE_TOTAL)}</Td>
                          <Td isNumeric>{formatNumber(row.VIEW_TOTAL)}</Td>
                          <Td isNumeric color={Math.abs(row.DIFF_BASE_VIEW || 0) > 0.01 ? 'red.500' : 'green.500'} fontWeight="semibold">{formatNumber(row.DIFF_BASE_VIEW)}</Td>
                          <Td isNumeric>{formatPercent(row.PCT_BASE_VIEW)}</Td>
                        </Tr>
                      ))}
                      {canalSummary && (
                        <Tr bg={useColorModeValue('gray.100', 'gray.900')}>
                          <Td fontWeight="bold">Total</Td>
                          <Td isNumeric fontWeight="bold">{formatNumber(canalSummary.baseTotal)}</Td>
                          <Td isNumeric fontWeight="bold">{formatNumber(canalSummary.viewTotal)}</Td>
                          <Td isNumeric fontWeight="bold" color={Math.abs(canalSummary.totalDiff || 0) > 0.01 ? 'red.500' : 'green.500'}>
                            {formatNumber(canalSummary.totalDiff)}
                          </Td>
                          <Td isNumeric fontWeight="bold">
                            {canalSummary.baseTotal === 0 ? '—' : formatPercent(canalSummary.totalDiff / canalSummary.baseTotal)}
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          ) : (
            <VStack py={20} spacing={4}>
              <Box p={6} bg={useColorModeValue('gray.100','gray.700')} borderRadius="full">
                <HiCloudDownload size={48} color="#A0AEC0" />
              </Box>
              <VStack spacing={2}>
                <Text fontSize="lg" fontWeight="semibold" color={textPrimary}>Sin datos disponibles</Text>
                <Text fontSize="sm" color={textSecondary}>Haz clic en Actualizar para cargar los datos</Text>
              </VStack>
            </VStack>
          )}
        </Box>

        <Box ref={mismatchSectionRef} bg={cardBg} borderRadius="2xl" shadow="md" borderWidth="1px" borderColor={borderCol} overflow="hidden">
          {isLoadingMismatch || isFetchingMismatch ? (
            <VStack py={16} spacing={4}>
              <Spinner size="xl" color="cyan.500" thickness="4px" />
              <Text fontSize="lg" fontWeight="medium" color={textSecondary}>Consultando Snowflake...</Text>
            </VStack>
          ) : mismatchData?.data?.length ? (
            <>
              <HStack justify="space-between" px={8} py={5} borderBottomWidth="1px" borderColor={borderColStrong}>
                <HStack>
                  <Heading size="md" color={textPrimary}>SALESID VS SALESID</Heading>
                  <Badge colorScheme="red" fontSize="md" px={4} py={1.5} borderRadius="full">
                    {mismatchData.count} pedido{mismatchData.count !== 1 ? 's' : ''}
                  </Badge>
                </HStack>
                <Text fontSize="xs" color={useColorModeValue('gray.500','gray.400')}>{new Date(mismatchData.timestamp).toLocaleString('es-AR')}</Text>
              </HStack>
              {(() => {
                const s = mismatchSummary;
                return s ? (
                  <Grid templateColumns={{ base: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }} px={8} py={4} gap={4} bg={subtleBg} borderBottomWidth="1px" borderColor={borderColStrong}>
                    <GridItem>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={useColorModeValue('white','gray.800')}>
                        <Stat>
                          <StatLabel>Dif. absoluta</StatLabel>
                          <StatNumber fontSize="xl">{formatNumber(s.absoluteDiff)}</StatNumber>
                          <StatHelpText color="gray.500">Monto observado</StatHelpText>
                        </Stat>
                      </Box>
                    </GridItem>
                    <GridItem>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={useColorModeValue('white','gray.800')}>
                        <Stat>
                          <StatLabel>Solo BASE</StatLabel>
                          <StatNumber fontSize="xl">{s.baseOnly}</StatNumber>
                          <StatHelpText color="gray.500">Pedidos singulares</StatHelpText>
                        </Stat>
                      </Box>
                    </GridItem>
                    <GridItem>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={useColorModeValue('white','gray.800')}>
                        <Stat>
                          <StatLabel>Solo VISTA</StatLabel>
                          <StatNumber fontSize="xl">{s.viewOnly}</StatNumber>
                          <StatHelpText color="gray.500">Pedidos singulares</StatHelpText>
                        </Stat>
                      </Box>
                    </GridItem>
                    <GridItem>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={useColorModeValue('white','gray.800')}>
                        <Stat>
                          <StatLabel>Mayor diferencia</StatLabel>
                          <StatNumber fontSize="lg">{s.worstRow?.SALESID || '—'}</StatNumber>
                          <StatHelpText color="gray.500">{formatNumber(s.worstRow?.DIFF_AMT)}</StatHelpText>
                        </Stat>
                      </Box>
                    </GridItem>
                  </Grid>
                ) : null;
              })()}
              <Box px={{ base: 4, md: 8 }} pb={8} pt={2}>
                <TableContainer overflowX="auto" sx={tableScrollStyles}>
                  <Table variant="simple" size="sm">
                    <Thead position="sticky" top={0} bg={subtleBg} zIndex={1}>
                      <Tr>
                        <Th>Canal</Th>
                        <Th>Sales ID</Th>
                        <Th>Invoice ID</Th>
                        <Th isNumeric>BASE</Th>
                        <Th isNumeric>VISTA</Th>
                        <Th isNumeric>Diferencia</Th>
                        <Th>Estado</Th>
                        <Th>Acciones</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {mismatchData.data.map((row, i) => (
                        <Tr key={i} _hover={{ bg: subtleBg }}>
                          <Td fontSize="sm">{row.CANAL}</Td>
                          <Td fontSize="sm" fontWeight="semibold">
                            <HStack spacing={2}>
                              <Text>{row.SALESID}</Text>
                              <IconButton aria-label="Copiar SalesId" icon={<HiClipboardCopy />} size="xs" variant="ghost" color="gray.500" onClick={() => handleCopySalesId(row.SALESID)} />
                            </HStack>
                          </Td>
                          <Td fontSize="sm">{row.INVOICEID}</Td>
                          <Td isNumeric fontSize="sm">{formatNumber(row.BASE_AMT)}</Td>
                          <Td isNumeric fontSize="sm">{formatNumber(row.VIEW_AMT)}</Td>
                          <Td isNumeric fontSize="sm" color={Math.abs(row.DIFF_AMT || 0) > 0.01 ? 'red.500' : 'green.500'} fontWeight="semibold">{formatNumber(row.DIFF_AMT)}</Td>
                          <Td>
                            <Badge colorScheme={row.MATCH_STATUS === 'ONLY_IN_BASE' ? 'orange' : row.MATCH_STATUS === 'ONLY_IN_VIEW' ? 'purple' : 'red'} fontSize="xs">
                              {row.MATCH_STATUS}
                            </Badge>
                          </Td>
                          <Td>
                            <Button size="xs" colorScheme="cyan" variant="ghost" leftIcon={<HiInformationCircle />} onClick={() => openAnalysis(row.SALESID)} isLoading={analysisMutation.isPending && analysisTarget === row.SALESID}>
                              Encontrar diferencias
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          ) : (
            <VStack py={20} spacing={4}>
              <Box p={6} bg={useColorModeValue('gray.100','gray.700')} borderRadius="full">
                <HiCloudDownload size={48} color="#A0AEC0" />
              </Box>
              <VStack spacing={2}>
                <Text fontSize="lg" fontWeight="semibold" color={textPrimary}>Sin datos disponibles</Text>
                <Text fontSize="sm" color={textSecondary}>Haz clic en Actualizar para cargar los datos</Text>
              </VStack>
            </VStack>
          )}
        </Box>
      </VStack>

      <Drawer isOpen={isAnalysisOpen} placement="right" size="xl" onClose={closeAnalysis}>
        <DrawerOverlay backdropFilter="blur(4px)" />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            <Heading size="md" color={textPrimary}>Diagnóstico de diferencias</Heading>
            <Text fontSize="sm" color={textSecondary}>Sales ID: {analysisTarget || '—'}</Text>
          </DrawerHeader>
          <DrawerBody>
            {analysisMutation.isPending && !analysisData ? (
              <VStack py={10} spacing={4} color="gray.600">
                <Spinner size="lg" color="cyan.500" thickness="4px" />
                <Text>Analizando líneas entre OData y Snowflake...</Text>
              </VStack>
            ) : analysisData ? (
              <VStack align="stretch" spacing={6} py={4}>
                <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }} gap={4}>
                  {[
                    { label: 'Líneas OData', value: analysisData.summary?.odataLineCount ?? 0 },
                    { label: 'Líneas Snowflake', value: analysisData.summary?.snowflakeLineCount ?? 0 },
                    { label: 'Faltan en OData', value: analysisData.summary?.missingInOData?.length ?? 0 },
                    { label: 'Faltan en Snowflake', value: analysisData.summary?.missingInSnowflake?.length ?? 0 },
                  ].map((card) => (
                    <GridItem key={card.label}>
                      <Box borderWidth="1px" borderRadius="xl" p={4} bg={subtleBg}>
                        <Stat>
                          <StatLabel fontSize="sm" color={useColorModeValue('gray.500','gray.300')}>{card.label}</StatLabel>
                          <StatNumber fontSize="2xl">{card.value}</StatNumber>
                        </Stat>
                      </Box>
                    </GridItem>
                  ))}
                </Grid>

                <Box>
                  <Heading size="sm" color={textPrimary} mb={2}>Hallazgos clave</Heading>
                  <Wrap spacing={3}>
                    {[
                      { label: 'Diferencias de monto', data: analysisData.summary?.amountMismatches },
                      { label: 'Items distintos', data: analysisData.summary?.itemMismatches },
                      { label: 'Invoice distintos', data: analysisData.summary?.invoiceMismatches },
                      { label: 'Fechas distintas', data: analysisData.summary?.dateMismatches },
                    ]
                      .filter((entry) => entry.data && entry.data.length)
                      .map((entry) => (
                        <Tag key={entry.label} size="lg" colorScheme="red" borderRadius="full" px={4} py={2}>
                          {entry.label}: {entry.data.length}
                        </Tag>
                      ))}
                    {!analysisData.summary?.amountMismatches?.length &&
                      !analysisData.summary?.itemMismatches?.length &&
                      !analysisData.summary?.invoiceMismatches?.length &&
                      !analysisData.summary?.dateMismatches?.length && (
                        <Text fontSize="sm" color={textSecondary}>No se detectaron incidencias adicionales.</Text>
                      )}
                  </Wrap>
                </Box>

                <Divider />

                <Box>
                  <Heading size="sm" color={textPrimary} mb={3}>Detalle por línea</Heading>
                  <Box maxH="400px" overflowY="auto">
                    <Table size="sm">
                      <Thead position="sticky" top={0} bg={subtleBg} zIndex={1}>
                        <Tr>
                          <Th>Línea</Th>
                          <Th>Estado</Th>
                          <Th isNumeric>Monto OData</Th>
                          <Th isNumeric>Monto Snowflake</Th>
                          <Th isNumeric>Diferencia</Th>
                          <Th>Observaciones</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {analysisData.lines?.map((line) => (
                          <Tr key={line.lineNumber}>
                            <Td>{line.lineNumber}</Td>
                            <Td>
                              <Badge colorScheme={statusColorMap[line.status] || 'gray'}>{line.status}</Badge>
                            </Td>
                            <Td isNumeric>{formatNumber(line.odataAmount)}</Td>
                            <Td isNumeric>{formatNumber(line.snowflakeAmount)}</Td>
                            <Td isNumeric color={line.diffAmount && Math.abs(line.diffAmount) > 0.005 ? 'red.500' : useColorModeValue('gray.700','gray.300')} fontWeight="semibold">{formatNumber(line.diffAmount)}</Td>
                            <Td>
                              {line.issues?.length ? (
                                <List spacing={1} fontSize="xs">
                                  {line.issues.map((issue, idx) => (
                                    <ListItem key={idx} color={textSecondary}>
                                      <ListIcon as={HiInformationCircle} color="cyan.500" />
                                      {issue}
                                    </ListItem>
                                  ))}
                                </List>
                              ) : (
                                <Text fontSize="xs" color={textSecondary}>Sin incidencias</Text>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              </VStack>
            ) : (
              <Text fontSize="sm" color={textSecondary} py={4}>Selecciona un pedido para analizar sus diferencias.</Text>
            )}
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px" justifyContent="space-between">
            <Text fontSize="xs" color={textSecondary}>Usa este panel para identificar líneas antes de corregirlas.</Text>
            <HStack>
              <Button variant="outline" onClick={closeAnalysis}>Cerrar</Button>
              <Button colorScheme="purple" leftIcon={<HiPencilAlt />} onClick={() => { if (analysisTarget && onLaunchCorrection) { onLaunchCorrection(analysisTarget); closeAnalysis(); } }} isDisabled={!analysisTarget || !onLaunchCorrection}>Ir a Corrección</Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
}

export default SnowflakeModule;
