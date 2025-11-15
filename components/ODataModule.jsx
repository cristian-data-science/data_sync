import React, { useState, useMemo } from 'react';
import {
  Box,
  Heading,
  Text,
  Input,
  Button,
  HStack,
  VStack,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Spinner,
  useToast,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Badge,
  Divider,
  InputGroup,
  InputLeftElement,
  useColorModeValue,
} from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { HiSearch, HiPencilAlt, HiX, HiCheck } from 'react-icons/hi';

const api = axios.create({ baseURL: '/api' });

function useSearch(salesId, enabled) {
  return useQuery({
    queryKey: ['search', salesId],
    queryFn: async () => {
      if (!salesId) return { value: [] };
      const { data } = await api.get(`/odata/search`, { params: { salesId } });
      return data;
    },
    enabled: enabled && !!salesId,
  });
}

function EditDrawer({ isOpen, onClose, record, onSave }) {
  const [local, setLocal] = useState(record || {});
  const fields = useMemo(
    () => Object.keys(record || {}).filter((k) => !k.startsWith('@') && typeof record[k] !== 'object'),
    [record]
  );

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="lg">
      <DrawerOverlay backdropFilter="blur(2px)" />
      <DrawerContent>
        <DrawerHeader borderBottomWidth="1px" fontSize="xl" fontWeight="bold">
          <HStack>
            <Box p={2} bg="blue.50" borderRadius="lg">
              <HiPencilAlt size={20} color="#3182CE" />
            </Box>
            <Text>Editar Registro</Text>
          </HStack>
        </DrawerHeader>
        <DrawerBody py={6}>
          <VStack spacing={5} align="stretch">
            {fields.map((k) => (
              <Box key={k}>
                <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={2}>
                  {k}
                </Text>
                <Input value={local[k] ?? ''} onChange={(e) => setLocal({ ...local, [k]: e.target.value })} size="md" borderRadius="lg" _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px #3182CE' }} />
              </Box>
            ))}
          </VStack>
        </DrawerBody>
        <DrawerFooter borderTopWidth="1px" gap={3}>
          <Button variant="outline" onClick={onClose} leftIcon={<HiX />} size="lg">
            Cancelar
          </Button>
          <Button colorScheme="blue" onClick={() => onSave(local)} leftIcon={<HiCheck />} size="lg">
            Guardar Cambios
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function ODataModule() {
  const toast = useToast();
  const qc = useQueryClient();
  const [salesId, setSalesId] = useState('');
  const [searchTrigger, setSearchTrigger] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const { data, isFetching } = useSearch(salesId, searchTrigger);

  const handleSearch = () => {
    if (!salesId.trim()) return;
    setSearchTrigger(true);
    qc.invalidateQueries({ queryKey: ['search', salesId] });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.patch(`/odata/update`, payload);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Cambios guardados', status: 'success' });
      qc.invalidateQueries({ queryKey: ['search', salesId] });
    },
    onError: (err) => {
      toast({ title: 'Error al guardar', description: err?.response?.data?.text || err.message, status: 'error' });
    },
  });

  const onEdit = (rec) => {
    setSelected(rec);
    setOpen(true);
  };

  const onSave = (local) => {
    setOpen(false);
    const changes = {};
    Object.keys(local).forEach((k) => {
      if (local[k] !== selected[k]) changes[k] = local[k];
    });
    mutation.mutate({ salesId: selected?.SalesId || selected?.SALESID || salesId, changes });
  };

  const rows = data?.value || [];
  const columns = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).filter((k) => !k.startsWith('@') && typeof rows[0][k] !== 'object');
  }, [rows]);

  const cardBg = useColorModeValue('white', 'gray.800');
  const subtleBg = useColorModeValue('gray.50', 'gray.700');
  const borderCol = useColorModeValue('gray.100', 'gray.700');
  const borderColStrong = useColorModeValue('gray.200', 'gray.600');
  const textPrimary = useColorModeValue('gray.800', 'gray.100');
  const textSecondary = useColorModeValue('gray.600', 'gray.300');
  const textMuted = useColorModeValue('gray.500', 'gray.400');

  return (
    <VStack align="stretch" spacing={6}>
      <Box bg={cardBg} borderRadius="2xl" shadow="md" p={8} borderWidth="1px" borderColor={borderCol}>
        <VStack align="stretch" spacing={4}>
          <HStack>
            <Box p={3} bg="blue.50" borderRadius="xl">
              <HiSearch size={24} color="#3182CE" />
            </Box>
            <Box>
              <Heading size="md" color={textPrimary}>
                Buscar por Sales ID
              </Heading>
              <Text fontSize="sm" color={textMuted}>
                Ingrese el identificador para consultar registros
              </Text>
            </Box>
          </HStack>

          <Divider borderColor={borderColStrong} />

          <HStack spacing={4}>
            <InputGroup size="lg" flex={1}>
              <InputLeftElement pointerEvents="none">
                <HiSearch color="#A0AEC0" size={20} />
              </InputLeftElement>
              <Input placeholder="Ej: PAT-001260898" value={salesId} onChange={(e) => setSalesId(e.target.value)} onKeyDown={handleKeyDown} borderRadius="xl" borderWidth="2px" _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px #3182CE' }} />
            </InputGroup>
            <Button colorScheme="blue" size="lg" onClick={handleSearch} isDisabled={!salesId.trim() || isFetching} isLoading={isFetching} px={10} borderRadius="xl" shadow="md" _hover={{ transform: 'translateY(-2px)', shadow: 'lg' }} transition="all 0.2s">
              Buscar
            </Button>
          </HStack>
        </VStack>
      </Box>

      <Box bg={cardBg} borderRadius="2xl" shadow="md" borderWidth="1px" borderColor={borderCol} overflow="hidden">
        {isFetching ? (
          <VStack py={16} spacing={4}>
            <Spinner size="xl" color="blue.500" thickness="4px" />
            <Text fontSize="lg" fontWeight="medium" color={textSecondary}>
              Consultando Dynamics 365...
            </Text>
          </VStack>
        ) : rows.length ? (
          <>
            <HStack justify="space-between" px={8} py={5} borderBottomWidth="1px" borderColor={borderColStrong}>
              <HStack>
                <Heading size="md" color={textPrimary}>
                  Resultados
                </Heading>
                <Badge colorScheme="blue" fontSize="md" px={4} py={1.5} borderRadius="full">
                  {rows.length} registro{rows.length !== 1 ? 's' : ''}
                </Badge>
              </HStack>
            </HStack>
            <Box maxH="500px" overflowY="auto" overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead position="sticky" top={0} bg={subtleBg} zIndex={1}>
                  <Tr>
                    {columns.map((c) => (
                      <Th key={c} textTransform="none" fontSize="xs" fontWeight="bold" color={textPrimary} py={4}>
                        {c}
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((r, i) => (
                    <Tr key={i} _hover={{ bg: subtleBg }} transition="background 0.2s">
                      {columns.map((c) => (
                        <Td key={c} fontSize="sm" color={textPrimary}>
                          {String(r[c] ?? '')}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </>
        ) : (
          <VStack py={20} spacing={4}>
            <Box p={6} bg={useColorModeValue('gray.100','gray.700')} borderRadius="full">
              <HiSearch size={48} color="#A0AEC0" />
            </Box>
            <VStack spacing={2}>
              <Text fontSize="lg" fontWeight="semibold" color={textPrimary}>
                {searchTrigger ? 'No se encontraron registros' : 'Comienza tu búsqueda'}
              </Text>
              <Text fontSize="sm" color={textMuted}>
                {searchTrigger ? 'Intenta con otro Sales ID' : 'Ingresa un Sales ID y presiona Buscar'}
              </Text>
            </VStack>
          </VStack>
        )}
      </Box>
      <EditDrawer isOpen={open} onClose={() => setOpen(false)} record={selected} onSave={onSave} />
    </VStack>
  );
}

export default ODataModule;
