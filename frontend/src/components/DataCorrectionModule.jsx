import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
  Divider,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  Stack,
  Text,
  Tooltip,
  VStack,
  useToast,
  Spinner,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { HiClipboardCopy, HiLightningBolt, HiRefresh } from "react-icons/hi";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001",
});

const previewAmountFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatPreviewDefaultValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("es-AR");
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") {
      return numeric.toLocaleString("es-AR");
    }
    return value;
  }
  return String(value);
};

const formatPreviewAmountValue = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return previewAmountFormatter.format(numeric);
  }
  return formatPreviewDefaultValue(value);
};

const PREVIEW_SUMMARY_FIELDS = [
  {
    label: "SALESID",
    keys: ["SALESID"],
    fallback: ({ activeSalesId }) => activeSalesId || null,
  },
  {
    label: "INVOICEID",
    keys: ["INVOICEID"],
  },
  {
    label: "LINENUM",
    keys: ["LINENUM"],
    fallback: ({ statement }) => statement?.lineNumber ?? null,
  },
  {
    label: "LINEAMOUNTMST",
    keys: ["LINEAMOUNTMST", "LINEAMOUNT", "AMOUNT"],
    formatter: formatPreviewAmountValue,
  },
  {
    label: "CANAL",
    keys: ["CANAL"],
  },
];

const buildPreviewSummaryEntries = (statement, activeSalesId) => {
  if (!statement?.preview) return [];
  const index = new Map();
  Object.entries(statement.preview).forEach(([key, value]) => {
    if (typeof key === "string") {
      index.set(key.toUpperCase(), value);
    }
  });

  const context = { statement, activeSalesId };

  return PREVIEW_SUMMARY_FIELDS.map((field) => {
    let rawValue;
    for (const key of field.keys) {
      const lookupKey = key.toUpperCase();
      if (index.has(lookupKey)) {
        rawValue = index.get(lookupKey);
        break;
      }
    }
    if (rawValue === undefined && typeof field.fallback === "function") {
      rawValue = field.fallback(context);
    }
    const formattedValue = field.formatter
      ? field.formatter(rawValue, context)
      : formatPreviewDefaultValue(rawValue);
    return {
      label: field.label,
      value: formattedValue,
    };
  });
};

const shouldUseSummaryPreview = (statement) =>
  Boolean(statement?.preview) && statement?.kind === "insert";

const describeStatementEffect = (statement, actionType = "sql") => {
  if (!statement) return "";
  const table = "ERP_PROCESSED_SALESLINE";
  const pk = statement.preview?.salesLinePk || statement.entryId || `la línea ${statement.lineNumber ?? "sin número"}`;
  const columns = Array.isArray(statement.preview?.columnas) ? statement.preview.columnas : [];
  const columnLabel = columns.length
    ? columns.length === 1
      ? `la columna ${columns[0]}`
      : `${columns.length} columnas (${columns.join(", ")})`
    : "varios campos relevantes";

  if (statement.actionable === false || statement.sql?.startsWith("-- No se generó")) {
    return actionType === "rollback"
      ? "Este rollback no está disponible porque la operación original no genera cambios."
      : "Esta tarjeta es informativa: la línea detectada requiere recrearse mediante una inserción nueva.";
  }

  if (statement.kind === "insert") {
    return actionType === "rollback"
      ? `Eliminará la fila ${pk} en ${table} para deshacer la inserción sugerida.`
      : `Insertará la fila ${pk} en ${table} replicando exactamente los valores detectados en OData.`;
  }

  return actionType === "rollback"
    ? `Restaurará ${columnLabel} de ${pk} en ${table} usando los valores previos registrados.`
    : `Actualizará ${columnLabel} de ${pk} en ${table}, sobrescribiendo los valores actuales con los obtenidos de OData.`;
};

