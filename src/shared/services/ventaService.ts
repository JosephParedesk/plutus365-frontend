import api from './api'
import { useAuthStore } from '../store/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coinciden con Venta.java / VentaItem.java / FormaPago.java del backend (puerto 8087)

export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'MIXTO'

export interface VentaItem {
    itemId?: number
    sku: string
    nombreProducto: string
    cantidad: number
    precioUnitario: number
    descuento?: number
    valorTotal?: number
    // Tarifa de IVA del producto al momento de la venta — el backend la
    // recalcula siempre server-side, esto es solo para mostrarla en el carrito.
    tipoIva?: string
    valorIva?: number
}

export interface FormaPago {
    formaPagoId?: number
    metodo: MetodoPago
    valor: number
}

export interface Venta {
    ventaId: number
    numeroVenta: string
    clienteId?: number
    clienteNombre?: string
    fecha: string
    estado: 'REGISTRADA' | 'ANULADA'
    creadoPor?: string
    centroCostoId?: number
    centroCostoNombre?: string
    esObsequio?: boolean
    // Cartera: venta a crédito — coincide con Venta.java
    tieneCreditoCliente?: boolean
    fechaVencimientoCredito?: string
    saldoPendiente?: number
    items: VentaItem[]
    formasPago: FormaPago[]
    subtotal: number
    descuentoTotal?: number
    totalIva?: number
    total: number
}

export interface VentaRequest {
    clienteId?: number
    clienteNombre?: string
    items: VentaItem[]
    formasPago: FormaPago[]
    descuentoTotal?: number
    totalIva?: number
    centroCostoId?: number
    centroCostoNombre?: string
    esObsequio?: boolean
}

