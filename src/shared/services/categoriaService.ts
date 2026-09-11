import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coincide con Categoria.java del backend (puerto 8083)

export interface Categoria {
  categoriaId: number
  nombre: string
  descripcion?: string
  icono?: string
  activo: boolean
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
// Base: /api/pos/categorias  (CategoriaController.java)

export const categoriaService = {
  listar: () =>
    api.get<Categoria[]>('/api/pos/categorias/listar'),

  buscar: (id: number) =>
    api.get<Categoria>(`/api/pos/categorias/buscar/${id}`),

  guardar: (data: Partial<Categoria>) =>
    api.post<Categoria>('/api/pos/categorias/save', data),

  actualizar: (id: number, data: Partial<Categoria>) =>
    api.put<Categoria>(`/api/pos/categorias/actualizar/${id}`, data),

  eliminar: (id: number) =>
    api.delete(`/api/pos/categorias/eliminar/${id}`),
}
