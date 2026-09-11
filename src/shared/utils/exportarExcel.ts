import ExcelJS from 'exceljs'
import type { Empresa } from '../services/empresaService'

export interface ColumnaExcel {
    header: string
    key: string
    width?: number
    // Formato de miles sin decimales, alineado a la derecha — para columnas de plata.
    moneda?: boolean
}

interface ExportarExcelOpts {
    archivo: string            // nombre del archivo, sin extensión
    hoja?: string               // nombre de la pestaña — default 'Datos'
    titulo: string              // título del reporte, ej. "Balance General al 2026-08-08"
    columnas: ColumnaExcel[]
    filas: Record<string, any>[]
    empresa?: Empresa | null    // si viene, arma el encabezado con logo/color/datos
}

const COLOR_DEFECTO = '4E6F3A' // verde de marca — mismo default que EmpresaUseCase.guardarConfiguracion

function aArgb(hex?: string): string {
    const limpio = (hex || COLOR_DEFECTO).replace('#', '').toUpperCase()
    return 'FF' + (limpio.length === 6 ? limpio : COLOR_DEFECTO)
}

// Blanco o negro según qué tanto contraste da sobre el color de marca — así el
// encabezado de la tabla se lee bien sin importar qué color haya elegido la empresa.
function colorTextoContraste(hex: string): string {
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
    const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminancia > 0.6 ? 'FF000000' : 'FFFFFFFF'
}

async function logoABase64(url?: string): Promise<{ base64: string; extension: 'png' | 'jpeg' } | null> {
    if (!url) return null
    try {
        const resp = await fetch(url)
        if (!resp.ok) return null
        const blob = await resp.blob()
        const extension = blob.type.includes('png') ? 'png' : 'jpeg'
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
        return { base64, extension }
    } catch {
        // sin logo, sin drama — el Excel sale igual, solo sin la imagen
        return null
    }
}

function nombreEmpresa(e: Empresa): string {
    return e.nombreComercial || e.razonSocial || [e.nombres, e.apellidos].filter(Boolean).join(' ') || ''
}

export async function exportarExcel(opts: ExportarExcelOpts): Promise<void> {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Plutus365'
    wb.created = new Date()
    const ws = wb.addWorksheet(opts.hoja || 'Datos')

    const argb = aArgb(opts.empresa?.colorPrincipal)
    const textoEncabezado = colorTextoContraste(argb.slice(2))

    ws.columns = opts.columnas.map(c => ({ key: c.key, width: c.width || 18 }))

    let fila = 1

    // ── Encabezado: logo + datos de la empresa ─────────────────────────────
    if (opts.empresa) {
        const logo = await logoABase64(opts.empresa.logoUrl)
        if (logo) {
            const imgId = wb.addImage({ base64: logo.base64, extension: logo.extension })
            ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 90, height: 60 } })
            // El alto por defecto de una fila (~15pt) es más chico que el logo (60px ≈
            // 45pt) — sin esto el texto de al lado le queda encima.
            ws.getRow(1).height = 18
            ws.getRow(2).height = 18
            ws.getRow(3).height = 18
        }

        const colInfo = logo ? 2 : 0 // deja espacio a la derecha del logo si hay
        ws.getCell(fila, colInfo + 1).value = nombreEmpresa(opts.empresa)
        ws.getCell(fila, colInfo + 1).font = { bold: true, size: 14, color: { argb: 'FF' + argb.slice(2) } }
        fila++

        const doc = [opts.empresa.tipoDocumento, opts.empresa.numeroDocumento].filter(Boolean).join(' ')
        const contacto = [doc, opts.empresa.direccion, opts.empresa.ciudad].filter(Boolean).join(' · ')
        if (contacto) {
            ws.getCell(fila, colInfo + 1).value = contacto
            ws.getCell(fila, colInfo + 1).font = { size: 10, color: { argb: 'FF888888' } }
            fila++
        }
        fila = Math.max(fila, 4) // deja al menos el alto del logo antes de seguir
    }

    fila++ // separador

    // ── Título del reporte ──────────────────────────────────────────────────
    ws.getCell(fila, 1).value = opts.titulo
    ws.getCell(fila, 1).font = { bold: true, size: 12 }
    fila++
    fila++ // separador

    // ── Encabezado de la tabla ───────────────────────────────────────────────
    const filaEncabezado = fila
    opts.columnas.forEach((c, i) => {
        const celda = ws.getCell(filaEncabezado, i + 1)
        celda.value = c.header
        celda.font = { bold: true, color: { argb: textoEncabezado } }
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
        celda.alignment = { vertical: 'middle', horizontal: c.moneda ? 'right' : 'left' }
        celda.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }
    })
    ws.getRow(filaEncabezado).height = 20

    // ── Filas de datos ──────────────────────────────────────────────────────
    opts.filas.forEach((f, idxFila) => {
        const filaExcel = filaEncabezado + 1 + idxFila
        opts.columnas.forEach((c, i) => {
            const celda = ws.getCell(filaExcel, i + 1)
            celda.value = f[c.key] ?? ''
            celda.border = {
                top: { style: 'hair', color: { argb: 'FFEEEEEE' } },
                bottom: { style: 'hair', color: { argb: 'FFEEEEEE' } },
            }
            if (c.moneda) {
                celda.numFmt = '#,##0'
                celda.alignment = { horizontal: 'right' }
            }
            if (idxFila % 2 === 1) {
                celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } }
            }
        })
    })

    ws.autoFilter = {
        from: { row: filaEncabezado, column: 1 },
        to: { row: filaEncabezado, column: opts.columnas.length },
    }
    ws.views = [{ state: 'frozen', ySplit: filaEncabezado }]

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${opts.archivo}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
}
