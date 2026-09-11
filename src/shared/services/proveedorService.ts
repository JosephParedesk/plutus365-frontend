import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coincide con Proveedor.java del backend (puerto 8084)

export interface Proveedor {
    proveedorId: number
    nit: string
    nombre: string
    contacto: string
    telefono: string
    correo: string
    direccion: string
    ciudad: string
    plazoCredito: string
    activo: boolean
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
// Base: /api/pos/proveedores  (ProveedorController.java)

export const proveedorService = {
    listar: () =>
        api.get<Proveedor[]>('/api/pos/proveedores/listar'),

    buscar: (id: number) =>
        api.get<Proveedor>(`/api/pos/proveedores/buscar/${id}`),

    buscarPorNit: (nit: string) =>
        api.get<Proveedor>(`/api/pos/proveedores/nit/${nit}`),

    guardar: (data: Partial<Proveedor>) =>
        api.post<Proveedor>('/api/pos/proveedores/save', data),

    actualizar: (id: number, data: Partial<Proveedor>) =>
        api.put<Proveedor>(`/api/pos/proveedores/actualizar/${id}`, data),

    eliminar: (id: number) =>
        api.delete(`/api/pos/proveedores/eliminar/${id}`),
}