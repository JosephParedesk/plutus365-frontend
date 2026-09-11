// Paleta clara (colors.ts original) y su versión oscura — mismas claves en
// ambas, mismo verde de marca (#4E6F3A / #8BC34A) en los dos modos para que
// siga siendo reconociblemente Plutus365. Los acentos saturados (primary,
// accent, purple, orange, red, y las variantes *Light usadas como fondo de
// chip de ícono) casi no cambian entre modos porque ya tienen luminancia
// suficiente para leerse bien tanto en fondo claro como oscuro — lo que
// cambia de verdad son las superficies (fondo de página/tarjeta/sidebar) y
// el texto, que si o si necesitan invertirse.
//
// Un solo lugar (acá) define los valores reales; colors.ts solo referencia
// estas claves como variables CSS (así ningún otro archivo del frontend
// tiene que cambiar) y themeStore.ts es quien aplica estos valores como
// custom properties al elemento raíz cuando cambia el modo.

export interface Paleta {
    sidebarBg: string
    sidebarActiveBg: string
    sidebarActiveText: string
    sidebarText: string
    sidebarTextMuted: string
    sidebarHoverBg: string
    sidebarBorder: string
    authPanelBg: string
    primary: string
    primaryDark: string
    primaryHover: string
    primaryLight: string
    accent: string
    accentBg: string
    accentLight: string
    purple: string
    purpleLight: string
    orange: string
    orangeLight: string
    red: string
    redLight: string
    heading: string
    textSecondary: string
    textMuted: string
    border: string
    pageBg: string
    cardBg: string
}

export const PALETA_CLARA: Paleta = {
    sidebarBg: '#FFFFFF',
    sidebarActiveBg: '#4E6F3A',
    sidebarActiveText: '#FFFFFF',
    sidebarText: '#6B746C',
    sidebarTextMuted: '#6B746C',
    sidebarHoverBg: '#F6F8F5',
    sidebarBorder: '#ECEFEA',
    authPanelBg: '#4E6F3A',
    primary: '#4E6F3A',
    primaryDark: '#4E6F3A',
    primaryHover: '#689F38',
    primaryLight: '#C5E1A5',
    accent: '#8BC34A',
    accentBg: '#A5D66A',
    accentLight: '#C5E1A5',
    purple: '#689F38',
    purpleLight: '#A5D66A',
    orange: '#FBC02D',
    orangeLight: '#ECEFEA',
    red: '#ff4d4f',
    redLight: '#fff1f0',
    heading: '#2E3A2F',
    textSecondary: '#6B746C',
    textMuted: '#6B746C',
    border: '#ECEFEA',
    pageBg: '#F6F8F5',
    cardBg: '#FFFFFF',
}

export const PALETA_OSCURA: Paleta = {
    sidebarBg: '#161C13',
    sidebarActiveBg: '#4E6F3A',
    sidebarActiveText: '#FFFFFF',
    sidebarText: '#A8B3A2',
    sidebarTextMuted: '#7C877A',
    sidebarHoverBg: '#1F2A1B',
    sidebarBorder: '#26301F',
    authPanelBg: '#3E5A2E', // un toque más claro que en modo claro — sobre fondo oscuro #4E6F3A se veía casi negro
    primary: '#5C8542',      // un poco más claro que #4E6F3A para que no se pierda sobre fondo oscuro
    primaryDark: '#4E6F3A',
    primaryHover: '#75AC4C',
    primaryLight: '#2B3B22', // chip oscuro — el ícono (accent, claro) es quien da el contraste, no el chip
    accent: '#8BC34A',
    accentBg: '#A5D66A',
    accentLight: '#3B4E2C',
    purple: '#8FBF5C',
    purpleLight: '#2B3B22',
    orange: '#FBC02D',
    orangeLight: '#2E2A1C',
    red: '#ff7875',
    redLight: '#3A1F1F',
    heading: '#E8ECE6',
    textSecondary: '#A8B3A2',
    textMuted: '#8A9584',
    border: '#26301F',
    pageBg: '#10140F',
    cardBg: '#1A2018',
}
