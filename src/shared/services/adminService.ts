import api from './api'
import type { ConfiguracionDian, ConfiguracionDianRequest } from './facturacionService'

// Panel de super administrador (rol SUPERADMIN) — Plutus365 es quien tramita
// las credenciales de Factus con cada empresa, así que las carga acá en vez
// de que cada empresa las autogestione. Solo llega acá un usuario con ese
// rol: el gateway (PermisosInterceptor) rechaza a cualquier otro con 403,
// incluido un ADMIN normal de una empresa. Base: /api/pos/admin
// (AdminController.java, facturacion-service).

export interface EmpresaAdminResumen {
    empresaId: string
    nombre: string
    tipoDocumento: string
    numeroDocumento: string
    correo: string
    factusConfigurado: boolean
}

export const adminService = {
    listarEmpresas: () =>
        api.get<EmpresaAdminResumen[]>('/api/pos/admin/empresas'),

    // 404 si esa empresa todavía no tiene Factus configurado
    obtenerFactus: (empresaId: string) =>
        api.get<ConfiguracionDian>(`/api/pos/admin/empresas/${empresaId}/factus`),

    guardarFactus: (empresaId: string, data: ConfiguracionDianRequest) =>
        api.put<ConfiguracionDian>(`/api/pos/admin/empresas/${empresaId}/factus`, data),
}
