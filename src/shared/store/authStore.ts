import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'
import axios from 'axios'

interface Usuario {
    cedula: string
    nombre: string
    correo: string
    rol: string
    planId?: number
    empresaId?: string
}

interface AuthStore {
    usuario: Usuario | null
    token: string | null
    refreshToken: string | null
    setUsuario: (usuario: Usuario) => void
    setTokens: (accessToken: string, refreshToken: string, recordarme: boolean) => void
    actualizarTokens: (accessToken: string, refreshToken: string) => void
    logout: () => void
    inicializar: () => void
}

// "Recordarme" decide DÓNDE viven los tokens, no cuánto dura el JWT (eso siempre
// son 1h, fijo en el backend): localStorage sobrevive a cerrar el navegador,
// sessionStorage se borra solo al cerrar la pestaña/ventana. El marcador vive
// siempre en localStorage (es solo un puntero, no un dato sensible) para que
// inicializar() sepa dónde buscar sin depender de que recordarme se repita.
const MARCADOR = 'auth-storage'
const storageActual = (): globalThis.Storage =>
    localStorage.getItem(MARCADOR) === 'session' ? sessionStorage : localStorage

let refrescandoPromesa: Promise<string | null> | null = null
let temporizadorRefresh: ReturnType<typeof setTimeout> | null = null

// Refresca el access token usando el refreshToken guardado. Compartida entre el
// temporizador proactivo (de acá abajo) y el interceptor 401 reactivo de api.ts —
// axios "pelado" (no la instancia `api`) para no crear un ciclo de imports ni
// reentrar en el propio interceptor 401.
async function refrescarSesion(): Promise<string | null> {
    if (refrescandoPromesa) return refrescandoPromesa

    const { refreshToken } = useAuthStore.getState()
    if (!refreshToken) return null

    refrescandoPromesa = axios
        .post(`${import.meta.env.VITE_API_URL}/api/pos/usuario/refresh`, { refreshToken })
        .then(({ data }) => {
            useAuthStore.getState().actualizarTokens(data.accessToken, data.refreshToken)
            return data.accessToken as string
        })
        .catch(() => null)
        .finally(() => { refrescandoPromesa = null })

    return refrescandoPromesa
}

// Refresca solo 1 minuto antes de que el JWT venza — así una venta a medias
// nunca se corta por un 401 a mitad de camino. Si el refresh falla (refreshToken
// también vencido), no hace nada: la próxima llamada a la API dará 401 y el
// interceptor de api.ts manda a /login.
function programarRefresh(accessToken: string) {
    if (temporizadorRefresh) clearTimeout(temporizadorRefresh)
    try {
        const decoded: any = jwtDecode(accessToken)
        if (!decoded.exp) return
        const msRestantes = decoded.exp * 1000 - Date.now()
        const delay = Math.max(msRestantes - 60_000, 0)
        temporizadorRefresh = setTimeout(() => { void refrescarSesion() }, delay)
    } catch { /* token corrupto — lo maneja el interceptor 401 */ }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    usuario: null,
    token: storageActual().getItem('token'),
    refreshToken: storageActual().getItem('refreshToken'),

    inicializar: () => {
        const storage = storageActual()
        const token = storage.getItem('token')
        const refreshToken = storage.getItem('refreshToken')
        if (!token) return
        try {
            const decoded: any = jwtDecode(token)
            set({
                token,
                refreshToken,
                usuario: {
                    cedula: decoded.cedula,
                    nombre: decoded.nombre,
                    correo: decoded.sub,
                    rol: decoded.rol,
                    planId: decoded.planId,
                    empresaId: decoded.empresaId,
                }
            })
            // Si ya venció (ej. el navegador estuvo cerrado más de 1h), programarRefresh
            // calcula un delay negativo → se dispara de inmediato en vez de esperar.
            programarRefresh(token)
        } catch {
            storage.removeItem('token')
            storage.removeItem('refreshToken')
        }
    },

    setUsuario: (usuario) => set({ usuario }),

    // Solo en login: decide y graba en qué storage vive la sesión de acá en
    // adelante, limpiando cualquier rastro en el otro storage por si la vez
    // anterior se marcó distinto.
    setTokens: (accessToken, refreshToken, recordarme) => {
        localStorage.setItem(MARCADOR, recordarme ? 'local' : 'session')
        const storageViejo = recordarme ? sessionStorage : localStorage
        storageViejo.removeItem('token')
        storageViejo.removeItem('refreshToken')

        const storage = recordarme ? localStorage : sessionStorage
        storage.setItem('token', accessToken)
        storage.setItem('refreshToken', refreshToken)
        set({ token: accessToken, refreshToken })
        programarRefresh(accessToken)
    },

    // Tras un refresh exitoso: mismo storage de siempre, solo se actualizan los valores.
    actualizarTokens: (accessToken, refreshToken) => {
        const storage = storageActual()
        storage.setItem('token', accessToken)
        storage.setItem('refreshToken', refreshToken)
        set({ token: accessToken, refreshToken })
        programarRefresh(accessToken)
    },

    logout: () => {
        const { refreshToken } = get()
        if (refreshToken) {
            // Best-effort: invalida el refreshToken en el servidor para que no se
            // pueda seguir usando si alguien lo copió. No bloquea el logout local.
            axios.post(`${import.meta.env.VITE_API_URL}/api/pos/usuario/logout`, { refreshToken }).catch(() => {})
        }
        if (temporizadorRefresh) clearTimeout(temporizadorRefresh)
        storageActual().removeItem('token')
        storageActual().removeItem('refreshToken')
        set({ usuario: null, token: null, refreshToken: null })
    },
}))

export { refrescarSesion }
