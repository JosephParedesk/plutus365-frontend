import api from './api'

export const authService = {
    registro: (data: {
        cedula: string
        tipoDocumento: string
        nombre: string
        correo: string
        contrasena: string
        telefono: string
        planId: number 
    }) => api.post('/api/pos/usuario/save', data),

    login: (correo: string, contrasena: string, recordarme: boolean) =>
        api.post<{ accessToken: string; refreshToken: string; refreshExpiraEn: string }>(
            '/api/pos/usuario/login', { correo, contrasena, recordarme }
        ),

    buscar: (cedula: string) =>
        api.get(`/api/pos/usuario/buscar/${cedula}`),

    eliminar: (cedula: string) =>
        api.delete(`/api/pos/usuario/eliminar/${cedula}`),

    forgotPassword: (email: string) =>
        api.post('/api/pos/usuario/forgot-password', { email }),

    resetPassword: (token: string, nuevaContrasena: string) =>
        api.post('/api/pos/usuario/reset-password', { token, nuevaContrasena }),

    crearEmpleado: (data: {
        cedula: string
        tipoDocumento: string
        nombre: string
        correo: string
        contrasena: string
        telefono: string
        rol: string
    }) => api.post('/api/pos/usuario/crear-empleado', data),

    listarEmpleados: () =>
        api.get('/api/pos/usuario/empleados'),
}