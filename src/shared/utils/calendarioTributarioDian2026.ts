// Calendario Tributario DIAN 2026 — tablas oficiales (www.dian.gov.co, PDF
// "Calendario 2026 tributario", Decreto 2229 de 2023). Transcritas y verificadas
// del PDF que subió el usuario (src/assets/Calendario_Tributario_2026.pdf).
//
// Solo cubre IVA (bimestral/cuatrimestral) y Retención en la fuente mensual —
// los dos únicos datos que el sistema puede determinar hoy por empresa
// (Empresa.regimenFiscal/periodicidadIva/agenteRetenedor). Renta, patrimonio,
// RST, etc. dependen de más clasificaciones que el sistema todavía no captura,
// así que NO se muestran (ver [[project]] regla de no inventar datos).
//
// Si cambia el año hay que traer la tabla nueva de la DIAN y regenerar esto —
// no es una fórmula, son fechas fijas que publica la DIAN cada año.

import type { Empresa } from '../services/empresaService'

interface FilaCalendario {
    anio: number
    mes: number       // 1-12
    dias: number[]    // vencimiento por último dígito del NIT: [1,2,3,4,5,6,7,8,9,0]
    periodo: string
}

const idxParaDigito = (digito: number) => (digito === 0 ? 9 : digito - 1)

const IVA_BIMESTRAL_2026: FilaCalendario[] = [
    { anio: 2026, mes: 3, dias: [10, 11, 12, 13, 16, 17, 18, 19, 20, 24], periodo: 'enero-febrero' },
    { anio: 2026, mes: 5, dias: [12, 13, 14, 15, 19, 20, 21, 22, 25, 26], periodo: 'marzo-abril' },
    { anio: 2026, mes: 7, dias: [9, 10, 14, 15, 16, 17, 21, 22, 23, 24], periodo: 'mayo-junio' },
    { anio: 2026, mes: 9, dias: [9, 10, 11, 14, 15, 16, 17, 18, 21, 22], periodo: 'julio-agosto' },
    { anio: 2026, mes: 11, dias: [11, 12, 13, 17, 18, 19, 20, 23, 24, 25], periodo: 'septiembre-octubre' },
    { anio: 2027, mes: 1, dias: [13, 14, 15, 18, 19, 20, 21, 22, 25, 26], periodo: 'noviembre-diciembre' },
]

const IVA_CUATRIMESTRAL_2026: FilaCalendario[] = [
    { anio: 2026, mes: 5, dias: [12, 13, 14, 15, 19, 20, 21, 22, 25, 26], periodo: 'enero-abril' },
    { anio: 2026, mes: 9, dias: [9, 10, 11, 14, 15, 16, 17, 18, 21, 22], periodo: 'mayo-agosto' },
    { anio: 2027, mes: 1, dias: [13, 14, 15, 18, 19, 20, 21, 22, 25, 26], periodo: 'septiembre-diciembre' },
]

const RETENCION_FUENTE_2026: FilaCalendario[] = [
    { anio: 2026, mes: 2, dias: [10, 11, 12, 13, 16, 17, 18, 19, 20, 23], periodo: 'enero' },
    { anio: 2026, mes: 3, dias: [10, 11, 12, 13, 16, 17, 18, 19, 20, 24], periodo: 'febrero' },
    { anio: 2026, mes: 4, dias: [13, 14, 15, 16, 20, 21, 22, 23, 24, 27], periodo: 'marzo' },
    { anio: 2026, mes: 5, dias: [12, 13, 14, 15, 19, 20, 21, 22, 25, 26], periodo: 'abril' },
    { anio: 2026, mes: 6, dias: [10, 11, 12, 16, 17, 18, 19, 22, 23, 24], periodo: 'mayo' },
    { anio: 2026, mes: 7, dias: [9, 10, 14, 15, 16, 17, 21, 22, 23, 24], periodo: 'junio' },
    { anio: 2026, mes: 8, dias: [12, 13, 14, 18, 19, 20, 21, 24, 25, 26], periodo: 'julio' },
    { anio: 2026, mes: 9, dias: [9, 10, 11, 14, 15, 16, 17, 18, 21, 22], periodo: 'agosto' },
    { anio: 2026, mes: 10, dias: [9, 13, 14, 15, 16, 19, 20, 21, 22, 23], periodo: 'septiembre' },
    { anio: 2026, mes: 11, dias: [11, 12, 13, 17, 18, 19, 20, 23, 24, 25], periodo: 'octubre' },
    { anio: 2026, mes: 12, dias: [10, 11, 14, 15, 16, 17, 18, 21, 22, 23], periodo: 'noviembre' },
    { anio: 2027, mes: 1, dias: [13, 14, 15, 18, 19, 20, 21, 22, 25, 26], periodo: 'diciembre' },
]

export interface VencimientoTributario {
    fecha: Date
    label: string
    detalle: string
}

function proximaFilaVencida(tabla: FilaCalendario[], idx: number, hoy: Date): FilaCalendario | undefined {
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    return tabla.find(f => new Date(f.anio, f.mes - 1, f.dias[idx]) >= inicioHoy)
}

// Solo devuelve vencimientos para lo que la empresa configuró explícitamente
// (regimenFiscal + periodicidadIva, agenteRetenedor) — si falta configurar,
// devuelve [] en vez de asumir/inventar una obligación que puede no aplicar.
export function proximosVencimientosDian(empresa: Empresa | null | undefined, hoy: Date = new Date()): VencimientoTributario[] {
    if (!empresa?.numeroDocumento) return []
    const nit = empresa.numeroDocumento.replace(/\D/g, '')
    if (!nit) return []
    const idx = idxParaDigito(Number(nit[nit.length - 1]))

    const resultado: VencimientoTributario[] = []

    if (empresa.regimenFiscal === 'RESPONSABLE_IVA' && empresa.periodicidadIva) {
        const tabla = empresa.periodicidadIva === 'BIMESTRAL' ? IVA_BIMESTRAL_2026 : IVA_CUATRIMESTRAL_2026
        const fila = proximaFilaVencida(tabla, idx, hoy)
        if (fila) resultado.push({
            fecha: new Date(fila.anio, fila.mes - 1, fila.dias[idx]),
            label: 'IVA ' + (empresa.periodicidadIva === 'BIMESTRAL' ? 'bimestral' : 'cuatrimestral'),
            detalle: `Período ${fila.periodo}`,
        })
    }

    if (empresa.agenteRetenedor) {
        const fila = proximaFilaVencida(RETENCION_FUENTE_2026, idx, hoy)
        if (fila) resultado.push({
            fecha: new Date(fila.anio, fila.mes - 1, fila.dias[idx]),
            label: 'Retención en la fuente',
            detalle: `Mes de ${fila.periodo}`,
        })
    }

    return resultado.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
}
