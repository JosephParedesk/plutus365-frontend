// Theme global de AntDesign — un solo lugar que empareja look & feel (radios,
// sombras, tipografía) en TODOS los componentes (Button, Table, Modal, Form,
// Input...) sin tocar cada página. Reusa la paleta de palette.ts.
//
// Rediseño Soft UI / Neumorphism (agosto 2026): radios grandes, sombra suave
// de dos capas en vez de borde visible, fórmula de sombra pedida literal.
//
// Tema oscuro (agosto 2026): AntD necesita valores hex reales acá (hace
// cálculos de color internamente — mezclar, aclarar, oscurecer — no puede
// trabajar con `var(--c-x)` como hace colors.ts para el resto del frontend).
// Por eso importa palette.ts directo en vez de colors.ts.
import { theme, type ThemeConfig } from 'antd'
import { PALETA_CLARA, PALETA_OSCURA, type Paleta } from './palette'

const SOMBRA_SUAVE = '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)'
const SOMBRA_GRANDE = '0 4px 10px rgba(0,0,0,.04), 0 20px 45px rgba(0,0,0,.10)'

export type ModoTema = 'light' | 'dark'

function construirTema(p: Paleta, modo: ModoTema): ThemeConfig {
    return {
        algorithm: modo === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
            colorPrimary: p.primary,
            colorSuccess: p.primary,
            colorWarning: p.orange,
            colorError: p.red,
            colorInfo: p.purple,
            colorLink: p.primary,
            colorBgLayout: p.pageBg,
            colorBgContainer: p.cardBg,
            colorBorder: p.border,
            colorBorderSecondary: p.border,
            colorTextHeading: p.heading,
            colorTextSecondary: p.textSecondary,
            colorText: p.heading,
            fontFamily: "'Public Sans Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif",
            borderRadius: 14,
            borderRadiusLG: 22,
            fontSize: 14,
            boxShadow: SOMBRA_SUAVE,
            boxShadowSecondary: SOMBRA_GRANDE,
        },
        components: {
            Button: { borderRadius: 14, controlHeight: 36, fontWeight: 600, primaryShadow: 'none' },
            Card: {
                borderRadiusLG: 22,
                boxShadowTertiary: SOMBRA_SUAVE,
                colorBorderSecondary: 'transparent', // sin borde visible — la sombra separa
            },
            Table: { borderRadiusLG: 18, headerBg: p.pageBg, headerColor: p.heading, cellPaddingBlock: 12 },
            Modal: { borderRadiusLG: 24, boxShadow: SOMBRA_GRANDE, padding: 28 },
            Input: { borderRadius: 14, controlHeight: 36, colorBorder: 'transparent', activeShadow: `0 0 0 3px ${p.accent}33` },
            Select: { borderRadius: 14, controlHeight: 36 },
            DatePicker: { borderRadius: 14, controlHeight: 36 },
            Tag: { borderRadiusSM: 10 },
            Dropdown: { borderRadiusLG: 18, boxShadowSecondary: SOMBRA_GRANDE },
            Tooltip: { borderRadius: 14 },
            Message: { borderRadiusLG: 16 },
            Notification: { borderRadiusLG: 18 },
        },
    }
}

export const antdThemeClaro = construirTema(PALETA_CLARA, 'light')
export const antdThemeOscuro = construirTema(PALETA_OSCURA, 'dark')

export function obtenerAntdTheme(modo: ModoTema): ThemeConfig {
    return modo === 'dark' ? antdThemeOscuro : antdThemeClaro
}
