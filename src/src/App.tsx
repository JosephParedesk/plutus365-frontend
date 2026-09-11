import { Routes, Route, Navigate } from 'react-router-dom'
import PlanesPage from './modules/auth/PlanesPage'
import RegistroPage from './modules/auth/RegistroPage'
import PagoPage from './modules/auth/PagoPage'
import LoginPage from './modules/auth/LoginPage'
import DashboardLayout from './shared/components/DashboardLayout'
import DashboardPage from './modules/dashboard/DashboardPage'
import ProtectedRoute from './router/ProtectedRoute'
import InventarioPage from './modules/inventory/InventarioPage'
import ClientesPage from './modules/clients/ClientesPage'
import VentasPage from './modules/sales/VentasPage'
import CotizacionesPage from './modules/sales/CotizacionesPage'
import RecurrentesPage from './modules/sales/RecurrentesPage'
import ConfiguracionPage from './modules/settings/ConfiguracionPage'
import FacturacionPage from './modules/billing/FacturacionPage'
import NotasCreditoPage from './modules/billing/NotasCreditoPage'
import ReportesPage from './modules/reports/ReportesPage'
import NominaPage from './modules/payroll/NominaPage'
import EmpleadosPage from './modules/payroll/EmpleadosPage'
import AcumuladosInicialesPage from './modules/payroll/AcumuladosInicialesPage'
import ProveedoresPage from './modules/purchases/ProveedoresPage'
import ComprasPage from './modules/purchases/ComprasPage'
import NuevaCompraPage from './modules/purchases/NuevaCompraPage'
import VerCompraPage from './modules/purchases/VerCompraPage'
import CuentaContablePage from './modules/accounting/CuentaContablePage'
import AsientosContablesPage from './modules/accounting/AsientosContablesPage'
import EstadosFinancierosPage from './modules/accounting/EstadosFinancierosPage'
import CentrosCostoPage from './modules/accounting/CentrosCostoPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/planes" element={<PlanesPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/pago" element={<PagoPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ventas" element={<VentasPage />} />
          <Route path="/ventas/cotizaciones" element={<CotizacionesPage />} />
          <Route path="/ventas/recurrentes" element={<RecurrentesPage />} />
          <Route path="/inventario" element={<InventarioPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/compras/proveedores" element={<ProveedoresPage />} />
          <Route path="/compras" element={<ComprasPage />} />
          <Route path="/compras/nueva" element={<NuevaCompraPage />} />
          <Route path="/compras/ver/:compraId" element={<VerCompraPage />} />
          <Route path="/contabilidad" element={<CuentaContablePage />} />
          <Route path="/contabilidad/asientos" element={<AsientosContablesPage />} />
          <Route path="/contabilidad/estados-financieros" element={<EstadosFinancierosPage />} />
          <Route path="/contabilidad/centros-costo" element={<CentrosCostoPage />} />
          <Route path="/facturacion" element={<FacturacionPage />} />
          <Route path="/facturacion/notas-credito" element={<NotasCreditoPage />} />
          <Route path="/reportes" element={<ReportesPage />} />
          <Route path="/nomina" element={<NominaPage />} />
          <Route path="/nomina/empleados" element={<EmpleadosPage />} />
          <Route path="/nomina/acumulados-iniciales" element={<AcumuladosInicialesPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App