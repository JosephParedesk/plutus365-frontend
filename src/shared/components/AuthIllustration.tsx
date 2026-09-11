import { colors } from '../theme/colors'

export default function AuthIllustration() {
    return (
        <svg viewBox="0 0 480 480" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            {/* Manchas de color difuminadas, atmósfera de fondo */}
            <defs>
                <filter id="blurGrande" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="40" />
                </filter>
                <linearGradient id="gradPantalla" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1E4640" />
                    <stop offset="1" stopColor="#2E3A2F" />
                </linearGradient>
            </defs>

            <circle cx="90" cy="90" r="110" fill={colors.primary} opacity="0.18" filter="url(#blurGrande)" />
            <circle cx="400" cy="120" r="90" fill={colors.purple} opacity="0.16" filter="url(#blurGrande)" />
            <circle cx="380" cy="400" r="120" fill={colors.orange} opacity="0.14" filter="url(#blurGrande)" />

            {/* Sombra suave en el piso */}
            <ellipse cx="240" cy="410" rx="170" ry="18" fill="#0F2420" opacity="0.08" />

            {/* Caja/paquete morado, atrás a la izquierda */}
            <g transform="translate(60 300)">
                <rect x="0" y="20" width="70" height="60" rx="6" fill={colors.purple} />
                <rect x="0" y="20" width="70" height="16" rx="6" fill="#6A3FD1" />
                <rect x="30" y="20" width="10" height="60" fill="#6A3FD1" />
            </g>

            {/* Caja naranja, atrás a la derecha */}
            <g transform="translate(370 320)">
                <rect x="0" y="10" width="56" height="46" rx="6" fill={colors.orange} />
                <rect x="0" y="10" width="56" height="14" rx="6" fill="#D99A0F" />
            </g>

            {/* Mostrador */}
            <g>
                <rect x="70" y="330" width="340" height="90" rx="14" fill="#17312E" />
                <rect x="70" y="330" width="340" height="18" rx="9" fill="#234F49" />
                <rect x="95" y="365" width="80" height="45" rx="6" fill="#0F2420" opacity="0.5" />
                <rect x="300" y="365" width="80" height="45" rx="6" fill="#0F2420" opacity="0.5" />
            </g>

            {/* Bolsa de compras con el aro Plutus365 */}
            <g transform="translate(300 250)">
                <path d="M8 20 L58 20 L64 90 L2 90 Z" fill="#fff" stroke={colors.border} strokeWidth="2" />
                <path d="M20 20 C20 4, 46 4, 46 20" stroke={colors.primary} strokeWidth="5" fill="none" strokeLinecap="round" />
                <circle cx="33" cy="52" r="13" fill="none" stroke={colors.red} strokeWidth="4" />
                <circle cx="33" cy="52" r="13" fill="none" stroke={colors.orange} strokeWidth="4" strokeDasharray="20 61" strokeDashoffset="-20" />
                <circle cx="33" cy="52" r="13" fill="none" stroke={colors.primary} strokeWidth="4" strokeDasharray="20 61" strokeDashoffset="-41" />
                <circle cx="33" cy="52" r="13" fill="none" stroke={colors.purple} strokeWidth="4" strokeDasharray="20 61" strokeDashoffset="-61" />
            </g>

            {/* Planta pequeña */}
            <g transform="translate(110 260)">
                <path d="M10 40 L26 40 L23 65 L13 65 Z" fill="#D99A0F" />
                <path d="M18 40 C4 34, 4 12, 18 6 C20 20, 20 30, 18 40" fill={colors.primary} />
                <path d="M18 40 C32 34, 32 12, 18 6 C16 20, 16 30, 18 40" fill="#0B7F41" />
            </g>

            {/* Terminal POS con gráfica de crecimiento */}
            <g transform="translate(150 130)">
                <rect x="0" y="0" width="180" height="130" rx="14" fill="url(#gradPantalla)" />
                <rect x="12" y="12" width="156" height="90" rx="8" fill="#0B1E1A" />
                {/* barras de crecimiento */}
                <rect x="28" y="70" width="18" height="24" rx="3" fill={colors.orange} />
                <rect x="54" y="55" width="18" height="39" rx="3" fill={colors.purple} />
                <rect x="80" y="40" width="18" height="54" rx="3" fill={colors.primary} />
                <rect x="106" y="26" width="18" height="68" rx="3" fill={colors.primary} />
                <path d="M28 68 L64 50 L92 38 L124 24" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.85" />
                {/* base/parlante del terminal */}
                <rect x="76" y="130" width="28" height="14" fill="#0F2420" />
                <rect x="66" y="142" width="48" height="8" rx="4" fill="#0F2420" />
            </g>

            {/* Impresora con recibo saliendo */}
            <g transform="translate(345 250)">
                <rect x="0" y="0" width="46" height="30" rx="6" fill="#ECEFEA" />
                <rect x="6" y="-42" width="34" height="46" fill="#fff" stroke={colors.border} strokeWidth="1.5" />
                <line x1="12" y1="-32" x2="34" y2="-32" stroke={colors.border} strokeWidth="2" />
                <line x1="12" y1="-24" x2="34" y2="-24" stroke={colors.border} strokeWidth="2" />
                <line x1="12" y1="-16" x2="26" y2="-16" stroke={colors.border} strokeWidth="2" />
            </g>

            {/* Moneda flotante */}
            <g transform="translate(90 175)">
                <circle cx="0" cy="0" r="16" fill={colors.orange} />
                <circle cx="0" cy="0" r="16" fill="none" stroke="#D99A0F" strokeWidth="2" />
                <text x="0" y="5" fontSize="16" textAnchor="middle" fill="#fff" fontWeight="700">$</text>
            </g>

            {/* Etiqueta de precio flotante */}
            <g transform="translate(400 210) rotate(18)">
                <path d="M0 0 L26 0 L34 8 L26 16 L0 16 Z" fill={colors.red} />
                <circle cx="6" cy="8" r="2.5" fill="#fff" />
            </g>
        </svg>
    )
}
