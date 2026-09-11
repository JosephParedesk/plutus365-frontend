import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coinciden con CuentaContable.java del backend (puerto 8090)

export type NivelCuenta = 'CLASE' | 'GRUPO' | 'CUENTA' | 'SUBCUENTA' | 'AUXILIAR'
export type Naturaleza = 'DEBITO' | 'CREDITO'
export type DetalleSaldos = 'SIN_DETALLE' | 'DETALLE_VENCIMIENTOS' | 'DETALLE_TERCEROS'

export interface CuentaContable {
    id: number
    empresaId: string
    codigo: string
    nombre: string
    nivel: NivelCuenta
    codigoPadre?: string
    naturaleza: Naturaleza
    esTransaccional: boolean
    categoria?: string
    detalleSaldos?: DetalleSaldos
    activa: boolean
    personalizada: boolean
}

export interface CuentaContableRequest {
    codigo: string
    nombre: string
    categoria?: string
    detalleSaldos?: DetalleSaldos
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
// Base: /api/pos/contabilidad/cuentas  (CuentaContableController.java)
// La primera vez que una empresa llama listar(), el backend siembra
// automáticamente el PUC base — no hace falta ningún paso de "inicializar".

export const cuentaContableService = {
    listar: () =>
        api.get<CuentaContable[]>('/api/pos/contabilidad/cuentas'),

    buscar: (codigo: string) =>
        api.get<CuentaContable>(`/api/pos/contabilidad/cuentas/${codigo}`),

    crear: (data: CuentaContableRequest) =>
        api.post<CuentaContable>('/api/pos/contabilidad/cuentas', data),

    actualizar: (codigo: string, data: Partial<CuentaContableRequest & { activa: boolean }>) =>
        api.put<CuentaContable>(`/api/pos/contabilidad/cuentas/${codigo}`, data),

    eliminar: (codigo: string) =>
        api.delete(`/api/pos/contabilidad/cuentas/${codigo}`),
}

// ─── Asientos contables ─────────────────────────────────────────────────────

export type OrigenAsiento = 'VENTA' | 'COMPRA' | 'MANUAL'
export type EstadoAsiento = 'CONTABILIZADO' | 'ANULADO'

export interface MovimientoContable {
    cuentaCodigo: string
    cuentaNombre: string
    debe: number
    haber: number
    descripcion?: string
}

export interface AsientoContable {
    asientoId: number
    empresaId: string
    numero: string
    fecha: string
    descripcion: string
    origen: OrigenAsiento
    referenciaId?: number
    estado: EstadoAsiento
    movimientos: MovimientoContable[]
    totalDebe: number
    totalHaber: number
    creadoPor?: string
}

export const asientoContableService = {
    listar: () =>
        api.get<AsientoContable[]>('/api/pos/contabilidad/asientos'),

    buscar: (asientoId: number) =>
        api.get<AsientoContable>(`/api/pos/contabilidad/asientos/${asientoId}`),
}

export const ORIGEN_LABEL: Record<OrigenAsiento, string> = {
    VENTA: 'Venta', COMPRA: 'Compra', MANUAL: 'Manual',
}

// ─── Estados financieros ────────────────────────────────────────────────────

export interface SaldoCuenta {
    codigo: string
    nombre: string
    nivel: NivelCuenta
    saldo: number
}

export interface BalanceGeneral {
    fechaCorte: string
    activos: SaldoCuenta[]
    pasivos: SaldoCuenta[]
    patrimonio: SaldoCuenta[]
    totalActivo: number
    totalPasivo: number
    totalPatrimonio: number
    cuadra: boolean
}

export interface EstadoResultados {
    fechaInicio: string
    fechaFin: string
    ingresos: SaldoCuenta[]
    costos: SaldoCuenta[]
    gastos: SaldoCuenta[]
    totalIngresos: number
    totalCostos: number
    totalGastos: number
    utilidad: number
}

export interface LineaFlujo {
    codigo: string
    concepto: string
    valor: number
}

export interface FlujoEfectivo {
    fechaInicio: string
    fechaFin: string
    utilidadPeriodo: number
    operacion: LineaFlujo[]
    inversion: LineaFlujo[]
    financiacion: LineaFlujo[]
    flujoOperacion: number
    flujoInversion: number
    flujoFinanciacion: number
    variacionNeta: number
    efectivoInicial: number
    efectivoFinal: number
    cuadra: boolean
}

export interface LineaPatrimonio {
    codigo: string
    concepto: string
    saldoInicial: number
    variacion: number
    saldoFinal: number
}

export interface CambiosPatrimonio {
    fechaInicio: string
    fechaFin: string
    lineas: LineaPatrimonio[]
    totalSaldoInicial: number
    totalVariacion: number
    totalSaldoFinal: number
}

export const estadosFinancierosService = {
    flujoEfectivo: (fechaInicio: string, fechaFin: string) =>
        api.get<FlujoEfectivo>('/api/pos/contabilidad/estados-financieros/flujo-efectivo', {
            params: { fechaInicio, fechaFin }
        }),

    cambiosPatrimonio: (fechaInicio: string, fechaFin: string) =>
        api.get<CambiosPatrimonio>('/api/pos/contabilidad/estados-financieros/cambios-patrimonio', {
            params: { fechaInicio, fechaFin }
        }),

    balanceGeneral: (fechaCorte?: string) =>
        api.get<BalanceGeneral>('/api/pos/contabilidad/estados-financieros/balance-general', {
            params: fechaCorte ? { fechaCorte } : {}
        }),

    estadoResultados: (fechaInicio: string, fechaFin: string) =>
        api.get<EstadoResultados>('/api/pos/contabilidad/estados-financieros/estado-resultados', {
            params: { fechaInicio, fechaFin }
        }),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const NIVEL_LABEL: Record<NivelCuenta, string> = {
    CLASE: 'Clase', GRUPO: 'Grupo', CUENTA: 'Cuenta', SUBCUENTA: 'Subcuenta', AUXILIAR: 'Auxiliar',
}

export const DETALLE_SALDOS_LABEL: Record<DetalleSaldos, string> = {
    SIN_DETALLE: 'Sin detalle de vencimientos',
    DETALLE_VENCIMIENTOS: 'Detalle de vencimientos',
    DETALLE_TERCEROS: 'Detalle por terceros',
}

/** Longitud de código esperada por nivel, para saber qué tan hondo va cada uno. */
export const LONGITUD_NIVEL: Record<NivelCuenta, number> = {
    CLASE: 1, GRUPO: 2, CUENTA: 4, SUBCUENTA: 6, AUXILIAR: 8,
}


// ─── Centros de costo ───────────────────────────────────────────────────────

export interface CentroCosto {
    centroCostoId?: number
    empresaId?: string
    codigo: string
    nombre: string
    descripcion?: string
    responsable?: string
    activo?: boolean
}

export const centroCostoService = {
    listar: () => api.get<CentroCosto[]>('/api/pos/contabilidad/centros-costo'),
    crear: (data: CentroCosto) => api.post<CentroCosto>('/api/pos/contabilidad/centros-costo', data),
    actualizar: (id: number, data: Partial<CentroCosto>) =>
        api.put<CentroCosto>(`/api/pos/contabilidad/centros-costo/${id}`, data),
    eliminar: (id: number) => api.delete(`/api/pos/contabilidad/centros-costo/${id}`),
}
