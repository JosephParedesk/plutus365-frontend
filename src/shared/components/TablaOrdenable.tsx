import { useMemo, useState } from 'react'
import { Table, Button } from 'antd'
import { UndoOutlined } from '@ant-design/icons'
import type { TableProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'

// Reemplazo drop-in de <Table> de antd: le agrega orden por columna (clic en el
// encabezado — texto alfabético, número o fecha, se detecta solo por el valor)
// a TODAS las columnas con dataIndex, y un botón "Restablecer orden" que solo
// aparece cuando hay un orden activo, para volver al orden original de los datos.
//
// Uso: en cualquier archivo, cambiar `<Table` por `<TablaOrdenable` (mismos props,
// mismo comportamiento de siempre) — no hace falta tocar las columnas ni el resto.

function parsearFecha(s: string): number | null {
    // yyyy-mm-dd o yyyy-mm-ddThh:mm:ss (lo que devuelve el backend)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const t = Date.parse(s)
        return isNaN(t) ? null : t
    }
    // dd/mm/yyyy (lo que ya viene formateado en algunas columnas)
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) {
        const t = Date.parse(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`)
        return isNaN(t) ? null : t
    }
    return null
}

function compararValores(a: any, b: any): number {
    if (a == null && b == null) return 0
    if (a == null) return -1
    if (b == null) return 1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
    const sa = String(a), sb = String(b)
    const fa = parsearFecha(sa), fb = parsearFecha(sb)
    if (fa !== null && fb !== null) return fa - fb
    return sa.localeCompare(sb, 'es', { numeric: true, sensitivity: 'base' })
}

export default function TablaOrdenable<T extends object = any>(props: TableProps<T>) {
    const [sortedInfo, setSortedInfo] = useState<SorterResult<T>>({})

    const columnas = useMemo(() => (props.columns || []).map((c: any) => {
        // sorter: false en una columna puntual la deja sin ordenar (ej. "Acciones")
        if (!c.dataIndex || c.sorter === false) return c
        const key = c.key ?? c.dataIndex
        return {
            ...c,
            sorter: (a: any, b: any) => compararValores(a[c.dataIndex], b[c.dataIndex]),
            sortOrder: sortedInfo.columnKey === key ? sortedInfo.order : null,
        }
    }), [props.columns, sortedInfo])

    const hayOrden = !!sortedInfo.order

    return (
        <Table
            {...props}
            columns={columnas}
            onChange={(pagination, filters, sorter, extra) => {
                setSortedInfo(Array.isArray(sorter) ? sorter[0] || {} : sorter)
                props.onChange?.(pagination, filters, sorter, extra)
            }}
            title={hayOrden ? (data) => (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button size="small" icon={<UndoOutlined />} onClick={() => setSortedInfo({})}>
                        Restablecer orden
                    </Button>
                </div>
            ) : props.title}
        />
    )
}
