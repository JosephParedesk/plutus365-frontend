import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import esES from 'antd/locale/es_ES'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import { obtenerAntdTheme } from './shared/theme/antdTheme'
import { useThemeStore } from './shared/store/themeStore'
import LoginPage from './modules/auth/LoginPage'
import RestablecerContrasenaPage from './modules/auth/RestablecerContrasenaPage'
import DashboardLayout from './shared/components/DashboardLayout'
import DashboardPage from './modules/dashboard/DashboardPage'
import ProtectedRoute from './router/ProtectedRoute'
import InventarioPage from './modules/inventory/InventarioPage'
import ClientesPage from './modules/clients/ClientesPage'
import VentasPage from './modules/sales/VentasPage'
import CotizacionesPage from './modules/sales/CotizacionesPage'
import RecurrentesPage from './modules/sales/RecurrentesPage'
import FacturasVentaPage from './modules/sales/FacturasVentaPage'
import RecibosCajaPage from './modules/sales/RecibosCajaPage'
import RemisionesPage from './modules/sales/RemisionesPage'
import NotasDebitoPage from './modules/sales/NotasDebitoPage'
import ConfiguracionPage from './modules/settings/ConfiguracionPage'
import FacturacionPage from './modules/billing/FacturacionPage'
import NuevaFacturaDirectaPage from './modules/billing/NuevaFacturaDirectaPage'
import NotasCreditoPage from './modules/billing/NotasCreditoPage'
import NotaDebitoElectronicaPage from './modules/billing/NotaDebitoElectronicaPage'
import ReportesPage from './modules/reports/ReportesPage'
import NominaPage from './modules/payroll/NominaPage'
import EmpleadosPage from './modules/payroll/EmpleadosPage'
import AcumuladosInicialesPage from './modules/payroll/AcumuladosInicialesPage'
import ProveedoresPage from './modules/purchases/ProveedoresPage'
import ComprasPage from './modules/purchases/ComprasPage'
import DocumentosSoportePage from './modules/purchases/DocumentosSoportePage'
import RecepcionDocumentosPage from './modules/purchases/RecepcionDocumentosPage'
import NuevaCompraPage from './modules/purchases/NuevaCompraPage'
import VerCompraPage from './modules/purchases/VerCompraPage'
import CuentaContablePage from './modules/accounting/CuentaContablePage'
import AsientosContablesPage from './modules/accounting/AsientosContablesPage'
import EstadosFinancierosPage from './modules/accounting/EstadosFinancierosPage'
import CentrosCostoPage from './modules/accounting/CentrosCostoPage'
import AdminEmpresasPage from './modules/admin/AdminEmpresasPage'

// Sin esto, AntD (tooltips de orden en tablas, paginación, DatePicker) y dayjs
// (nombres de mes/día del calendario) salen en inglés por defecto.
dayjs.locale('es')

function App() {
  const modo = useThemeStore(s => s.modo)
  return (
    <ConfigProvider theme={obtenerAntdTheme(modo)} locale={esES}>
      <AntApp>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          {/* planes/registro/pago deshabilitados temporalmente (2026-09-11):
              por ahora solo se permite iniciar sesión. */}
          <Route path="/planes" element={<Navigate to="/login" />} />
          <Route path="/registro" element={<Navigate to="/login" />} />
          <Route path="/pago" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/restablecer-contrasena" element={<RestablecerContrasenaPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/ventas" element={<VentasPage />} />
              <Route path="/ventas/cotizaciones" element={<CotizacionesPage />} />
              <Route path="/ventas/recurrentes" element={<RecurrentesPage />} />
              <Route path="/facturas/ventas" element={<FacturasVentaPage />} />
              <Route path="/facturas/recibos-caja" element={<RecibosCajaPage />} />
              <Route path="/facturas/remisiones" element={<RemisionesPage />} />
              <Route path="/facturas/notas-debito" element={<NotasDebitoPage />} />
              <Route path="/inventario" element={<InventarioPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/compras/proveedores" element={<ProveedoresPage />} />
              <Route path="/compras" element={<ComprasPage />} />
              <Route path="/compras/documentos-soporte" element={<DocumentosSoportePage />} />
              <Route path="/compras/recepcion-documentos" element={<RecepcionDocumentosPage />} />
              <Route path="/compras/nueva" element={<NuevaCompraPage />} />
              <Route path="/compras/ver/:compraId" element={<VerCompraPage />} />
              <Route path="/contabilidad" element={<CuentaContablePage />} />
              <Route path="/contabilidad/asientos" element={<AsientosContablesPage />} />
              <Route path="/contabilidad/estados-financieros" element={<EstadosFinancierosPage />} />
              <Route path="/contabilidad/centros-costo" element={<CentrosCostoPage />} />
              <Route path="/facturacion" element={<FacturacionPage />} />
              <Route path="/facturacion/nueva" element={<NuevaFacturaDirectaPage />} />
              <Route path="/facturacion/notas-credito" element={<NotasCreditoPage />} />
              <Route path="/facturacion/notas-debito" element={<NotaDebitoElectronicaPage />} />
              <Route path="/reportes" element={<ReportesPage />} />
              <Route path="/nomina" element={<NominaPage />} />
              <Route path="/nomina/empleados" element={<EmpleadosPage />} />
              <Route path="/nomina/acumulados-iniciales" element={<AcumuladosInicialesPage />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
              <Route path="/admin/empresas" element={<AdminEmpresasPage />} />
            </Route>
          </Route>
        </Routes>
      </AntApp>
    </ConfigProvider>
  )
}

export default App