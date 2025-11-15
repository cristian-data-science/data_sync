import React from 'react';
import { IconButton, useColorMode, useColorModeValue } from '@chakra-ui/react';
import { HiSun, HiMoon } from 'react-icons/hi';

export default function ModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  const iconColor = useColorModeValue('gray.600', 'gray.300');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const isLight = colorMode === 'light';
  return (
    <IconButton
      aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      icon={isLight ? <HiMoon /> : <HiSun />}
      variant="ghost"
      size="sm"
      color={iconColor}
      _hover={{ bg: hoverBg }}
      onClick={toggleColorMode}
    />
  );
}
