import api from './api'

export const planesService = {
    listar: () => api.get('/api/pos/planes'),

    obtener: (id: number) => api.get(`/api/pos/planes/${id}`),

    tieneAcceso: (planId: number, modulo: string) =>
        api.get(`/api/pos/planes/${planId}/tiene-acceso/${modulo}`),
}