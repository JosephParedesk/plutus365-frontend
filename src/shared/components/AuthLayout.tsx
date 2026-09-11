import type { ReactNode } from 'react'
import AuthIllustration from './AuthIllustration'
import { colors } from '../theme/colors'
import logoPlutus from '../../assets/logo.png'

interface Props {
    eyebrow?: string
    headline: string
    subtext: string
    children: ReactNode
    ancho?: number
    ocultarLogoIlustracion?: boolean
}

export default function AuthLayout({ eyebrow, headline, subtext, children, ancho = 420, ocultarLogoIlustracion = false }: Props) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex' }}>
            <style>{`
                @media (max-width: 900px) {
                    .auth-panel-ilustracion { display: none !important; }
                    .auth-panel-formulario { flex: 1 1 100% !important; }
                }
            `}</style>

            {/* Panel izquierdo: marca + ilustración */}
            <div
                className="auth-panel-ilustracion"
                style={{
                    flex: '0 0 46%', background: colors.authPanelBg, position: 'relative',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    padding: '40px 48px', overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
                    {!ocultarLogoIlustracion && (
                        <img src={logoPlutus} alt="Plutus365" style={{ height: 100, width: 'auto' }} />
                    )}
                </div>

                <div style={{ margin: '20px 0' }} className="fade-in">
                    <AuthIllustration />
                </div>

                <div className="page-enter">
                    {eyebrow && (
                        <div style={{ color: colors.primaryLight, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
                            {eyebrow}
                        </div>
                    )}
                    <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                        {headline}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
                        {subtext}
                    </p>
                </div>
            </div>

            {/* Panel derecho: contenido de la página */}
            <div
                className="auth-panel-formulario"
                style={{
                    flex: '1 1 54%', background: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 24,
                }}
            >
                <div style={{ width: '100%', maxWidth: ancho }} className="page-enter">
                    {children}
                </div>
            </div>
        </div>
    )
}
