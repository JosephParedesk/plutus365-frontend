import { create } from 'zustand'
import { PALETA_CLARA, PALETA_OSCURA, type Paleta } from '../theme/palette'

type Modo = 'light' | 'dark'

interface ThemeStore {
    modo: Modo
    alternar: () => void
    inicializar: () => void
}

const CLAVE = 'plutus365-tema'

// Aplica la paleta como variables CSS (--c-sidebarBg, --c-primary, etc.) en el
// elemento raíz — colors.ts solo referencia estas variables, así que esto es
// lo único que hace falta para que TODO el frontend (salvo AntD, que necesita
// hex reales — ver antdTheme.ts) cambie de tema, sin re-renderizar nada.
function aplicarPaleta(paleta: Paleta, modo: Modo) {
    const raiz = document.documentElement
    for (const [clave, valor] of Object.entries(paleta)) {
        raiz.style.setProperty(`--c-${clave}`, valor)
    }
    raiz.setAttribute('data-theme', modo)
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
    modo: 'light',

    inicializar: () => {
        const guardado = (localStorage.getItem(CLAVE) as Modo | null) || 'light'
        aplicarPaleta(guardado === 'dark' ? PALETA_OSCURA : PALETA_CLARA, guardado)
        set({ modo: guardado })
    },

    alternar: () => {
        const nuevo: Modo = get().modo === 'dark' ? 'light' : 'dark'
        aplicarPaleta(nuevo === 'dark' ? PALETA_OSCURA : PALETA_CLARA, nuevo)
        localStorage.setItem(CLAVE, nuevo)
        set({ modo: nuevo })
    },
}))
