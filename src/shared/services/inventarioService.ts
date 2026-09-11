import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coinciden con Producto.java / ProductoData.java del backend real (clave = sku)

export type TipoIva = 'GENERAL_19' | 'REDUCIDO_5' | 'EXENTO' | 'EXCLUIDO'

export const TIPO_IVA_LABEL: Record<TipoIva, string> = {
  GENERAL_19: 'General (19%)',
  REDUCIDO_5: 'Reducida (5%)',
  EXENTO: 'Exento (0%, con devolución)',
  EXCLUIDO: 'Excluido (0%, sin devolución)',
}

export const PORCENTAJE_IVA: Record<TipoIva, number> = {
  GENERAL_19: 19, REDUCIDO_5: 5, EXENTO: 0, EXCLUIDO: 0,
}

export interface Producto {
  sku: string
  nombre: string
  descripcion?: string
  categoriaId?: string
  categoriaNombre?: string
  proveedorId?: string
  proveedorNombre?: string
  precioCompra: number
  precioVenta: number
  gananciaPesos?: number
  gananciaPorcentaje?: number
  stock: number
  stockMinimo: number
  unidad: string
  imagenUrl?: string
  activo: boolean
  tipoIva: TipoIva
}

export interface ProductoRequest {
  sku: string
  nombre: string
  descripcion?: string
  categoriaId?: string
  proveedorId?: string
  precioCompra: number
  precioVenta: number
  stock: number
  stockMinimo: number
  unidad: string
  imagenUrl?: string
  activo: boolean
  tipoIva: TipoIva
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
// X-Empresa-Id se agrega automáticamente vía interceptor en api.ts

export interface MovimientoInventario {
  movimientoId: number
  sku: string
  nombreProducto: string
  fecha: string
  tipo: 'ENTRADA_COMPRA' | 'SALIDA_VENTA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA' | 'CREACION'
  documentoOrigen?: string
  descripcion?: string
  cantidad: number
  saldoAnterior: number
  saldoNuevo: number
  costoUnitario?: number
  valorMovimiento?: number
  usuario?: string
}

export const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  ENTRADA_COMPRA: 'Entrada por compra',
  SALIDA_VENTA: 'Salida por venta',
  AJUSTE_ENTRADA: 'Ajuste (entrada)',
  AJUSTE_SALIDA: 'Ajuste (salida)',
  CREACION: 'Creación',
  SALDO_INICIAL: 'Saldo inicial',
}

// ─── Importación desde Excel (coincide con ResultadoImportacion.java / ResultadoSaldoInicial.java) ──

export interface ErrorFilaImportacion {
  fila: number
  sku?: string
  motivo: string
}

export interface ResultadoImportacionCatalogo {
  creados: number
  actualizados: number
  errores: ErrorFilaImportacion[]
}

export interface ResultadoSaldoInicial {
  productosActualizados: number
  valorTotal: number
  numeroAsiento?: string
  errores: ErrorFilaImportacion[]
}

export const movimientoService = {
  kardex: (sku: string) =>
    api.get<MovimientoInventario[]>(`/api/surtiana/inventario/kardex/${sku}`),
  porRango: (desde: string, hasta: string) =>
    api.get<MovimientoInventario[]>('/api/surtiana/inventario/movimientos', { params: { desde, hasta } }),
}

export const productoService = {
  listar: () =>
    api.get<Producto[]>('/api/surtiana/inventario/productos'),

  buscarPorSku: (sku: string) =>
    api.get<Producto>(`/api/surtiana/inventario/buscar/${sku}`),

  guardar: (data: ProductoRequest) =>
    api.post<Producto>('/api/surtiana/inventario/save', data),

  actualizar: (sku: string, data: ProductoRequest) =>
    api.put<Producto>(`/api/surtiana/inventario/actualizar/${sku}`, data),

  eliminar: (sku: string) =>
    api.delete(`/api/surtiana/inventario/eliminar/${sku}`),

  listarPorCategoria: (categoriaId: string) =>
    api.get<Producto[]>(`/api/surtiana/inventario/categoria/${categoriaId}`),

  // ── Nuevo: productos de un proveedor específico ──
  listarPorProveedor: (proveedorId: string | number) =>
    api.get<Producto[]>(`/api/surtiana/inventario/proveedor/${proveedorId}`),

  listarStockBajo: () =>
    api.get<Producto[]>('/api/surtiana/inventario/stock-bajo'),

  // ── Subir imagen del producto (requiere endpoint multipart en el backend) ──
  subirImagen: (sku: string, file: File) => {
    const formData = new FormData()
    formData.append('imagen', file)
    return api.post<{ imagenUrl: string }>(
      `/api/surtiana/inventario/${sku}/imagen`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  // ── Importar catálogo desde Excel: crea/actualiza sku, nombre, categoría,
  // proveedor, precios, stockMinimo y unidad. NUNCA toca el stock. ──
  importarCatalogo: (archivo: File) => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    return api.post<ResultadoImportacionCatalogo>(
      '/api/surtiana/inventario/importar-catalogo',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  // ── Cargar saldo inicial de inventario desde Excel: sku, cantidad, costoUnitario.
  // Es de una sola vez por empresa — genera un asiento contable (Debe Inventario,
  // Haber la cuenta contrapartida que se indique). ──
  importarSaldosIniciales: (archivo: File, cuentaContrapartida: string, fechaCorte?: string) => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    formData.append('cuentaContrapartida', cuentaContrapartida)
    if (fechaCorte) formData.append('fechaCorte', fechaCorte)
    return api.post<ResultadoSaldoInicial>(
      '/api/surtiana/inventario/importar-saldos-iniciales',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// precioVenta va con IVA incluido — la ganancia se calcula sobre la base sin IVA
// (el IVA no es utilidad, es un impuesto de paso). Espejo de ProductoMapper.java.
export const calcularGanancia = (precioCompra: number, precioVenta: number, tipoIva: TipoIva = 'GENERAL_19') => {
  const tasa = (PORCENTAJE_IVA[tipoIva] ?? 19) / 100
  const ventaBase = precioVenta / (1 + tasa)
  const pesos = ventaBase - precioCompra
  const porcentaje = precioCompra > 0 ? (pesos / precioCompra) * 100 : 0
  return { pesos, porcentaje }
}