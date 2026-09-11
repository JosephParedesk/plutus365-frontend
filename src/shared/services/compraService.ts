import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coinciden exactamente con Compra.java, CompraItem.java y FormaPago.java del backend

export type TipoTransaccion =
  | 'FACTURA_COMPRA'              // FC-1: factura de compra/gasto normal
  | 'DOCUMENTO_SOPORTE'           // FC-12: compras a proveedores no obligados a facturar
  | 'FACTURA_COMPRA_ELECTRONICA'  // FC-2: factura electrónica recibida del proveedor
  | 'ORDEN_COMPRA'                // Orden de compra (aún no genera obligación de pago)
  | 'RECIBO_PAGO'                 // RP-1: abono a deuda / anticipo, aplica sobre una compra fuente
  | 'NOTA_DEBITO'                 // ND-1: nota débito / ajuste, aumenta lo que se debe
  | 'AJUSTE_CARTERA'              // Ajuste manual de cartera/proveedores

export type EstadoCompra = 'BORRADOR' | 'REGISTRADA' | 'ANULADA'
export type TipoItem = 'ACTIVO_FIJO' | 'PRODUCTO' | 'GASTO_CUENTA'
export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO_PROVEEDOR'

// Tipos "fuente": generan una obligación de pago con el proveedor.
export const TIPOS_FUENTE: TipoTransaccion[] = ['FACTURA_COMPRA', 'DOCUMENTO_SOPORTE', 'FACTURA_COMPRA_ELECTRONICA']
// Tipos que aplican sobre un documento fuente ya existente (piden compraReferenciaId).
export const TIPOS_REFERENCIA: TipoTransaccion[] = ['RECIBO_PAGO', 'NOTA_DEBITO', 'AJUSTE_CARTERA']

export interface CompraItem {
  itemId?: number
  tipo: TipoItem
  productoSku?: string
  cuentaContableCodigo?: string   // solo aplica cuando tipo = GASTO_CUENTA
  descripcion: string
  cantidad: number
  valorUnitario: number
  descuento?: number
  impuestoCargo?: string
  impuestoRetencion?: string
  valorTotal?: number
}

export interface FormaPago {
  formaPagoId?: number
  metodo: MetodoPago
  valor: number
  fechaVencimiento?: string   // yyyy-MM-dd, solo si metodo = CREDITO_PROVEEDOR
}

export interface AplicacionPago {
  compraReferenciaId: number
  valorAplicado: number
}

export type TipoRecibo = 'ABONO_DEUDA' | 'ANTICIPO' | 'AVANZADO'

export interface Compra {
  compraId?: number
  empresaId?: string
  tipoTransaccion: TipoTransaccion
  numeroComprobante?: string
  facturaProveedor?: string   // número de factura del proveedor (distinto al nuestro)
  cufeProveedor?: string      // CUFE de la factura electrónica del proveedor, si la tiene
  centroCostoId?: number
  centroCostoNombre?: string
  proveedorId: number
  proveedorNombre?: string
  fechaElaboracion?: string // ISO yyyy-MM-dd
  creadoPor?: string
  sucursal?: string
  estado?: EstadoCompra
  totalBruto?: number
  totalDescuentos?: number
  subtotal?: number
  totalIva?: number
  totalRetencion?: number
  totalPagar?: number
  items: CompraItem[]
  formasPago: FormaPago[]

  // Cuentas por pagar
  tieneCreditoProveedor?: boolean
  fechaVencimientoCredito?: string
  saldoPendiente?: number

  // RECIBO_PAGO: puede pagar varias facturas del mismo proveedor a la vez
  tipoRecibo?: TipoRecibo
  origenDinero?: string
  aplicaciones?: AplicacionPago[]

  // NOTA_DEBITO / AJUSTE_CARTERA: aplican sobre una sola compra
  compraReferenciaId?: number
  observaciones?: string
}