const copyText = async (text, toast) => {
  try {
    await navigator.clipboard?.writeText(text);
    toast({
      title: "SQL copiado",
      description: "Puedes pegarlo en Snowflake o tu herramienta favorita.",
      status: "success",
      duration: 2500,
      isClosable: true,
    });
  } catch (error) {
    toast({
      title: "No se pudo copiar",
      description: error.message,
      status: "error",
      duration: 3000,
      isClosable: true,
    });
  }
};

const buildStatementKey = (statement) => {
  if (!statement) return null;
  const baseId = statement.entryId || statement.preview?.salesLinePk || statement.lineNumber || "";
  const normalizedSql = (statement.sql || "").replace(/\s+/g, " ").trim();
  return `${statement.kind || "unknown"}|${baseId}|${normalizedSql}`;
};

function StatementCard({
  title,
  badge,
  statement,
  toast,
  activeSalesId,
  onExecute,
  onRollback,
  disableActions = false,
  isSqlLoading = false,
  isRollbackLoading = false,
  forceRollbackDisabled = false,
}) {
  const hasRollback = statement.rollbackSql && !statement.rollbackSql.startsWith("-- N/A");
  const isActionable = statement.actionable !== false && !statement.sql?.startsWith("-- No se generó");
  const mainSummary = describeStatementEffect(statement, "sql");
  const rollbackSummary = hasRollback ? describeStatementEffect(statement, "rollback") : null;
  const useSummaryPreview = shouldUseSummaryPreview(statement);
  const previewSummaryEntries = useSummaryPreview ? buildPreviewSummaryEntries(statement, activeSalesId) : [];
  const previewWarning = typeof statement.preview?.warning === "string" ? statement.preview.warning : null;

  return (
    <Box borderWidth="1px" borderRadius="xl" p={5} shadow="sm" bg="white">
      <HStack justify="space-between" align="start">
        <Box>
          <Heading size="sm" color="gray.800">
            {title}
          </Heading>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Línea {statement.lineNumber ?? "—"}
          </Text>
        </Box>
        <Badge colorScheme={badge.color} variant="subtle">
          {badge.label}
        </Badge>
      </HStack>

      <VStack align="stretch" spacing={4} mt={4} fontSize="xs">
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontWeight="semibold" color="gray.600">
              SQL sugerido
            </Text>
            <IconButton
              size="sm"
              aria-label="Copiar SQL"
              icon={<HiClipboardCopy />}
              variant="ghost"
              onClick={() => copyText(statement.sql, toast)}
            />
          </HStack>
          <Code w="full" whiteSpace="pre-wrap" fontSize="xs" p={3} borderRadius="md" bg="gray.900" color="green.200">
            {statement.sql}
          </Code>
        </Box>

        <Alert status="warning" variant="subtle" borderRadius="md">
          <AlertIcon />
          <Text fontSize="xs" color="gray.700">
            {mainSummary}
          </Text>
        </Alert>

        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontWeight="semibold" color="gray.600">
              Rollback puntual
            </Text>
            <IconButton
              size="sm"
              aria-label="Copiar rollback"
              icon={<HiClipboardCopy />}
              variant="ghost"
              onClick={() => copyText(statement.rollbackSql, toast)}
            />
          </HStack>
          <Code w="full" whiteSpace="pre-wrap" fontSize="xs" p={3} borderRadius="md" bg="gray.800" color="orange.200">
            {statement.rollbackSql}
          </Code>
        </Box>

        {rollbackSummary && (
          <Alert status="info" variant="subtle" borderRadius="md">
            <AlertIcon />
            <Text fontSize="xs" color="gray.700">
              {rollbackSummary}
            </Text>
          </Alert>
        )}

        {statement.preview && (
          <Box borderWidth="1px" borderRadius="lg" p={3} bg="gray.50">
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={2}>
              Vista previa
            </Text>
            {useSummaryPreview ? (
              <>
                <Grid templateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap={3} fontSize="xs">
                  {previewSummaryEntries.map((entry) => (
                    <GridItem key={entry.label}>
                      <Text textTransform="uppercase" fontSize="10px" color="gray.500">
                        {entry.label}
                      </Text>
                      <Text color="gray.700" fontWeight="semibold">
                        {entry.value}
                      </Text>
                    </GridItem>
                  ))}
                </Grid>
                {previewWarning && (
                  <Text mt={3} fontSize="xs" color="orange.500" fontWeight="semibold">
                    {previewWarning}
                  </Text>
                )}
              </>
            ) : (
              <Grid templateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap={3} fontSize="xs">
                {Object.entries(statement.preview).map(([key, value]) => {
                  const formattedValue =
                    value === null || value === undefined
                      ? "—"
                      : typeof value === "object"
                        ? JSON.stringify(value, null, 2)
                        : String(value);
                  const isMultiline = formattedValue.includes("\n") || formattedValue.length > 50;
                  return (
                    <GridItem key={key}>
                      <Text textTransform="uppercase" fontSize="10px" color="gray.500">
                        {key}
                      </Text>
                      {isMultiline ? (
                        <Code display="block" whiteSpace="pre-wrap" fontSize="xs" p={2} borderRadius="md" bg="gray.900" color="blue.100">
                          {formattedValue}
                        </Code>
                      ) : (
                        <Text color="gray.700" fontWeight="semibold">
                          {formattedValue}
                        </Text>
                      )}
                    </GridItem>
                  );
                })}
              </Grid>
            )}
          </Box>
        )}
      </VStack>

      <ButtonGroup size="sm" spacing={3} mt={6} flexWrap="wrap">
        <Button
          colorScheme="purple"
          leftIcon={<HiLightningBolt />}
          onClick={() => onExecute?.(statement)}
          isDisabled={!isActionable || disableActions}
          isLoading={isSqlLoading}
          loadingText="Ejecutando"
        >
          Ejecutar SQL
        </Button>
        <Button
          variant="outline"
          colorScheme="orange"
          onClick={() => onRollback?.(statement)}
          isDisabled={!hasRollback || disableActions || forceRollbackDisabled}
          isLoading={isRollbackLoading}
          loadingText="Rollback"
        >
          Ejecutar rollback
        </Button>
      </ButtonGroup>
    </Box>
  );
}

