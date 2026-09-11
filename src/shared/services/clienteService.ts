import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coincide con Cliente.java del backend (puerto 8086)

export type TipoPersona = 'NATURAL' | 'JURIDICA'
export type TipoDocumento = 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI' | 'RC'
export type RegimenFiscal = 'RESPONSABLE_IVA' | 'NO_RESPONSABLE_IVA'

export interface Cliente {
    clienteId: number
    tipoPersona: TipoPersona
    tipoDocumento: TipoDocumento
    numeroDocumento: string
    dv?: string
    regimenFiscal: RegimenFiscal
    nombres?: string
    apellidos?: string
    razonSocial?: string
    correo: string
    telefono: string
    direccion?: string
    ciudad?: string
    departamento?: string
    pais?: string
    codigoPostal?: string
    activo: boolean
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
// Base: /api/pos/clientes  (ClienteController.java)
// api.ts inyecta automáticamente Authorization y X-Empresa-Id en cada request

export const clienteService = {
    listar: () =>
        api.get<Cliente[]>('/api/pos/clientes/listar'),

    buscar: (id: number) =>
        api.get<Cliente>(`/api/pos/clientes/buscar/${id}`),

    buscarPorDocumento: (numeroDocumento: string) =>
        api.get<Cliente>(`/api/pos/clientes/documento/${numeroDocumento}`),

    guardar: (data: Partial<Cliente>) =>
        api.post<Cliente>('/api/pos/clientes/save', data),

    actualizar: (id: number, data: Partial<Cliente>) =>
        api.put<Cliente>(`/api/pos/clientes/actualizar/${id}`, data),

    eliminar: (id: number) =>
        api.delete(`/api/pos/clientes/eliminar/${id}`),
}