export interface FiltrosCompra {
  proveedorId?: number
  tipoTransaccion?: TipoTransaccion
  fechaInicio?: string // yyyy-MM-dd
  fechaFin?: string     // yyyy-MM-dd
  creadoPor?: string
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
// Nota: X-Empresa-Id se inyecta automáticamente vía interceptor en api.ts,
// no hace falta enviarlo manualmente desde cada llamada.

export interface ItemImportado {
  descripcion: string
  cantidad?: number
  valorUnitario?: number
  valorTotal?: number
}

export interface FacturaImportada {
  fuente: 'XML' | 'PDF'
  nitProveedor?: string
  nombreProveedor?: string
  numeroFacturaProveedor?: string
  fecha?: string
  cufe?: string
  subtotal?: number
  totalIva?: number
  total?: number
  items: ItemImportado[]
  camposNoExtraidos: string[]
}

export const compraService = {
  listar: () =>
    api.get<Compra[]>('/api/pos/compras/listar'),

  buscarPorId: (compraId: number) =>
    api.get<Compra>(`/api/pos/compras/buscar/${compraId}`),

  filtrar: (filtros: FiltrosCompra) =>
    api.get<Compra[]>('/api/pos/compras/filtrar', { params: filtros }),

  registrar: (compra: Compra) =>
    api.post<Compra>('/api/pos/compras/registrar', compra),

  // Importar factura de proveedor: XML se parsea con confianza alta (documento
  // estructurado UBL). PDF es best-effort — revisa siempre lo extraído antes de guardar.
  importarXml: (archivo: File) => {
    const form = new FormData()
    form.append('archivo', archivo)
    return api.post<FacturaImportada>('/api/pos/compras/importar/xml', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  importarPdf: (archivo: File) => {
    const form = new FormData()
    form.append('archivo', archivo)
    return api.post<FacturaImportada>('/api/pos/compras/importar/pdf', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  anular: (compraId: number) =>
    api.put<void>(`/api/pos/compras/anular/${compraId}`),

  // Facturas pendientes de un proveedor — para armar el recibo de pago
  pendientesPorProveedor: (proveedorId: number) =>
    api.get<Compra[]>(`/api/pos/compras/pendientes/${proveedorId}`),

  // Cuentas por pagar (crédito a proveedores) próximas a vencer — para notificaciones
  proximasAVencer: (dias: number = 7) =>
    api.get<Compra[]>('/api/pos/compras/proximas-vencer', { params: { dias } }),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const calcularValorTotalItem = (item: Partial<CompraItem>) => {
  const cantidad = item.cantidad ?? 1
  const valorUnitario = item.valorUnitario ?? 0
  const descuento = item.descuento ?? 0
  return cantidad * valorUnitario - descuento
}

export const TIPO_TRANSACCION_LABEL: Record<TipoTransaccion, string> = {
  FACTURA_COMPRA: 'Factura de compra / gasto',
  DOCUMENTO_SOPORTE: 'Documento soporte',
  FACTURA_COMPRA_ELECTRONICA: 'Factura de compra electrónica',
  ORDEN_COMPRA: 'Orden de compra',
  RECIBO_PAGO: 'Recibo de pago / egreso',
  NOTA_DEBITO: 'Nota débito / ajuste',
  AJUSTE_CARTERA: 'Ajuste de cartera / proveedores',
}

export const TIPO_TRANSACCION_PREFIJO: Record<TipoTransaccion, string> = {
  FACTURA_COMPRA: 'FC',
  DOCUMENTO_SOPORTE: 'DS',
  FACTURA_COMPRA_ELECTRONICA: 'FCE',
  ORDEN_COMPRA: 'OC',
  RECIBO_PAGO: 'RP',
  NOTA_DEBITO: 'ND',
  AJUSTE_CARTERA: 'AC',
}

export const ESTADO_COLOR: Record<EstadoCompra, string> = {
  BORRADOR: 'default',
  REGISTRADA: 'green',
  ANULADA: 'red',
}

export const TIPO_ITEM_LABEL: Record<TipoItem, string> = {
  ACTIVO_FIJO: 'Activo fijo',
  PRODUCTO: 'Producto',
  GASTO_CUENTA: 'Gasto / Cuenta contable',
}

export const TIPO_RECIBO_LABEL: Record<TipoRecibo, string> = {
  ABONO_DEUDA: 'Abono a deuda',
  ANTICIPO: 'Anticipo',
  AVANZADO: 'Avanzado (impuestos, descuentos y ajustes)',
}

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  CREDITO_PROVEEDOR: 'Crédito proveedores',
}
