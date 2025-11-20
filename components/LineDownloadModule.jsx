import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  Select,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Wrap,
  WrapItem,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { HiCloudDownload, HiRefresh, HiSearch } from 'react-icons/hi';
import * as XLSX from 'xlsx';

const api = axios.create({ baseURL: '/api' });

const DEFAULT_QUERY_LIMIT = '';
const MAX_RENDERED_ROWS = 750;
const SALES_ID_MODE_OPTIONS = [
  { value: 'non-empty', label: 'Distinto de vacío' },
  { value: 'manual', label: 'Buscar manualmente' },
];

const SOURCE_CONFIG = {
  vista: {
    id: 'vista',
    label: 'VW_VENTA_COSTO_LINEAS_TEST',
    description: 'Vista consolidada · Ledger 400000',
    amountField: 'ACCOUNTINGCURRENCYAMOUNT',
    dateField: 'ACCOUNTINGDATE',
    dateRange: { from: 'accountingDateFrom', to: 'accountingDateTo' },
    filters: [
      { name: 'accountingDateFrom', label: 'Fecha desde (ACCOUNTINGDATE)', type: 'date' },
      { name: 'accountingDateTo', label: 'Fecha hasta (ACCOUNTINGDATE)', type: 'date' },
      {
        name: 'sourceFlag',
        label: 'SOURCE_FLAG',
        type: 'text',
        input: 'select',
        options: ['BASE_4XX_5XX', 'LINES_400000', 'FALLBACK_400000'],
      },
      { name: 'salesId', label: 'SalesId', type: 'text', placeholder: 'PAT-000000' },
      {
        name: 'canal',
        label: 'GAPCANALDIMENSION',
        type: 'text',
        helper: 'Usa coma para múltiples canales',
      },
      { name: 'invoiceId', label: 'InvoiceId', type: 'text' },
    ],
  },
  procesada: {
    id: 'procesada',
    label: 'ERP_PROCESSED_SALESLINE',
    description: 'Tabla procesada · Inserciones y ajustes',
    amountField: 'LINEAMOUNT',
    dateField: 'INVOICEDATE',
    dateRange: { from: 'invoiceDateFrom', to: 'invoiceDateTo' },
    filters: [
      { name: 'invoiceDateFrom', label: 'Fecha desde (INVOICEDATE)', type: 'date' },
      { name: 'invoiceDateTo', label: 'Fecha hasta (INVOICEDATE)', type: 'date' },
      { name: 'salesId', label: 'SalesId', type: 'text' },
      { name: 'invoiceId', label: 'InvoiceId', type: 'text' },
    ],
  },
};

const buildInitialFilters = (source, previousLimit = DEFAULT_QUERY_LIMIT) => {
  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.vista;
  const base = { source: config.id, limit: previousLimit ?? '' };
  config.filters.forEach(({ name }) => {
    base[name] = '';
  });
  base.salesIdMode = 'non-empty';
  return base;
};

const buildRequestParams = (filters, config) => {
  const params = { source: config.id };
  if (filters.limit && String(filters.limit).trim().length > 0) {
    params.limit = filters.limit;
  }
  config.filters.forEach(({ name }) => {
    const value = filters[name];
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      params[name] = value;
    }
  });
  const salesIdMode = filters.salesIdMode || 'non-empty';
  if (salesIdMode === 'non-empty') {
    delete params.salesId;
    params.salesIdNonEmpty = 'true';
  } else {
    params.salesIdNonEmpty = 'false';
  }
  return params;
};

const numberFormatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-AR');
};

const formatCellValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('es-AR');
  return String(value);
};