export interface FiltroVentas {
    clienteId?: number
    fechaInicio?: string
    fechaFin?: string
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
// Base: /api/pos/ventas  (VentaController.java)
// api.ts inyecta automáticamente Authorization y X-Empresa-Id en cada request

export const ventaService = {
    listar: () =>
        api.get<Venta[]>('/api/pos/ventas/listar'),

    buscar: (ventaId: number) =>
        api.get<Venta>(`/api/pos/ventas/buscar/${ventaId}`),

    filtrar: (params: FiltroVentas) =>
        api.get<Venta[]>('/api/pos/ventas/filtrar', { params }),

    // El backend descuenta stock en inventario-service sincrónicamente
    // antes de confirmar la venta. Si falla (sin stock, SKU inválido),
    // el error vuelve en error.response.data.message.
    registrar: (data: VentaRequest) => {
        const { usuario } = useAuthStore.getState()
        return api.post<Venta>('/api/pos/ventas/registrar', data, {
            headers: { 'X-Usuario-Nombre': usuario?.nombre || 'Sistema' }
        })
    },

    // Anular repone el stock de todos los ítems de la venta.
    anular: (ventaId: number) =>
        api.put(`/api/pos/ventas/anular/${ventaId}`),

    // Envía el comprobante de la venta al correo del cliente.
    // Es un resumen de compra, NO una factura electrónica DIAN
    // (eso requiere facturacion-service con Factus configurado).
    enviarComprobante: (ventaId: number, correo: string) =>
        api.post(`/api/pos/ventas/${ventaId}/enviar-comprobante`, { correo }),

    // HTML crudo del correo de comprobante, con datos de ejemplo y el logo/color
    // reales de la empresa — para la vista previa en Configuración.
    vistaPreviaCorreo: () =>
        api.get<string>('/api/pos/ventas/vista-previa-correo', { responseType: 'text' }),
}

// ─── Caja (apertura/cierre de turno) ───────────────────────────────────────────

export interface CajaSesion {
    cajaId: number
    empresaId: string
    fechaApertura: string
    fechaCierre?: string
    montoApertura: number
    montoCierreDeclarado?: number
    montoCierreCalculado?: number
    diferencia?: number
    totalVentasEfectivo?: number
    totalVentasOtros?: number
    numeroVentas?: number
    estado: 'ABIERTA' | 'CERRADA'
    usuarioApertura?: string
    usuarioCierre?: string
    observaciones?: string
}

export interface ResumenCaja {
    efectivoEsperado: number
    totalEfectivo: number
    totalOtros: number
    numeroVentas: number
}

export const cajaService = {
    // 204 sin cuerpo si no hay caja abierta — el frontend debe manejar ese caso
    actual: () =>
        api.get<CajaSesion>('/api/pos/ventas/caja/actual'),

    esperado: () =>
        api.get<ResumenCaja>('/api/pos/ventas/caja/esperado'),

    historial: () =>
        api.get<CajaSesion[]>('/api/pos/ventas/caja/historial'),

    abrir: (montoApertura: number) =>
        api.post<CajaSesion>('/api/pos/ventas/caja/abrir', { montoApertura }),

    cerrar: (montoDeclarado: number, observaciones?: string) =>
        api.put<CajaSesion>('/api/pos/ventas/caja/cerrar', { montoDeclarado, observaciones }),
}

// ─── Cotizaciones ─────────────────────────────────────────────────────────────
// Una cotización NO mueve inventario ni contabilidad; solo al convertirla en venta.

export type EstadoCotizacion = 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA' | 'CONVERTIDA'

export interface Cotizacion {
    cotizacionId?: number
    numeroCotizacion?: string
    clienteId?: number
    clienteNombre?: string
    clienteCorreo?: string
    fecha?: string
    fechaVencimiento?: string
    estado?: EstadoCotizacion
    items: VentaItem[]
    subtotal?: number
    descuentoTotal?: number
    totalIva?: number
    total?: number
    centroCostoId?: number
    centroCostoNombre?: string
    lugarEmision?: string
    contactoNombre?: string
    contactoCargo?: string
    formaPago?: string
    tiempoEntrega?: string
    lugarEntrega?: string
    transporte?: string
    tiempoFabricacion?: string
    instalacion?: string
    capacitacion?: string
    garantiaTiempo?: string
    garantiaCubre?: string
    garantiaNoCubre?: string
    garantiaComoHacerEfectiva?: string
    observaciones?: string
    asesorNombre?: string
    asesorCargo?: string
    asesorTelefono?: string
    asesorCorreo?: string
    ventaGeneradaId?: number
    creadoPor?: string
}

export const cotizacionService = {
    listar: () => api.get<Cotizacion[]>('/api/pos/ventas/cotizaciones'),
    filtrar: (fechaInicio: string, fechaFin: string) =>
        api.get<Cotizacion[]>('/api/pos/ventas/cotizaciones/filtrar', { params: { fechaInicio, fechaFin } }),
    buscar: (id: number) => api.get<Cotizacion>(`/api/pos/ventas/cotizaciones/${id}`),
    crear: (data: Cotizacion) => api.post<Cotizacion>('/api/pos/ventas/cotizaciones', data),
    actualizar: (id: number, data: Partial<Cotizacion>) =>
        api.put<Cotizacion>(`/api/pos/ventas/cotizaciones/${id}`, data),
    cambiarEstado: (id: number, estado: EstadoCotizacion) =>
        api.put<Cotizacion>(`/api/pos/ventas/cotizaciones/${id}/estado`, { estado }),
    convertir: (id: number, formasPago: FormaPago[]) =>
        api.post<Venta>(`/api/pos/ventas/cotizaciones/${id}/convertir`, formasPago),
}

export const COLOR_ESTADO_COTIZACION: Record<EstadoCotizacion, string> = {
    BORRADOR: 'default', ENVIADA: 'blue', APROBADA: 'green',
    RECHAZADA: 'red', VENCIDA: 'orange', CONVERTIDA: 'purple',
}

// ─── Facturas recurrentes ─────────────────────────────────────────────────────
// El sistema NO genera las ventas solo: cuando llega la fecha quedan pendientes
// y el usuario confirma. Así ninguna venta afecta inventario/contabilidad sin revisión.

export type Periodicidad = 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

export interface FacturaRecurrente {
    recurrenteId?: number
    nombre: string
    clienteId?: number
    clienteNombre?: string
    clienteCorreo?: string
    items: VentaItem[]
    descuentoTotal?: number
    totalIva?: number
    total?: number
    periodicidad: Periodicidad
    diaGeneracion?: number
    fechaInicio?: string
    fechaFin?: string
    proximaGeneracion?: string
    ultimaGeneracion?: string
    vecesGeneradas?: number
    activa?: boolean
    centroCostoId?: number
    centroCostoNombre?: string
    metodoPagoPredeterminado?: string
    observaciones?: string
    creadoPor?: string
}

export const recurrenteService = {
    listar: () => api.get<FacturaRecurrente[]>('/api/pos/ventas/recurrentes'),
    pendientes: () => api.get<FacturaRecurrente[]>('/api/pos/ventas/recurrentes/pendientes'),
    crear: (data: FacturaRecurrente) => api.post<FacturaRecurrente>('/api/pos/ventas/recurrentes', data),
    actualizar: (id: number, data: Partial<FacturaRecurrente>) =>
        api.put<FacturaRecurrente>(`/api/pos/ventas/recurrentes/${id}`, data),
    cambiarEstado: (id: number, activa: boolean) =>
        api.put<FacturaRecurrente>(`/api/pos/ventas/recurrentes/${id}/estado`, { activa }),
    generar: (id: number) => api.post<Venta>(`/api/pos/ventas/recurrentes/${id}/generar`, {}),
    eliminar: (id: number) => api.delete(`/api/pos/ventas/recurrentes/${id}`),
}

export const PERIODICIDAD_LABEL: Record<Periodicidad, string> = {
    MENSUAL: 'Mensual', BIMESTRAL: 'Cada 2 meses', TRIMESTRAL: 'Cada 3 meses',
    SEMESTRAL: 'Cada 6 meses', ANUAL: 'Anual',
}

// ─── Remisión ───────────────────────────────────────────────────────────────
// Constancia de que la mercancía salió del negocio, sin factura formal
// todavía. NO mueve inventario ni contabilidad hasta que se convierte en
// venta (igual que Cotización) — ver RemisionUseCase en el backend.

export type EstadoRemision = 'BORRADOR' | 'ENTREGADA' | 'FACTURADA' | 'ANULADA'

export interface Remision {
    remisionId?: number
    numeroRemision?: string
    clienteId?: number
    clienteNombre?: string
    fecha?: string
    estado?: EstadoRemision
    items: VentaItem[]
    subtotal?: number
    descuentoTotal?: number
    totalIva?: number
    total?: number
    centroCostoId?: number
    centroCostoNombre?: string
    lugarEntrega?: string
    transportador?: string
    observaciones?: string
    ventaGeneradaId?: number
    creadoPor?: string
}

export const remisionService = {
    listar: () => api.get<Remision[]>('/api/pos/ventas/remisiones'),
    filtrar: (fechaInicio: string, fechaFin: string) =>
        api.get<Remision[]>('/api/pos/ventas/remisiones/filtrar', { params: { fechaInicio, fechaFin } }),
    buscar: (id: number) => api.get<Remision>(`/api/pos/ventas/remisiones/${id}`),
    crear: (data: Remision) => api.post<Remision>('/api/pos/ventas/remisiones', data),
    actualizar: (id: number, data: Partial<Remision>) =>
        api.put<Remision>(`/api/pos/ventas/remisiones/${id}`, data),
    cambiarEstado: (id: number, estado: EstadoRemision) =>
        api.put<Remision>(`/api/pos/ventas/remisiones/${id}/estado`, { estado }),
    convertir: (id: number, formasPago: FormaPago[]) =>
        api.post<Venta>(`/api/pos/ventas/remisiones/${id}/convertir`, formasPago),
}

export const COLOR_ESTADO_REMISION: Record<EstadoRemision, string> = {
    BORRADOR: 'default', ENTREGADA: 'blue', FACTURADA: 'green', ANULADA: 'red',
}

// ─── Nota débito de ventas ──────────────────────────────────────────────────
// Aumenta lo que un cliente debe sobre una venta ya registrada (cargo
// adicional, interés de mora, ajuste). Espejo, del lado de cartera de
// clientes, de la Nota Débito que ya existe en Compras para proveedores.
//
// v1 solo ajusta Venta.saldoPendiente — todavía no genera su propio asiento
// contable (eso requiere un endpoint nuevo en contabilidad-service, queda
// pendiente a propósito). Ver NotaDebitoVentaUseCase en el backend.

export interface NotaDebitoVenta {
    notaDebitoId?: number
    numeroNotaDebito?: string
    ventaReferenciaId: number
    numeroVentaReferencia?: string
    clienteId?: number
    clienteNombre?: string
    fecha?: string
    concepto: string
    valor: number
    estado?: 'REGISTRADA' | 'ANULADA'
    observaciones?: string
    creadoPor?: string
}

export const notaDebitoVentaService = {
    listar: () => api.get<NotaDebitoVenta[]>('/api/pos/ventas/notas-debito'),
    filtrar: (fechaInicio: string, fechaFin: string) =>
        api.get<NotaDebitoVenta[]>('/api/pos/ventas/notas-debito/filtrar', { params: { fechaInicio, fechaFin } }),
    buscar: (id: number) => api.get<NotaDebitoVenta>(`/api/pos/ventas/notas-debito/${id}`),
    registrar: (data: NotaDebitoVenta) => api.post<NotaDebitoVenta>('/api/pos/ventas/notas-debito', data),
    anular: (id: number) => api.delete(`/api/pos/ventas/notas-debito/${id}`),
}

// ─── Recibo de caja ─────────────────────────────────────────────────────────
// Abono de un cliente a una o varias facturas a crédito, o anticipo sin
// factura todavía. Espejo del "Recibo de pago" que ya existe en Compras.
// Backend ya construido (ReciboCajaController); esto es lo que le faltaba
// al frontend.

export type TipoReciboCaja = 'ABONO_CARTERA' | 'ANTICIPO'
export type OrigenDineroRecibo = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CHEQUE'

export interface AplicacionCobro {
    ventaId: number
    numeroVenta?: string
    saldoAnterior?: number
    valorAplicado: number
    saldoNuevo?: number
}

export interface ReciboCaja {
    reciboId?: number
    numeroRecibo?: string
    clienteId?: number
    clienteNombre?: string
    fecha?: string
    fechaRecibido?: string
    tipoRecibo?: TipoReciboCaja
    origenDinero?: OrigenDineroRecibo
    bancoDestino?: string
    referenciaPago?: string
    aplicaciones?: AplicacionCobro[]
    totalRecibido: number
    estado?: 'REGISTRADO' | 'ANULADO' | 'ERROR_CONTABILIZACION'
    observaciones?: string
    creadoPor?: string
}

export const reciboCajaService = {
    listar: () => api.get<ReciboCaja[]>('/api/pos/ventas/recibos-caja'),
    filtrar: (fechaInicio: string, fechaFin: string) =>
        api.get<ReciboCaja[]>('/api/pos/ventas/recibos-caja/filtrar', { params: { fechaInicio, fechaFin } }),
    // Facturas del cliente (o de todos, si no se indica) que aún tienen saldo por cobrar.
    cartera: (clienteId?: number) =>
        api.get<Venta[]>('/api/pos/ventas/recibos-caja/cartera', { params: clienteId ? { clienteId } : {} }),
    buscar: (id: number) => api.get<ReciboCaja>(`/api/pos/ventas/recibos-caja/${id}`),
    registrar: (data: ReciboCaja) => api.post<ReciboCaja>('/api/pos/ventas/recibos-caja', data),
    anular: (id: number) => api.delete(`/api/pos/ventas/recibos-caja/${id}`),
}

export const TIPO_RECIBO_CAJA_LABEL: Record<TipoReciboCaja, string> = {
    ABONO_CARTERA: 'Abono a factura(s)', ANTICIPO: 'Anticipo (sin factura)',
}
export const ORIGEN_DINERO_LABEL: Record<OrigenDineroRecibo, string> = {
    EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta', CHEQUE: 'Cheque',
}

// ─── Configuración del recibo impreso del POS ────────────────────────────────
// GET siempre devuelve algo (valores por defecto si la empresa nunca la
// personalizó) — el recibo tiene que poder imprimirse desde el día uno.

export type AnchoPapel = '58MM' | '80MM'
export type TamanioFuenteRecibo = 'PEQUENA' | 'NORMAL' | 'GRANDE'

export interface ConfiguracionRecibo {
    empresaId?: string
    anchoPapel: AnchoPapel
    tamanioFuente: TamanioFuenteRecibo
    mensajePie: string
    mostrarLogo: boolean
    mostrarDireccionEmpresa: boolean
    mostrarAtendidoPor: boolean
}

export const configuracionReciboService = {
    obtener: () => api.get<ConfiguracionRecibo>('/api/pos/ventas/configuracion-recibo'),
    guardar: (data: ConfiguracionRecibo) => api.put<ConfiguracionRecibo>('/api/pos/ventas/configuracion-recibo', data),
}
