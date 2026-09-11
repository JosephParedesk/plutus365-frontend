import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coinciden con Empresa.java del backend (puerto 8088)

export type TipoPersonaEmpresa = 'NATURAL' | 'JURIDICA'
export type TipoDocumentoEmpresa = 'NIT' | 'CC'
export type RegimenFiscal = 'RESPONSABLE_IVA' | 'NO_RESPONSABLE_IVA'
export type PeriodicidadIva = 'BIMESTRAL' | 'CUATRIMESTRAL'

export interface Empresa {
    empresaId: string
    tipoPersona: TipoPersonaEmpresa
    tipoDocumento: TipoDocumentoEmpresa
    numeroDocumento: string
    dv?: string
    regimenFiscal: RegimenFiscal
    // Solo aplica si regimenFiscal='RESPONSABLE_IVA' — la periodicidad la asigna la DIAN
    // según ingresos del año anterior, el sistema no la calcula, la configuras tú.
    periodicidadIva?: PeriodicidadIva
    // No todo responsable de IVA es agente retenedor — se configura aparte.
    agenteRetenedor?: boolean
    razonSocial?: string
    nombres?: string
    apellidos?: string
    nombreComercial?: string
    correo: string
    telefono: string
    direccion?: string
    ciudad?: string
    departamento?: string
    pais?: string
    logoUrl?: string
    colorPrincipal?: string   // hex, ej: #4E6F3A — usado en el encabezado de los correos al cliente
    moneda?: string
    // Apagado por defecto — Facturación no depende de esto, es el POS (carrito/caja)
    // el que se prende aparte cuando el negocio lo necesite.
    posHabilitado?: boolean
}

export type EmpresaRequest = Omit<Empresa, 'empresaId' | 'logoUrl'>

// ─── Servicio ─────────────────────────────────────────────────────────────────
// Base: /api/pos/empresa  (EmpresaController.java)
// api.ts inyecta automáticamente Authorization y X-Empresa-Id en cada request
//
// obtener() devuelve 404 si la empresa aún no ha guardado su configuración;
// la pantalla debe interpretar ese caso como "mostrar formulario vacío", no como error.

export const empresaService = {
    obtener: () =>
        api.get<Empresa>('/api/pos/empresa'),

    guardar: (data: EmpresaRequest) =>
        api.put<Empresa>('/api/pos/empresa', data),

    // El logo se sirve directo desde empresa-service (recurso estático),
    // no a través del gateway, por eso la URL devuelta es absoluta.
    subirLogo: (file: File) => {
        const formData = new FormData()
        formData.append('logo', file)
        return api.post<Empresa>('/api/pos/empresa/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
    },
}
