import { useState, useEffect } from 'react'

/**
 * Refleja `prefers-reduced-motion` en vivo. index.css ya apaga animaciones
 * y transiciones CSS bajo esa media query, pero eso no alcanza a las
 * animaciones internas de librerías como recharts (SVG animado vía JS,
 * no vía `animation`/`transition`) — los charts deben apagarlas a mano
 * pasando `isAnimationActive={!prefersReducedMotion}`.
 */
export function useReducedMotion() {
    const [reduced, setReduced] = useState(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        const listener = () => setReduced(mq.matches)
        mq.addEventListener('change', listener)
        return () => mq.removeEventListener('change', listener)
    }, [])
    return reduced
}
