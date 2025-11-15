# Consulta OData a Dynamics 365

Notebook para consultar la entidad `PdSalesVSCostProcesseds` de Dynamics 365 filtrando por `SALESID`.

## 🚀 Configuración Inicial

### 1. Crear archivo de configuración
Copia el archivo `.env.example` a `.env` y completa con tus credenciales:

```bash
copy .env.example .env
```

### 2. Configurar credenciales en `.env`

Edita el archivo `.env` con tus valores reales:

```env
CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CLIENT_SECRET=tu-secret-aqui
TOKEN_URL=https://login.microsoftonline.com/tu-tenant-id/oauth2/v2.0/token
SCOPE_URL=https://tu-instancia.operations.dynamics.com/.default
BASE_URL=https://tu-instancia.operations.dynamics.com/data
```

### 3. Ejecutar el notebook

Abre `d365_odata.ipynb` en Jupyter o VS Code y ejecuta las celdas en orden:

1. **Celda 1**: Carga configuración y valida variables
2. **Celda 2**: Define funciones de autenticación y consulta
3. **Celda 3**: Solicita SALESID y muestra resultados

## 📋 Uso

El notebook te pedirá ingresar un SALESID:

```
📝 Ingrese SALESID a consultar: TU-SALESID
```

Luego mostrará:
- ✅ Cantidad de registros encontrados
- 📊 Detalles de cada registro
- ❌ Errores si los hay

## 🔐 Autenticación

El sistema usa OAuth 2.0 con client credentials:
- Solicita un token a Azure AD
- Cachea el token por 1 hora
- Renueva automáticamente cuando expira

## 🔍 Filtrado OData

La consulta se construye así:

```
https://tu-instancia.operations.dynamics.com/data/PdSalesVSCostProcesseds?$filter=SalesId eq 'VALOR'
```

## ⚙️ Personalización

Puedes modificar en el `.env`:
- `ENTITY_NAME`: Nombre de la entidad a consultar
- `FILTER_FIELD`: Campo por el cual filtrar

## 🛡️ Seguridad

⚠️ **IMPORTANTE**: 
- Nunca subas el archivo `.env` a repositorios públicos
- El archivo `.gitignore` ya está configurado para excluirlo
- Usa `.env.example` como plantilla sin credenciales reales
