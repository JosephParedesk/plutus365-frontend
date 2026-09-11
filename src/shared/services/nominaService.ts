import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coinciden con los modelos de nomina-service (puerto 8092)

export type TipoContrato = 'INDEFINIDO' | 'FIJO' | 'OBRA_LABOR' | 'APRENDIZAJE'
export type EstadoNomina = 'BORRADOR' | 'LIQUIDADA' | 'PAGADA' | 'ANULADA'
export type NivelRiesgo = 'I' | 'II' | 'III' | 'IV' | 'V'

export interface Empleado {
    empleadoId?: number
    empresaId?: string
    tipoDocumento: string
    numeroDocumento: string
    nombres: string
    apellidos: string
    correo?: string
    telefono?: string
    direccion?: string
    ciudad?: string
    cargo?: string
    tipoContrato: TipoContrato
    fechaIngreso: string
    fechaRetiro?: string
    salarioBase: number
    salarioIntegral?: boolean
    auxilioTransporte?: boolean
    eps?: string
    fondoPension?: string
    fondoCesantias?: string
    cajaCompensacion?: string
    arl?: string
    nivelRiesgoArl?: NivelRiesgo
    bancoPago?: string
    tipoCuenta?: string
    numeroCuenta?: string
    activo?: boolean
}

/** tipoCode: 1..7 — ver CONCEPTOS_HORA_EXTRA. */
export interface HoraExtraItem {
    tipoCode: number
    cantidadHoras: number
    porcentaje: number
    valor: number
}

/** Códigos DIAN (tabla de Factus) — porcentajeSugerido null = confírmalo con tu
 *  contador, no hay un único valor fijado por ley para ese tipo combinado. */
export const CONCEPTOS_HORA_EXTRA: { codigo: number; label: string; porcentajeSugerido: number | null }[] = [
    { codigo: 1, label: 'Hora extra diurna', porcentajeSugerido: 25 },
    { codigo: 2, label: 'Hora extra nocturna', porcentajeSugerido: 75 },
    { codigo: 3, label: 'Hora recargo nocturno', porcentajeSugerido: 35 },
    { codigo: 4, label: 'Hora extra diurna dominical y festivos', porcentajeSugerido: null },
    { codigo: 5, label: 'Hora recargo diurno dominical y festivos', porcentajeSugerido: 90 },
    { codigo: 6, label: 'Hora extra nocturna dominical y festivos', porcentajeSugerido: null },
    { codigo: 7, label: 'Hora recargo nocturno dominical y festivos', porcentajeSugerido: null },
]

export interface NominaDetalle {
    empleadoId: number
    nombreEmpleado: string
    numeroDocumento: string
    cargo?: string
    salarioBase: number
    diasTrabajados: number

    sueldo: number
    auxilioTransporte: number
    horasExtra: HoraExtraItem[]
    comisiones: number
    bonificaciones: number
    otrosDevengados: number
    totalDevengado: number
    ibc: number

    saludEmpleado: number
    pensionEmpleado: number
    fondoSolidaridad: number
    retencionFuente: number
    prestamos: number
    otrasDeducciones: number
    totalDeducciones: number
    netoPagar: number

    saludEmpleador: number
    pensionEmpleador: number
    arl: number
    sena: number
    icbf: number
    cajaCompensacion: number
    totalAportesEmpleador: number
    exonerado: boolean

    provCesantias: number
    provInteresesCesantias: number
    provPrima: number
    provVacaciones: number
    totalProvisiones: number

    costoTotal: number
}

export interface Nomina {
    nominaId: number
    empresaId: string
    numero: string
    anio: number
    mes: number
    periodicidad: string
    fechaInicio: string
    fechaFin: string
    fechaPago: string
    estado: EstadoNomina
    detalles: NominaDetalle[]
    totalDevengado: number
    totalDeducciones: number
    totalNeto: number
    totalAportesEmpleador: number
    totalProvisiones: number
    costoTotalEmpresa: number
    creadoPor?: string
    observaciones?: string
}

