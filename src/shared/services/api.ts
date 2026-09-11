import axios from 'axios'
import { useAuthStore, refrescarSesion } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const { token, usuario } = useAuthStore.getState()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (usuario?.empresaId) {
    config.headers['X-Empresa-Id'] = usuario.empresaId
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    // El JWT dura 1h — si un 401 llega por token vencido (no por credenciales
    // malas de por sí), se intenta renovar UNA vez con el refreshToken y se
    // repite la petición original, para que el usuario no pierda lo que estaba
    // haciendo. refrescarSesion() está compartida (una sola promesa en vuelo)
    // así que si varias peticiones vencen a la vez no se disparan varios refresh.
    if (error.response?.status === 401 && original && !original._reintentoTrasRefresh) {
      original._reintentoTrasRefresh = true
      const nuevoToken = await refrescarSesion()
      if (nuevoToken) {
        original.headers.Authorization = `Bearer ${nuevoToken}`
        return api(original)
      }
    }
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
