import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertIcon,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Code,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  Select,
  Stack,
  Text,
  Tooltip,
  VStack,
  useToast,
  Spinner,
  useColorModeValue,
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { HiClipboardCopy, HiRefresh, HiArrowNarrowLeft, HiArrowNarrowRight, HiShieldCheck } from 'react-icons/hi';

const api = axios.create({ baseURL: '/api' });

const ACTION_LABELS = { sql: 'SQL ejecutado', rollback: 'Rollback manual', 'rollback-from-log': 'Rollback desde logs' };
const ACTION_COLORS = { sql: 'purple', rollback: 'orange', 'rollback-from-log': 'teal' };

const copyText = async (text, toast, label) => {
  if (!text) {
    toast({ title: 'Nada para copiar', status: 'info', duration: 2500, isClosable: true });
    return;
  }
  try {
    await navigator.clipboard?.writeText(text);
    toast({ title: `${label} copiado`, description: 'Disponible en tu portapapeles.', status: 'success', duration: 2500, isClosable: true });
  } catch (error) {
    toast({ title: 'No se pudo copiar', description: error.message, status: 'error', duration: 3000, isClosable: true });
  }
};

const parseMetadata = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') {
    if (raw && typeof raw.value !== 'undefined') {
      return typeof raw.value === 'object' ? raw.value ?? {} : parseMetadata(raw.value);
    }
    return raw;
  }
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (error) { /* noop */ }
  }
  return {};
};

const formatTargetLabel = ({ entryLabel, lineNumber, salesId }) => {
  const lineText = entryLabel ? `la línea ${entryLabel}` : Number.isFinite(lineNumber) ? `la línea ${lineNumber}` : null;
  if (lineText && salesId) return `${lineText} del pedido ${salesId}`;
  if (lineText) return lineText;
  if (salesId) return `el pedido ${salesId}`;
  return 'los datos seleccionados';
};

const describeColumns = (columns) => {
  if (!Array.isArray(columns) || columns.length === 0) return null;
  return columns.length === 1 ? `la columna ${columns[0]}` : `${columns.length} columnas (${columns.join(', ')})`;
};

const toNumeric = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildLogDescription = (log) => {
  if (!log) return null;
  const metadata = parseMetadata(log.extraMetadata);
  const actionType = log.actionType || metadata.actionType || 'sql';
  const kind = (log.kind || metadata.kind || '').toLowerCase();
  const salesId = log.salesId || metadata.salesId || metadata.SalesId || null;
  const entryLabel = metadata.preview?.salesLinePk || metadata.entryId || log.entryId || metadata.entryID || null;
  const lineNumber = toNumeric(log.lineNumber) ?? toNumeric(metadata.lineNumber);
  const columns = describeColumns(Array.isArray(metadata.preview?.columnas) ? metadata.preview.columnas : Array.isArray(metadata.columnas) ? metadata.columnas : null);
  const target = formatTargetLabel({ entryLabel, lineNumber, salesId });
  const orderLabel = salesId ? `el pedido ${salesId}` : target;

  if (actionType === 'rollback-from-log') {
    const sourceLogId = metadata.sourceLogId;
    return `Se revirtió el log #${sourceLogId || log.logId} para ${orderLabel} usando el rollback almacenado.`;
  }
  if (actionType === 'rollback') return `Se ejecutó el rollback manual para ${orderLabel} y se restauraron los datos originales.`;
  if (kind === 'insert') return `Se insertó un registro para ${orderLabel} en Snowflake para reponer la línea faltante.`;
  return columns ? `Actualizó ${columns} de ${target}.` : `Ejecutó SQL manual directamente sobre ${target}.`;
};