const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function LineDownloadModule() {
  const toast = useToast();
  const [pendingFilters, setPendingFilters] = useState(() => buildInitialFilters('vista'));
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const currentConfig = SOURCE_CONFIG[pendingFilters.source] || SOURCE_CONFIG.vista;
  const requestParams = useMemo(() => {
    const params = buildRequestParams(pendingFilters, currentConfig);
    if (showAllColumns) {
      params.includeAllColumns = 'true';
    }
    return params;
  }, [pendingFilters, currentConfig, showAllColumns]);
  const hasPendingChanges = useMemo(() => {
    const serializedPending = JSON.stringify(requestParams);
    const serializedApplied = JSON.stringify(appliedFilters || {});
    return serializedPending !== serializedApplied;
  }, [requestParams, appliedFilters]);

  const queryKey = ['line-download', appliedFilters ? JSON.stringify(appliedFilters) : 'initial'];
  const { data, isFetching, refetch } = useQuery({
    queryKey,
    enabled: false,
    queryFn: async () => {
      if (!appliedFilters) throw new Error('Sin filtros aplicados');
      const { data: response } = await api.get('/snowflake/lineas', { params: appliedFilters });
      return response;
    },
    onError: (error) => {
      toast({
        title: 'No se pudieron obtener las líneas',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 5000,
      });
    },
    keepPreviousData: true,
  });

  useEffect(() => {
    if (appliedFilters) {
      refetch();
    }
  }, [appliedFilters, refetch]);

  const resultSourceKey = appliedFilters?.source || pendingFilters.source;
  const resultConfig = SOURCE_CONFIG[resultSourceKey] || SOURCE_CONFIG.vista;
  const rows = appliedFilters ? data?.data || [] : [];
  const metrics = data?.metrics;
  const columnList = useMemo(() => {
    if (!rows.length) return [];
    const columnSet = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => columnSet.add(key));
    });
    return Array.from(columnSet);
  }, [rows]);

  const summaryStats = useMemo(() => {
    if (!rows.length) return null;
    const ledgerSet = new Set();
    const canalSet = new Set();
    const salesIdSet = new Set();
    let amountSum = 0;
    rows.forEach((row) => {
      const ledgerValue = row.LEDGERACCOUNT ?? row.LEDGERACCOUNT_NUM ?? row.DEFAULTDIMENSIONDISPLAYVALUE;
      if (ledgerValue) ledgerSet.add(String(ledgerValue).trim());
      const canalValue = row.GAPCANALDIMENSION ?? row.CANAL ?? row.CANAL_NORMALIZED;
      if (canalValue) canalSet.add(String(canalValue).trim());
      const salesValue = row.SALESID ? String(row.SALESID).trim().toUpperCase() : null;
      if (salesValue) salesIdSet.add(salesValue);
      const amount = Number(row[resultConfig.amountField]);
      if (Number.isFinite(amount)) amountSum += amount;
    });
    const dateValues = rows
      .map((row) => row[resultConfig.dateField])
      .filter(Boolean)
      .sort();
    return {
      totalRows: rows.length,
      totalAmount: Number.isFinite(amountSum) ? amountSum : null,
      uniqueLedgers: ledgerSet.size,
      uniqueCanals: canalSet.size,
      uniqueSalesIds: salesIdSet.size,
      minDate: dateValues[0] || null,
      maxDate: dateValues.length ? dateValues[dateValues.length - 1] : null,
    };
  }, [rows, resultConfig]);

  const handleSourceChange = (nextSource) => {
    setPendingFilters((prev) => buildInitialFilters(nextSource, prev.limit));
    setAppliedFilters(null);
    setShowAllColumns(false);
  };

  const handleFilterChange = (name) => (event) => {
    const value = event?.target?.value ?? '';
    setPendingFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSalesIdModeChange = (event) => {
    const value = event?.target?.value ?? 'non-empty';
    setPendingFilters((prev) => ({
      ...prev,
      salesIdMode: value,
      ...(value === 'manual' ? {} : { salesId: '' }),
    }));
  };

  const validatePendingFilters = () => {
    const range = currentConfig.dateRange;
    if (!range) return true;
    const fromValue = pendingFilters[range.from];
    const toValue = pendingFilters[range.to];
    if (!fromValue || !toValue) return true;
    const fromDate = parseDateValue(fromValue);
    const toDate = parseDateValue(toValue);
    if (fromDate && toDate && fromDate > toDate) {
      toast({
        title: 'Rango de fechas inválido',
        description: '"Desde" debe ser anterior o igual a "Hasta".',
        status: 'warning',
        duration: 4000,
      });
      return false;
    }
    return true;
  };

  const handleDownloadCsv = () => {
    if (!validatePendingFilters()) return;

    const params = buildRequestParams(pendingFilters, currentConfig);
    if (showAllColumns) {
      params.includeAllColumns = 'true';
    }
    params.format = 'csv';

    const queryString = new URLSearchParams(params).toString();
    const url = `/api/snowflake/lineas?${queryString}`;

    window.open(url, '_blank');
  };

  const handleSearch = () => {
    if (!validatePendingFilters()) {
      return;
    }
    if (!hasPendingChanges && appliedFilters) {
      toast({ title: 'Sin cambios pendientes', status: 'info', duration: 2500 });
      return;
    }
    setAppliedFilters(requestParams);
  };

  const handleRefresh = () => {
    if (!appliedFilters) {
      toast({ title: 'Aplica filtros primero', status: 'info', duration: 2500 });
      return;
    }
    refetch();
  };

  const handleResetFilters = () => {
    setPendingFilters((prev) => buildInitialFilters(prev.source, prev.limit));
  };

  const exportToExcel = () => {
    if (!rows.length) {
      toast({ title: 'No hay datos para exportar', status: 'info', duration: 2500 });
      return;
    }
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, resultConfig.id === 'vista' ? 'Vista' : 'Procesada');
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `lineas-${resultConfig.id}-${timestamp}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast({
      title: 'Archivo generado',
      description: `Descargaste ${rows.length} filas.`,
      status: 'success',
      duration: 3000,
    });
  };

  const rowsToRender = useMemo(() => rows.slice(0, MAX_RENDERED_ROWS), [rows]);
  const renderIsCapped = rows.length > MAX_RENDERED_ROWS;

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderCol = useColorModeValue('gray.200', 'gray.700');
  const subtleBg = useColorModeValue('gray.50', 'gray.700');
  const textSecondary = useColorModeValue('gray.600', 'gray.300');
  const tableHeaderBg = useColorModeValue('gray.100', 'gray.700');

  return (
    <VStack align="stretch" spacing={6}>
      <Box bg={cardBg} borderRadius="2xl" shadow="md" p={8} borderWidth="1px" borderColor={borderCol}>
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between" align="start" flexWrap="wrap" gap={4}>
            <Box>
              <Heading size="md">Descarga manual de líneas Snowflake</Heading>
              <Text fontSize="sm" color={textSecondary} mt={1}>
                Selecciona la fuente, ajusta filtros específicos y ejecuta la consulta cuando lo necesites.
              </Text>
              <Text fontSize="xs" color={textSecondary} mt={1}>
                Tabla seleccionada: <strong>{currentConfig.label}</strong>
              </Text>
              {metrics && (
                <Text fontSize="xs" color={textSecondary} mt={1}>
                  Última consulta: {((metrics.totalMs || 0) / 1000).toFixed(1)}s · Query {((metrics.queryMs || 0) / 1000).toFixed(1)}s · {metrics.columnCount || 0} columnas
                </Text>
              )}
            </Box>
            <HStack spacing={3}>
              <Button
                leftIcon={<HiSearch />}
                colorScheme="cyan"
                onClick={handleSearch}
                isLoading={isFetching && !hasPendingChanges && !!appliedFilters}
              >
                Buscar
              </Button>
              <IconButton
                icon={<HiRefresh />}
                aria-label="Refrescar"
                onClick={handleRefresh}
                isLoading={isFetching && !!appliedFilters}
                isDisabled={!appliedFilters}
              />
              <Button leftIcon={<HiCloudDownload />} onClick={exportToExcel} isDisabled={!rows.length}>
                Exportar Excel
              </Button>
            </HStack>
          </HStack>
          <Divider />
          <VStack align="stretch" spacing={3}>
            <ButtonGroup size="sm" variant="ghost" colorScheme="cyan">
              {Object.values(SOURCE_CONFIG).map((option) => (
                <Button key={option.id} onClick={() => handleSourceChange(option.id)} isActive={pendingFilters.source === option.id}>
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
            <Text fontSize="xs" color={textSecondary}>
              {currentConfig.description}
            </Text>
            <Wrap spacing={4}>
              {currentConfig.filters.map((filter) => (
                filter.name === 'salesId' ? (
                  <WrapItem key={filter.name} minW="260px">
                    <FormControl>
                      <FormLabel fontSize="xs">{filter.label}</FormLabel>
                      <Select value={pendingFilters.salesIdMode} onChange={handleSalesIdModeChange} mb={2}>
                        {SALES_ID_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="text"
                        value={pendingFilters[filter.name]}
                        placeholder={filter.placeholder}
                        onChange={handleFilterChange(filter.name)}
                        isDisabled={pendingFilters.salesIdMode !== 'manual'}
                      />
                      <Text fontSize="xx-small" color={textSecondary} mt={1}>
                        Usa "Buscar manualmente" para ingresar un pedido específico.
                      </Text>
                    </FormControl>
                  </WrapItem>
                ) : (
                  <WrapItem key={filter.name}>
                    <FormControl minW="170px">
                      <FormLabel fontSize="xs">{filter.label}</FormLabel>
                      {filter.input === 'select' ? (
                        <Select
                          placeholder="Selecciona una opción"
                          value={pendingFilters[filter.name]}
                          onChange={handleFilterChange(filter.name)}
                        >
                          {filter.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          type={filter.type === 'date' ? 'date' : 'text'}
                          value={pendingFilters[filter.name]}
                          placeholder={filter.placeholder}
                          onChange={handleFilterChange(filter.name)}
                        />
                      )}
                      {filter.helper && (
                        <Text fontSize="xx-small" color={textSecondary} mt={1}>
                          {filter.helper}
                        </Text>
                      )}
                    </FormControl>
                  </WrapItem>
                )
              ))}
              <WrapItem key="limit">
                <FormControl minW="160px">
                  <FormLabel fontSize="xs">Límite de filas</FormLabel>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={pendingFilters.limit}
                    onChange={handleFilterChange('limit')}
                  />
                  <Text fontSize="xx-small" color={textSecondary} mt={1}>
                    Completa sólo si querés limitar la respuesta. Vacío = sin límite (puede ser pesado).
                  </Text>
                </FormControl>
              </WrapItem>
            </Wrap>
            <HStack spacing={6}>
              <FormControl display="flex" alignItems="center" w="auto">
                <Switch
                  id="show-all-columns"
                  isChecked={showAllColumns}
                  onChange={(event) => setShowAllColumns(event.target.checked)}
                  colorScheme="cyan"
                />
                <FormLabel htmlFor="show-all-columns" mb="0" ml={2} fontSize="sm">
                  Columnas extendidas (SELECT *)
                </FormLabel>
              </FormControl>
              <Text fontSize="xs" color={textSecondary}>
                Desactiva para usar columnas recomendadas y respuestas más rápidas.
              </Text>
            </HStack>
            <HStack spacing={3}>
              <Button onClick={handleResetFilters} size="sm" variant="ghost">
                Restablecer
              </Button>
              <Button onClick={handleDownloadCsv} colorScheme="green" size="sm" leftIcon={<HiCloudDownload />}>
                Descargar CSV
              </Button>
              <Button onClick={handleSearch} colorScheme="cyan" size="sm" isDisabled={!hasPendingChanges && !!appliedFilters}>
                Aplicar filtros
              </Button>
            </HStack>
          </VStack>
        </VStack>
      </Box>

      {summaryStats && (
        <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(4, 1fr)' }} gap={4}>
          {[
            {
              label: 'Filas retornadas',
              value: numberFormatter.format(summaryStats.totalRows),
              help: appliedFilters?.limit ? `${appliedFilters.limit} máx.` : 'Sin límite',
            },
            {
              label: 'Monto total',
              value: summaryStats.totalAmount === null ? '—' : currencyFormatter.format(summaryStats.totalAmount),
              help: resultConfig.amountField,
            },
            {
              label: 'SalesIds únicos',
              value: summaryStats.uniqueSalesIds.toLocaleString('es-AR'),
              help: `${summaryStats.uniqueLedgers} ledgers / ${summaryStats.uniqueCanals} canales`,
            },
            {
              label: 'Rango detectado',
              value:
                summaryStats.minDate && summaryStats.maxDate
                  ? `${formatDate(summaryStats.minDate)} → ${formatDate(summaryStats.maxDate)}`
                  : 'Sin fecha',
              help: resultConfig.dateField,
            },
          ].map((card) => (
            <GridItem key={card.label}>
              <Box bg={cardBg} borderWidth="1px" borderRadius="xl" p={5} borderColor={borderCol}>
                <Stat>
                  <StatLabel>{card.label}</StatLabel>
                  <StatNumber fontSize="2xl">{card.value}</StatNumber>
                  <StatHelpText>{card.help}</StatHelpText>
                </Stat>
              </Box>
            </GridItem>
          ))}
        </Grid>
      )}

      <Box bg={cardBg} borderRadius="2xl" shadow="md" borderWidth="1px" borderColor={borderCol}>
        {!appliedFilters ? (
          <Box py={16} textAlign="center" px={8} bg={subtleBg} borderRadius="2xl">
            <Heading size="sm" mb={2}>
              Ejecuta la consulta manualmente
            </Heading>
            <Text fontSize="sm" color={textSecondary}>
              Configura la fuente, define filtros y presiona "Buscar" para obtener resultados.
            </Text>
          </Box>
        ) : isFetching && !rows.length ? (
          <VStack py={16} spacing={4}>
            <Spinner size="xl" color="cyan.500" thickness="4px" />
            <Text color={textSecondary}>Consultando {resultConfig.label}...</Text>
          </VStack>
        ) : rows.length ? (
          <>
            <HStack
              justify="space-between"
              px={6}
              py={4}
              borderBottomWidth="1px"
              borderColor={borderCol}
              flexWrap="wrap"
              gap={3}
            >
              <HStack>
                <Heading size="sm">Resultado</Heading>
                <Badge colorScheme="cyan">{rows.length} filas</Badge>
              </HStack>
              <VStack align="end" spacing={0} fontSize="xs" color={textSecondary}>
                <Text>
                  Tabla: {resultConfig.label} · Consulta: {data?.timestamp ? new Date(data.timestamp).toLocaleString('es-AR') : '—'}
                </Text>
                {renderIsCapped && (
                  <Text>
                    Se muestran {rowsToRender.length} filas de {rows.length}. Usa Excel para revisar el total.
                  </Text>
                )}
                {metrics && (
                  <Text>
                    Tiempo total {((metrics.totalMs || 0) / 1000).toFixed(1)}s · Query {((metrics.queryMs || 0) / 1000).toFixed(1)}s
                  </Text>
                )}
              </VStack>
            </HStack>
            <TableContainer maxH="520px" overflowY="auto" overflowX="auto">
              <Table size="sm" variant="striped">
                <Thead position="sticky" top={0} bg={tableHeaderBg} zIndex={1}>
                  <Tr>
                    {columnList.map((column) => (
                      <Th key={column}>{column}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {rowsToRender.map((row, rowIndex) => (
                    <Tr key={`${rowIndex}-${row?.SALESLINEPK || row?.SALESID || 'row'}`}>
                      {columnList.map((column) => (
                        <Td key={`${column}-${rowIndex}`} whiteSpace="nowrap">
                          {column.toLowerCase().includes('date')
                            ? formatDate(row[column])
                            : formatCellValue(row[column])}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </>
        ) : (
          <Box py={20} px={8} textAlign="center" bg={subtleBg} borderRadius="2xl">
            <Heading size="sm" mb={2}>
              Sin resultados
            </Heading>
            <Text fontSize="sm" color={textSecondary}>
              Ajusta los filtros o amplía el rango para recuperar datos.
            </Text>
          </Box>
        )}
      </Box>
    </VStack>
  );
}

export default LineDownloadModule;