export default function DataCorrectionModule({ salesId: initialSalesId = "", onPersistSalesId }) {
  const toast = useToast();
  const [salesId, setSalesId] = useState(initialSalesId);
  const normalizedSalesId = salesId.trim();

  useEffect(() => {
    setSalesId(initialSalesId);
  }, [initialSalesId]);

  const {
    data: corrections,
    refetch,
    isFetching,
    isFetched,
  } = useQuery({
    queryKey: ["corrections", normalizedSalesId],
    queryFn: async () => {
      if (!normalizedSalesId) throw new Error("SalesId requerido");
      const { data } = await api.get(`/api/snowflake/correcciones/${encodeURIComponent(normalizedSalesId)}`);
      return data;
    },
    enabled: false,
    retry: false,
    onSuccess: () => {
      if (normalizedSalesId && onPersistSalesId) {
        onPersistSalesId(normalizedSalesId);
      }
    },
    onError: (error) => {
      toast({
        title: "No se pudo generar la corrección",
        description: error?.response?.data?.message || error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    },
  });

  const actionableUpdates = useMemo(
    () => (corrections?.updates || []).filter((update) => update?.actionable !== false),
    [corrections]
  );

  const stats = useMemo(
    () => ({
      inserts: corrections?.inserts?.length || 0,
      updates: actionableUpdates.length,
    }),
    [corrections, actionableUpdates.length]
  );

  const [pendingAction, setPendingAction] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const cancelRef = useRef();
  const executionGuardRef = useRef(false);

  const executedSqlKeys = useMemo(() => {
    const keys = new Set();
    executionHistory.forEach((entry) => {
      if (entry.actionType === "sql") {
        const key = buildStatementKey(entry.statement);
        if (key) keys.add(key);
      }
    });
    return keys;
  }, [executionHistory]);

  const canRollbackStatement = (statement) => {
    if (!statement) return false;
    if (statement.kind !== "insert") return true;
    const key = buildStatementKey(statement);
    return key ? executedSqlKeys.has(key) : false;
  };

  const requestExecution = (statement, actionType) => {
    if (!statement) return;
    if (actionType === "sql" && (statement.actionable === false || statement.sql?.startsWith("-- No se generó"))) {
      toast({
        title: "No hay script ejecutable",
        description: "Esta línea es solo informativa y debe resolverse creando una nueva inserción.",
        status: "warning",
        duration: 4000,
        isClosable: true,
      });
      return;
    }
    const sqlText = actionType === "rollback" ? statement.rollbackSql : statement.sql;
    if (!sqlText || sqlText.startsWith("-- N/A")) {
      toast({
        title: "Operación no disponible",
        description: actionType === "rollback" ? "Este script no tiene rollback asociado." : "No se generó SQL para esta corrección.",
        status: "info",
        duration: 3500,
        isClosable: true,
      });
      return;
    }
    if (actionType === "rollback" && !canRollbackStatement(statement)) {
      toast({
        title: "Rollback bloqueado",
        description: "Ejecuta primero el INSERT para poder revertirlo.",
        status: "info",
        duration: 3500,
        isClosable: true,
      });
      return;
    }
    setPendingAction({ statement, actionType });
  };

  const executePendingAction = async () => {
    if (!pendingAction || executionGuardRef.current) return;
    const { statement, actionType } = pendingAction;
    const sqlText = actionType === "rollback" ? statement.rollbackSql : statement.sql;
    if (!sqlText) {
      toast({
        title: "SQL vacío",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setPendingAction(null);
      return;
    }

    executionGuardRef.current = true;
    setIsExecuting(true);
    try {
      const metadata = {
        kind: statement.kind,
        salesId: normalizedSalesId || null,
        lineNumber: statement.lineNumber ?? null,
        entryId: statement.entryId ?? statement.preview?.salesLinePk ?? null,
        reason: statement.reason ?? null,
        preview: statement.preview ?? null,
      };
      const { data } = await api.post("/api/snowflake/query-custom", {
        query: sqlText,
        rollbackSql: statement.rollbackSql ?? null,
        actionType,
        metadata,
      });
      toast({
        title: actionType === "rollback" ? "Rollback ejecutado" : "SQL ejecutado",
        description: data?.message || `Snowflake respondió con ${data?.count ?? 0} fila(s).`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      setExecutionHistory((prev) => {
        const snapshot = {
          kind: statement.kind,
          lineNumber: statement.lineNumber,
          entryId: statement.entryId,
          preview: statement.preview || null,
          sql: statement.sql,
          rollbackSql: statement.rollbackSql,
        };
        const historyEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          executedAt: new Date().toISOString(),
          actionType,
          statement: snapshot,
        };
        const next = [historyEntry, ...prev];
        return next.slice(0, 20);
      });
      await refetch();
    } catch (error) {
      toast({
        title: "Falló la ejecución",
        description: error?.response?.data?.message || error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      executionGuardRef.current = false;
      setIsExecuting(false);
      setPendingAction(null);
    }
  };

  const runAnalysis = () => {
    if (!normalizedSalesId) {
      toast({
        title: "SalesId requerido",
        description: "Ingresa el identificador del pedido que deseas corregir.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    refetch();
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Box bg="white" borderRadius="2xl" shadow="md" p={8} borderWidth="1px" borderColor="gray.100">
        <HStack justify="space-between" align="start">
          <Box>
            <Heading size="md" color="gray.800">
              Corrección asistida de datos
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Genera scripts de inserción o edición basados en las diferencias detectadas.
            </Text>
          </Box>
          <Badge colorScheme="purple" borderRadius="full" px={4} py={1.5} fontSize="sm">
            Beta
          </Badge>
        </HStack>
        <Stack direction={{ base: "column", md: "row" }} spacing={4} mt={6}>
          <InputGroup maxW="360px">
            <InputLeftAddon bg="gray.50" fontWeight="semibold">
              SalesId
            </InputLeftAddon>
            <Input
              placeholder="PAT-000000"
              value={salesId}
              onChange={(event) => setSalesId(event.target.value)}
              autoFocus
            />
          </InputGroup>
          <HStack spacing={3}>
            <Button
              colorScheme="purple"
              leftIcon={<HiLightningBolt />}
              onClick={runAnalysis}
              isLoading={isFetching}
            >
              Generar scripts
            </Button>
            {isFetched && (
              <Tooltip label="Recalcular con los mismos datos">
                <IconButton
                  aria-label="Recalcular"
                  icon={<HiRefresh />}
                  onClick={runAnalysis}
                  isLoading={isFetching}
                />
              </Tooltip>
            )}
          </HStack>
        </Stack>
        <Alert status="info" mt={6} borderRadius="xl">
          <AlertIcon />
          Los scripts no se ejecutan automáticamente. Debes darle a ejecutar SQL o ROLLBACK
        </Alert>
      </Box>

      {corrections && (
        <VStack align="stretch" spacing={6}>
          <Grid templateColumns={{ base: "repeat(1, 1fr)", md: "repeat(3, 1fr)" }} gap={4}>
            {[{
              label: "Inserts sugeridos",
              value: stats.inserts,
              color: "green",
            },
            {
              label: "Updates sugeridos",
              value: stats.updates,
              color: "orange",
            },
            {
              label: "Última generación",
              value: new Date(corrections.generatedAt).toLocaleString("es-AR"),
              color: "purple",
            }].map((card) => (
              <GridItem key={card.label}>
                <Box borderWidth="1px" borderRadius="xl" p={5} bg="white">
                  <Text fontSize="xs" color={`${card.color}.500`} textTransform="uppercase" fontWeight="bold">
                    {card.label}
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                    {card.label === "Última generación" ? card.value : card.value.toLocaleString("es-AR")}
                  </Text>
                </Box>
              </GridItem>
            ))}
          </Grid>

          {!!corrections.summary && (
            <Box borderWidth="1px" borderRadius="xl" p={5} bg="white">
              <Heading size="sm" color="gray.700" mb={4}>
                Resumen técnico
              </Heading>
              <Grid templateColumns={{ base: "repeat(1, 1fr)", md: "repeat(2, 1fr)" }} gap={4} fontSize="sm">
                <GridItem>
                  <Text color="gray.500">Líneas OData</Text>
                  <Text fontWeight="semibold">{corrections.summary.odataLineCount}</Text>
                </GridItem>
                <GridItem>
                  <Text color="gray.500">Líneas Snowflake</Text>
                  <Text fontWeight="semibold">{corrections.summary.snowflakeLineCount}</Text>
                </GridItem>
                <GridItem>
                  <Text color="gray.500">Faltan en Snowflake</Text>
                  <Text fontWeight="semibold">{corrections.summary.missingInSnowflake?.length || 0}</Text>
                </GridItem>
                <GridItem>
                  <Text color="gray.500">Diferencias de monto</Text>
                  <Text fontWeight="semibold">{corrections.summary.amountMismatches?.length || 0}</Text>
                </GridItem>
              </Grid>
            </Box>
          )}

          <Accordion allowMultiple borderRadius="xl" borderWidth="1px" bg="white">
            {[{
              key: "inserts",
              title: "Inserciones sugeridas",
              color: "green",
              badgeLabel: "INSERT",
              items: corrections.inserts || [],
            },
            {
              key: "updates",
              title: "Correcciones (UPDATE)",
              color: "orange",
              badgeLabel: "UPDATE",
              items: corrections.updates || [],
            }].map((section) => {
              const actionableItems = section.items.filter((item) => item?.actionable !== false);
              const actionableCount = actionableItems.length;
              const hasItems = section.items.length > 0;
              const badgeColor = actionableCount ? section.color : hasItems ? "yellow" : "gray";
              const badgeLabel = actionableCount
                ? `${actionableCount} script${actionableCount !== 1 ? "s" : ""}`
                : hasItems
                  ? `${section.items.length} aviso${section.items.length !== 1 ? "s" : ""}`
                  : "Sin sugerencias";
              return (
                <AccordionItem key={section.key} border="none">
                  <h2>
                    <AccordionButton _expanded={{ bg: `${section.color}.50` }} px={6} py={4}>
                      <Box flex="1" textAlign="left">
                        <Heading size="sm" color={`${section.color}.600`}>
                          {section.title}
                        </Heading>
                        {!hasItems && (
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            No se sugiere esta sección
                          </Text>
                        )}
                        {hasItems && !actionableCount && (
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Sin scripts ejecutables (solo avisos)
                          </Text>
                        )}
                      </Box>
                      <Badge colorScheme={badgeColor} mr={3}>
                        {badgeLabel}
                      </Badge>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel px={6} pb={6}>
                    {hasItems ? (
                      <VStack align="stretch" spacing={4}>
                        <Divider />
                        {section.items.map((statement, idx) => (
                          <StatementCard
                            key={`${section.key}-${idx}`}
                            title={section.key === "inserts" ? "Insertar línea de OData" : `Actualizar línea ${statement.lineNumber ?? ""}`}
                            badge={{
                              label: statement?.actionable === false ? "AVISO" : section.badgeLabel,
                              color: statement?.actionable === false ? "gray" : section.color,
                            }}
                            statement={statement}
                            toast={toast}
                            activeSalesId={normalizedSalesId}
                            onExecute={(stmt) => requestExecution(stmt, "sql")}
                            onRollback={(stmt) => requestExecution(stmt, "rollback")}
                            disableActions={isExecuting}
                            isSqlLoading={
                              isExecuting &&
                              pendingAction?.actionType === "sql" &&
                              pendingAction?.statement === statement
                            }
                            isRollbackLoading={
                              isExecuting &&
                              pendingAction?.actionType === "rollback" &&
                              pendingAction?.statement === statement
                            }
                            forceRollbackDisabled={!canRollbackStatement(statement)}
                          />
                        ))}
                      </VStack>
                    ) : (
                      <Box borderWidth="1px" borderRadius="lg" p={4} bg="gray.50">
                        <Text fontSize="sm" color="gray.600">
                          No hay acciones recomendadas para esta sección.
                        </Text>
                      </Box>
                    )}
                  </AccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>

          {stats.inserts === 0 && stats.updates === 0 && (
            <Box borderWidth="1px" borderRadius="xl" p={6} bg="white" textAlign="center">
              <Text fontWeight="semibold" color="gray.700">
                No se generaron scripts para este SalesId
              </Text>
              <Text fontSize="sm" color="gray.500" mt={2}>
                El pedido luce consistente entre OData y Snowflake.
              </Text>
            </Box>
          )}
        </VStack>
      )}

      {executionHistory.length > 0 && (
        <Box bg="white" borderRadius="2xl" shadow="md" p={6} borderWidth="1px" borderColor="gray.100">
              <HStack justify="space-between" align="start" mb={4} flexWrap="wrap" gap={3}>
                <Box>
                  <Heading size="sm" color="gray.800">
                    Historial de scripts ejecutados (sesión actual)
                  </Heading>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Conservamos una copia de cada SQL y su rollback para que puedas revertir aunque ya no existan diferencias.
                  </Text>
                </Box>
                <Button size="sm" variant="outline" colorScheme="gray" onClick={() => setExecutionHistory([])}>
                  Limpiar historial
                </Button>
              </HStack>
              <VStack align="stretch" spacing={4}>
                {executionHistory.map((entry) => {
                  const executedSql = entry.actionType === "rollback" ? entry.statement.rollbackSql : entry.statement.sql;
                  return (
                    <Box key={entry.id} borderWidth="1px" borderRadius="xl" p={5} bg="gray.50">
                      <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="gray.700">
                            {entry.statement.preview?.salesLinePk || entry.statement.entryId || `Línea ${entry.statement.lineNumber ?? "?"}`}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            Ejecutado el {new Date(entry.executedAt).toLocaleString("es-AR")}
                          </Text>
                        </Box>
                        <Badge colorScheme={entry.actionType === "rollback" ? "orange" : "purple"} alignSelf="flex-start">
                          {entry.actionType === "rollback" ? "Rollback" : "SQL aplicado"}
                        </Badge>
                      </HStack>
                      <Stack direction={{ base: "column", md: "row" }} spacing={4} mt={4}>
                        <Box flex="1">
                          <HStack justify="space-between" mb={2}>
                            <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                              SQL ejecutado
                            </Text>
                            <Button size="xs" leftIcon={<HiClipboardCopy />} onClick={() => copyText(executedSql, toast)}>
                              Copiar
                            </Button>
                          </HStack>
                          <Code w="full" whiteSpace="pre-wrap" fontSize="xs" p={3} borderRadius="md" bg="gray.900" color="green.100">
                            {executedSql}
                          </Code>
                        </Box>
                        {entry.statement.rollbackSql && (
                          <Box flex="1">
                            <HStack justify="space-between" mb={2}>
                              <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                                Rollback guardado
                              </Text>
                              <Button size="xs" variant="outline" leftIcon={<HiClipboardCopy />} onClick={() => copyText(entry.statement.rollbackSql, toast)}>
                                Copiar
                              </Button>
                            </HStack>
                            <Code w="full" whiteSpace="pre-wrap" fontSize="xs" p={3} borderRadius="md" bg="gray.800" color="orange.100">
                              {entry.statement.rollbackSql}
                            </Code>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </VStack>
            </Box>
        )}

      <AlertDialog
        isOpen={Boolean(pendingAction)}
        leastDestructiveRef={cancelRef}
        onClose={() => (isExecuting ? null : setPendingAction(null))}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent position="relative" overflow="hidden">
            {isExecuting && (
              <Box
                position="absolute"
                inset={0}
                bg="whiteAlpha.800"
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                zIndex={1}
              >
                <Spinner
                  size="lg"
                  color={pendingAction?.actionType === "rollback" ? "orange.400" : "purple.400"}
                  thickness="4px"
                />
                <Text mt={3} fontWeight="semibold" color="gray.700">
                  {pendingAction?.actionType === "rollback" ? "Ejecutando rollback" : "Ejecutando script"}
                </Text>
              </Box>
            )}
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {pendingAction?.actionType === "rollback" ? "Confirmar rollback" : "Confirmar ejecución"}
            </AlertDialogHeader>

            <AlertDialogBody opacity={isExecuting ? 0.4 : 1} pointerEvents={isExecuting ? "none" : "auto"}>
              <Text mb={4} color="gray.700">
                {describeStatementEffect(pendingAction?.statement, pendingAction?.actionType === "rollback" ? "rollback" : "sql")}
              </Text>
              <Text fontSize="sm" color="gray.500">
                Esta acción se ejecutará directamente en Snowflake usando la conexión del backend. Asegúrate de haber comunicado el cambio y de contar con una ventana operativa.
              </Text>
            </AlertDialogBody>

            <AlertDialogFooter opacity={isExecuting ? 0.4 : 1} pointerEvents={isExecuting ? "none" : "auto"}>
              <Button ref={cancelRef} onClick={() => setPendingAction(null)} disabled={isExecuting}>
                Cancelar
              </Button>
              <Button colorScheme={pendingAction?.actionType === "rollback" ? "orange" : "purple"} onClick={executePendingAction} ml={3} isLoading={isExecuting}>
                {pendingAction?.actionType === "rollback" ? "Sí, ejecutar rollback" : "Sí, ejecutar script"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