export default function QueryLogModule() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formFilters, setFormFilters] = useState({ salesId: '', actionType: '' });
  const [appliedFilters, setAppliedFilters] = useState({ salesId: '', actionType: '' });
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [pendingRollback, setPendingRollback] = useState(null);
  const [executingRollbackId, setExecutingRollbackId] = useState(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const cancelRef = useRef();
  const confirmGuardRef = useRef(false);

  const queryParams = useMemo(() => {
    const params = { limit: pageSize, offset: page * pageSize };
    if (appliedFilters.salesId.trim()) params.salesId = appliedFilters.salesId.trim();
    if (appliedFilters.actionType) params.actionType = appliedFilters.actionType;
    return params;
  }, [appliedFilters, page]);

  const logsQuery = useQuery({
    queryKey: ['query-logs', queryParams],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey;
      const { data } = await api.get('/snowflake/query-logs', { params });
      return data;
    },
    keepPreviousData: true,
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ logId }) => {
      const { data } = await api.post(`/snowflake/query-logs/${logId}/rollback`);
      return data;
    },
    onMutate: ({ logId }) => { setExecutingRollbackId(logId); },
    onSuccess: (data) => {
      toast({ title: 'Rollback ejecutado', description: data?.message || 'Snowflake confirmó la reversión.', status: 'success', duration: 4000, isClosable: true });
      queryClient.invalidateQueries({ queryKey: ['query-logs'] });
      setPendingRollback(null);
    },
    onError: (error) => { toast({ title: 'No se pudo ejecutar el rollback', description: error?.response?.data?.message || error.message, status: 'error', duration: 5000, isClosable: true }); },
    onSettled: () => { setExecutingRollbackId(null); confirmGuardRef.current = false; setDialogSubmitting(false); },
  });

  const handleConfirmRollback = () => {
    if (!pendingRollback || rollbackMutation.isLoading || confirmGuardRef.current) return;
    confirmGuardRef.current = true;
    setDialogSubmitting(true);
    rollbackMutation.mutate({ logId: pendingRollback.logId }, { onError: () => { confirmGuardRef.current = false; setDialogSubmitting(false); } });
  };

  const logs = logsQuery.data?.logs ?? [];
  const total = logsQuery.data?.total ?? 0;
  const limit = logsQuery.data?.limit ?? pageSize;
  const offset = logsQuery.data?.offset ?? page * pageSize;
  const startRow = total === 0 ? 0 : offset + 1;
  const endRow = Math.min(offset + limit, total);
  const hasNext = offset + limit < total;

  const handleApplyFilters = () => { setAppliedFilters({ ...formFilters }); setPage(0); };
  const handleClearFilters = () => { setFormFilters({ salesId: '', actionType: '' }); setAppliedFilters({ salesId: '', actionType: '' }); setPage(0); };
  const handlePrevPage = () => setPage((prev) => Math.max(prev - 1, 0));
  const handleNextPage = () => hasNext && setPage((prev) => prev + 1);
  const cardBg = useColorModeValue('white', 'gray.800');
  const textPrimary = useColorModeValue('gray.800', 'gray.100');
  const textSecondary = useColorModeValue('gray.600', 'gray.300');
  const textMuted = useColorModeValue('gray.500', 'gray.400');

  if (logsQuery.isLoading && !logsQuery.data) {
    return (
      <Box bg={cardBg} borderRadius="2xl" shadow="md" p={12} textAlign="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="purple.500" thickness="4px" />
          <Text fontSize="lg" fontWeight="semibold" color={textPrimary}>Cargando historial de Snowflake...</Text>
          <Text fontSize="sm" color={textMuted}>Esto puede demorar unos segundos mientras consultamos los logs.</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Box bg={cardBg} borderRadius="2xl" shadow="md" p={6} borderWidth="1px" borderColor={useColorModeValue('gray.100','gray.700')}>
        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align="start">
          <InputGroup maxW="320px">
            <InputLeftAddon fontWeight="semibold" bg="gray.50">SalesId</InputLeftAddon>
            <Input placeholder="PAT-000000" value={formFilters.salesId} onChange={(event) => setFormFilters((prev) => ({ ...prev, salesId: event.target.value }))} />
          </InputGroup>
          <InputGroup maxW="220px">
            <InputLeftAddon fontWeight="semibold" bg="gray.50">Tipo</InputLeftAddon>
            <Select value={formFilters.actionType} onChange={(event) => setFormFilters((prev) => ({ ...prev, actionType: event.target.value }))}>
              <option value="">Todos</option>
              <option value="sql">SQL ejecutado</option>
              <option value="rollback">Rollback manual</option>
              <option value="rollback-from-log">Rollback desde logs</option>
            </Select>
          </InputGroup>
          <HStack spacing={3}>
            <Button colorScheme="purple" onClick={handleApplyFilters} isLoading={logsQuery.isFetching}>Buscar</Button>
            <Button variant="ghost" onClick={handleClearFilters}>Limpiar</Button>
            <Tooltip label="Refrescar">
              <IconButton aria-label="Recalcular" icon={<HiRefresh />} onClick={() => logsQuery.refetch()} isLoading={logsQuery.isRefetching} />
            </Tooltip>
          </HStack>
        </Stack>
      </Box>

      <Box bg={cardBg} borderRadius="2xl" shadow="md" p={6} borderWidth="1px" borderColor={useColorModeValue('gray.100','gray.700')}>
        <HStack justify="space-between" align={{ base: 'stretch', md: 'center' }} flexWrap="wrap" gap={3}>
          <Box>
            <Text fontWeight="bold" color={textPrimary}>{total ? `Mostrando ${startRow}-${endRow} de ${total} registros` : 'Sin registros'}</Text>
            {total > 0 && <Text fontSize="xs" color={textMuted}>Última actualización: {new Date(logsQuery.data?.timestamp || Date.now()).toLocaleString('es-AR')}</Text>}
          </Box>
          <HStack spacing={2}>
            <Button leftIcon={<HiArrowNarrowLeft />} onClick={handlePrevPage} isDisabled={page === 0 || logsQuery.isFetching}>Anterior</Button>
            <Button rightIcon={<HiArrowNarrowRight />} onClick={handleNextPage} isDisabled={!hasNext || logsQuery.isFetching}>Siguiente</Button>
          </HStack>
        </HStack>
      </Box>

      {logsQuery.isError && (
        <Alert status="error" borderRadius="lg"><AlertIcon />{logsQuery.error?.message || 'No se pudieron cargar los logs'}</Alert>
      )}

      {logsQuery.isLoading ? (
        <Box bg={cardBg} borderRadius="2xl" shadow="md" p={8} textAlign="center"><Text color={textSecondary}>Cargando historial...</Text></Box>
      ) : logs.length === 0 ? (
        <Box bg={cardBg} borderRadius="2xl" shadow="md" p={8} textAlign="center">
          <Text fontWeight="semibold" color={textPrimary}>No hay logs con los filtros actuales</Text>
          <Text fontSize="sm" color={textMuted} mt={2}>Ejecuta un script o ajusta los filtros para ver el historial.</Text>
        </Box>
      ) : (
        <VStack align="stretch" spacing={4}>
          {logs.map((log) => {
            const actionLabel = ACTION_LABELS[log.actionType] || log.actionType || 'Acción';
            const badgeColor = ACTION_COLORS[log.actionType] || 'gray';
            const hasRollback = Boolean(log.rollbackSql && log.rollbackSql.trim() && log.rollbackSql.trim() !== '-- N/A');
            return (
              <Box key={log.logId} borderWidth="1px" borderRadius="2xl" p={6} bg={cardBg} shadow="sm">
                <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                  <Box>
                    <Text fontSize="sm" fontWeight="bold" color={textPrimary}>Log #{log.logId}</Text>
                    <Text fontSize="sm" color={textSecondary} mt={1}>{buildLogDescription(log)}</Text>
                    <Text fontSize="xs" color={textMuted}>{new Date(log.executedAt).toLocaleString('es-AR')}</Text>
                  </Box>
                  <Badge colorScheme={badgeColor}>{actionLabel}</Badge>
                </HStack>
                <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(4, 1fr)' }} gap={3} mt={4} fontSize="sm">
                  <GridItem>
                    <Text color={textMuted}>SalesId</Text>
                    <Text fontWeight="semibold">{log.salesId || '—'}</Text>
                  </GridItem>
                  <GridItem>
                    <Text color={textMuted}>EntryId</Text>
                    <Text fontWeight="semibold">{log.entryId || '—'}</Text>
                  </GridItem>
                  <GridItem>
                    <Text color={textMuted}>Usuario</Text>
                    <Text fontWeight="semibold">{log.executedBy || '—'}</Text>
                  </GridItem>
                  <GridItem>
                    <Text color={textMuted}>Tipo/KIND</Text>
                    <Text fontWeight="semibold">{log.kind || '—'}</Text>
                  </GridItem>
                </Grid>
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4} mt={5}>
                  <Box flex={1}>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="xs" fontWeight="bold" color={textSecondary}>SQL ejecutado</Text>
                      <Button size="xs" leftIcon={<HiClipboardCopy />} onClick={() => copyText(log.executedSql, toast, 'SQL')}>Copiar</Button>
                    </HStack>
                    <Code display="block" whiteSpace="pre-wrap" fontSize="xs" p={3} borderRadius="md" bg={useColorModeValue('gray.900','gray.800')} color={useColorModeValue('green.100','green.100')}>{log.executedSql || '—'}</Code>
                  </Box>
                  <Box flex={1}>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="xs" fontWeight="bold" color={textSecondary}>Rollback almacenado</Text>
                      <Button size="xs" variant="outline" leftIcon={<HiClipboardCopy />} onClick={() => copyText(log.rollbackSql, toast, 'Rollback')} isDisabled={!hasRollback}>Copiar</Button>
                    </HStack>
                    <Code display="block" whiteSpace="pre-wrap" fontSize="xs" p={3} borderRadius="md" bg={useColorModeValue('gray.800','gray.700')} color={useColorModeValue('orange.100','orange.100')}>{log.rollbackSql || 'No disponible'}</Code>
                  </Box>
                </Stack>
                <ButtonGroup size="sm" spacing={3} mt={6} flexWrap="wrap">
                  <Button colorScheme="orange" leftIcon={<HiShieldCheck />} onClick={() => setPendingRollback(log)} isDisabled={!hasRollback || rollbackMutation.isLoading} isLoading={executingRollbackId === log.logId && rollbackMutation.isLoading} loadingText="Ejecutando">
                    Ejecutar rollback
                  </Button>
                </ButtonGroup>
              </Box>
            );
          })}
        </VStack>
      )}

      <AlertDialog isOpen={Boolean(pendingRollback)} leastDestructiveRef={cancelRef} onClose={() => (!(rollbackMutation.isLoading || dialogSubmitting) ? setPendingRollback(null) : null)} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent position="relative" overflow="hidden">
            {(rollbackMutation.isLoading || dialogSubmitting) && (
              <Box position="absolute" inset={0} bg="whiteAlpha.800" display="flex" flexDirection="column" alignItems="center" justifyContent="center" zIndex={1}>
                <Spinner size="lg" color="orange.400" thickness="4px" />
                <Text mt={3} fontWeight="semibold" color={textPrimary}>Ejecutando rollback</Text>
              </Box>
            )}
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Confirmar rollback</AlertDialogHeader>
            <AlertDialogBody opacity={rollbackMutation.isLoading || dialogSubmitting ? 0.4 : 1} pointerEvents={rollbackMutation.isLoading || dialogSubmitting ? 'none' : 'auto'}>
              <Text mb={3} color={textPrimary}>Vas a ejecutar el rollback almacenado del log #{pendingRollback?.logId}. Esto revertirá la operación aplicada originalmente sobre SalesId {pendingRollback?.salesId || 'desconocido'}.</Text>
              <Text fontSize="sm" color={textMuted}>El backend ejecutará el SQL de rollback directamente en Snowflake usando las mismas credenciales.</Text>
            </AlertDialogBody>
            <AlertDialogFooter opacity={rollbackMutation.isLoading || dialogSubmitting ? 0.4 : 1} pointerEvents={rollbackMutation.isLoading || dialogSubmitting ? 'none' : 'auto'}>
              <Button ref={cancelRef} onClick={() => setPendingRollback(null)} disabled={rollbackMutation.isLoading || dialogSubmitting}>Cancelar</Button>
              <Button colorScheme="orange" onClick={handleConfirmRollback} ml={3} isLoading={rollbackMutation.isLoading || dialogSubmitting}>Sí, ejecutar rollback</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
