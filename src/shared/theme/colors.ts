// Paleta Plutus365 — Soft UI / Neumorphism moderno (rediseño visual, agosto 2026).
// Úsala en vez de hardcodear hex nuevos, para que todo el frontend quede consistente.
//
// Cada valor es una variable CSS, no un hex fijo — themeStore.ts la aplica al
// elemento raíz según el modo claro/oscuro (ver palette.ts, ahí están los
// valores reales de las dos paletas). Esto es lo que permite que el tema
// oscuro funcione en TODO el frontend sin tocar los ~40 archivos que ya
// hacían `style={{ color: colors.heading }}` — el navegador resuelve la
// variable en cada repintado, ningún componente necesita re-renderizar.
//
// Paleta fija pedida por el usuario — cerrada, no se agregan hex nuevos sin
// agregarlos primero en palette.ts. Dos excepciones deliberadas y señaladas ahí:
// 1. Verde principal (#8BC34A) NO se usa como fondo con texto/ícono blanco:
//    da ~2.1:1 de contraste, falla incluso el mínimo de 3:1 para íconos
//    (WCAG 1.4.11), no solo el 4.5:1 de texto. Donde el verde carga texto o
//    ícono blanco (botón primario, ítem de sidebar seleccionado) se usa
//    "Verde muy oscuro" (#4E6F3A, 5.7:1) — ya está en la paleta dada, no es
//    un color nuevo. #8BC34A queda para acentos que no llevan texto encima:
//    líneas de gráfica, glow de foco, resaltados decorativos.
// 2. La paleta pedida no incluye rojo. Un estado de peligro (anular, stock
//    bajo, factura vencida) es una señal de seguridad, no una preferencia
//    estética — quitarlo es un retroceso real de usabilidad. Se mantiene el
//    rojo por defecto de AntD, marcado como la única excepción a "solo esta
//    paleta".
//
// Las claves purple/orange/red se mantienen por compatibilidad con el resto
// del código (KPIs, tags) — ya no son violeta/naranja, son otro verde/ámbar/
// rojo, pero renombrar la clave en todo el frontend no cambiaba nada visible
// y sí arriesgaba romper referencias.

export const colors = {
    sidebarBg: 'var(--c-sidebarBg)',
    sidebarActiveBg: 'var(--c-sidebarActiveBg)',
    sidebarActiveText: 'var(--c-sidebarActiveText)',
    sidebarText: 'var(--c-sidebarText)',
    sidebarTextMuted: 'var(--c-sidebarTextMuted)',
    sidebarHoverBg: 'var(--c-sidebarHoverBg)',
    sidebarBorder: 'var(--c-sidebarBorder)',

    authPanelBg: 'var(--c-authPanelBg)',

    primary: 'var(--c-primary)',
    primaryDark: 'var(--c-primaryDark)',
    primaryHover: 'var(--c-primaryHover)',
    primaryLight: 'var(--c-primaryLight)',

    accent: 'var(--c-accent)',
    accentBg: 'var(--c-accentBg)',
    accentLight: 'var(--c-accentLight)',

    purple: 'var(--c-purple)',
    purpleLight: 'var(--c-purpleLight)',
    orange: 'var(--c-orange)',
    orangeLight: 'var(--c-orangeLight)',
    red: 'var(--c-red)',
    redLight: 'var(--c-redLight)',

    heading: 'var(--c-heading)',
    textSecondary: 'var(--c-textSecondary)',
    textMuted: 'var(--c-textMuted)',
    border: 'var(--c-border)',
    pageBg: 'var(--c-pageBg)',
    cardBg: 'var(--c-cardBg)',
}