/** Valores extra que el usuario captura antes de liquidar (por empleado). */
export interface NovedadEmpleado {
    diasTrabajados?: number
    horasExtra?: HoraExtraItem[]
    comisiones?: number
    bonificaciones?: number
    otrosDevengados?: number
    retencionFuente?: number
    prestamos?: number
    otrasDeducciones?: number
}

export interface ParametrosNomina {
    anioVigencia: number
    smmlv: number
    auxilioTransporte: number
    topeAuxilioTransporte: number
    minimoSalarioIntegral: number
    topeExoneracionAportes: number
}

// ─── Servicios ────────────────────────────────────────────────────────────────

export const empleadoService = {
    listar: () => api.get<Empleado[]>('/api/pos/nomina/empleados'),
    buscar: (id: number) => api.get<Empleado>(`/api/pos/nomina/empleados/${id}`),
    crear: (data: Empleado) => api.post<Empleado>('/api/pos/nomina/empleados', data),
    actualizar: (id: number, data: Empleado) => api.put<Empleado>(`/api/pos/nomina/empleados/${id}`, data),
    eliminar: (id: number) => api.delete(`/api/pos/nomina/empleados/${id}`),
}

export const nominaService = {
    parametros: () => api.get<ParametrosNomina>('/api/pos/nomina/parametros'),
    listar: () => api.get<Nomina[]>('/api/pos/nomina/periodos'),
    buscar: (id: number) => api.get<Nomina>(`/api/pos/nomina/periodos/${id}`),

    liquidar: (anio: number, mes: number, periodicidad: string, novedades: Record<number, NovedadEmpleado>) =>
        api.post<Nomina>('/api/pos/nomina/liquidar', { anio, mes, periodicidad, novedades }),

    marcarPagada: (id: number) => api.put<Nomina>(`/api/pos/nomina/periodos/${id}/pagar`, {}),
    anular: (id: number) => api.delete(`/api/pos/nomina/periodos/${id}`),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const TIPO_CONTRATO_LABEL: Record<TipoContrato, string> = {
    INDEFINIDO: 'Término indefinido',
    FIJO: 'Término fijo',
    OBRA_LABOR: 'Obra o labor',
    APRENDIZAJE: 'Aprendizaje (SENA)',
}

export const NIVEL_RIESGO_LABEL: Record<NivelRiesgo, string> = {
    I: 'I — Riesgo mínimo (0,522%)',
    II: 'II — Riesgo bajo (1,044%)',
    III: 'III — Riesgo medio (2,436%)',
    IV: 'IV — Riesgo alto (4,350%)',
    V: 'V — Riesgo máximo (6,960%)',
}

export const COLOR_ESTADO: Record<EstadoNomina, string> = {
    BORRADOR: 'default', LIQUIDADA: 'blue', PAGADA: 'green', ANULADA: 'red',
}

export const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ─── Acumulados iniciales ─────────────────────────────────────────────────────
// Saldos que el empleado ya traía causados antes de empezar a usar el sistema.

export interface AcumuladoInicial {
    acumuladoId?: number
    empleadoId: number
    nombreEmpleado?: string
    anio: number
    fechaCorte?: string
    sueldoAcumulado?: number
    auxilioTransporteAcumulado?: number
    extrasAcumuladas?: number
    bonificacionesAcumuladas?: number
    saludAcumulada?: number
    pensionAcumulada?: number
    retencionAcumulada?: number
    cesantiasAcumuladas?: number
    interesesCesantiasAcumulados?: number
    primaAcumulada?: number
    vacacionesAcumuladas?: number
    diasVacacionesPendientes?: number
    observaciones?: string
}

export const acumuladoInicialService = {
    listar: (anio: number) =>
        api.get<AcumuladoInicial[]>('/api/pos/nomina/acumulados-iniciales', { params: { anio } }),
    guardar: (data: AcumuladoInicial) =>
        api.post<AcumuladoInicial>('/api/pos/nomina/acumulados-iniciales', data),
    eliminar: (id: number) => api.delete(`/api/pos/nomina/acumulados-iniciales/${id}`),
}
