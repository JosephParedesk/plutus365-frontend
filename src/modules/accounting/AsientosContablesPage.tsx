import { useState, useEffect, useMemo } from 'react'
import { Table, Tag, Modal, Empty, Spin, Button, DatePicker, Select } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { BookOutlined, DownloadOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import {
    asientoContableService, ORIGEN_LABEL,
    type AsientoContable, type OrigenAsiento
} from '../../shared/services/contabilidadService'
import { empresaService, type Empresa } from '../../shared/services/empresaService'
import { exportarExcel } from '../../shared/utils/exportarExcel'
import { colors } from '../../shared/theme/colors'

const formatoCOP = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export default function AsientosContablesPage() {
    const [asientos, setAsientos] = useState<AsientoContable[]>([])
    const [loading, setLoading] = useState(true)
    const [seleccionado, setSeleccionado] = useState<AsientoContable | null>(null)

    // El backend no tiene un endpoint de filtrado por fecha para asientos —
    // se filtra en el cliente sobre lo ya cargado, igual que el historial de
    // facturas DIAN. Para un volumen de asientos mucho más grande, el upgrade
    // es un endpoint /asientos/filtrar en contabilidad-service.
    const [rango, setRango] = useState<[Dayjs, Dayjs] | null>(null)
    const [origenFiltro, setOrigenFiltro] = useState<OrigenAsiento | undefined>()

    const [empresa, setEmpresa] = useState<Empresa | null>(null)

    useEffect(() => {
        asientoContableService.listar()
            .then(({ data }) => setAsientos(data))
            .finally(() => setLoading(false))
        empresaService.obtener().then(({ data }) => setEmpresa(data)).catch(() => {})
    }, [])

    const asientosFiltrados = useMemo(() => {
        return asientos.filter(a => {
            if (rango) {
                const fecha = a.fecha?.slice(0, 10)
                if (fecha < rango[0].format('YYYY-MM-DD') || fecha > rango[1].format('YYYY-MM-DD')) return false
            }
            if (origenFiltro && a.origen !== origenFiltro) return false
            return true
        })
    }, [asientos, rango, origenFiltro])

    const colorOrigen: Record<string, string> = { VENTA: 'green', COMPRA: 'orange', MANUAL: 'purple' }

    const descargarExcel = async () => {
        const filas = asientosFiltrados.flatMap(a =>
            a.movimientos.map(m => ({
                numero: a.numero, fecha: a.fecha, origen: ORIGEN_LABEL[a.origen] || a.origen,
                descAsiento: a.descripcion, codCuenta: m.cuentaCodigo, nombreCuenta: m.cuentaNombre,
                debe: m.debe || 0, haber: m.haber || 0, descMovimiento: m.descripcion || '', estado: a.estado,
            }))
        )
        const fecha = new Date().toISOString().split('T')[0]
        await exportarExcel({
            archivo: `movimientos-contables-${fecha}`,
            hoja: 'Movimientos contables',
            titulo: `Movimientos contables al ${fecha}`,
            empresa,
            columnas: [
                { header: 'Número asiento', key: 'numero', width: 16 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Origen', key: 'origen', width: 10 },
                { header: 'Descripción asiento', key: 'descAsiento', width: 30 },
                { header: 'Código cuenta', key: 'codCuenta', width: 14 },
                { header: 'Nombre cuenta', key: 'nombreCuenta', width: 28 },
                { header: 'Debe', key: 'debe', width: 14, moneda: true },
                { header: 'Haber', key: 'haber', width: 14, moneda: true },
                { header: 'Descripción movimiento', key: 'descMovimiento', width: 26 },
                { header: 'Estado', key: 'estado', width: 14 },
            ],
            filas,
        })
    }

    const columnas = [
        {
            title: 'Número', dataIndex: 'numero', key: 'numero',
            render: (v: string) => <span style={{ fontWeight: 700, color: colors.primary }}>{v}</span>
        },
        { title: 'Fecha', dataIndex: 'fecha', key: 'fecha' },
        {
            title: 'Origen', dataIndex: 'origen', key: 'origen',
            render: (v: string) => <Tag color={colorOrigen[v]}>{ORIGEN_LABEL[v as keyof typeof ORIGEN_LABEL] || v}</Tag>
        },
        { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
        {
            title: 'Debe', dataIndex: 'totalDebe', key: 'totalDebe',
            render: (v: number) => formatoCOP.format(v)
        },
        {
            title: 'Haber', dataIndex: 'totalHaber', key: 'totalHaber',
            render: (v: number) => formatoCOP.format(v)
        },
        {
            title: 'Estado', dataIndex: 'estado', key: 'estado',
            render: (v: string) => <Tag color={v === 'CONTABILIZADO' ? 'green' : 'red'}>{v}</Tag>
        },
    ]

    if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <BookOutlined style={{ marginRight: 8 }} />
                        Asientos contables
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Se generan automáticamente al registrar una venta o una compra.
                    </p>
                </div>
                <Button
                    icon={<DownloadOutlined />}
                    onClick={descargarExcel}
                    disabled={asientosFiltrados.length === 0}
                    style={{ borderRadius: 14, fontWeight: 600 }}
                >
                    Descargar Excel
                </Button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <DatePicker.RangePicker
                    value={rango}
                    onChange={(v) => setRango(v && v[0] && v[1] ? [v[0], v[1]] : null)}
                    format="DD/MM/YYYY"
                    placeholder={['Desde', 'Hasta']}
                />
                <Select
                    allowClear
                    placeholder="Todos los orígenes"
                    value={origenFiltro}
                    onChange={setOrigenFiltro}
                    style={{ minWidth: 180 }}
                    options={Object.entries(ORIGEN_LABEL).map(([value, label]) => ({ value, label }))}
                />
            </div>

            <TablaOrdenable
                dataSource={asientosFiltrados}
                columns={columnas}
                rowKey="asientoId"
                onRow={(record) => ({ onClick: () => setSeleccionado(record), style: { cursor: 'pointer' } })}
                pagination={{ pageSize: 15 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Sin asientos en el filtro seleccionado" /> }}
            />

            <Modal
                title={seleccionado && <span style={{ color: colors.heading, fontWeight: 700 }}>{seleccionado.numero} · {seleccionado.descripcion}</span>}
                open={!!seleccionado}
                onCancel={() => setSeleccionado(null)}
                footer={null}
            >
                {seleccionado && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: colors.primaryLight, textAlign: 'left' }}>
                                <th style={{ padding: 8 }}>Cuenta</th>
                                <th style={{ padding: 8, textAlign: 'right' }}>Debe</th>
                                <th style={{ padding: 8, textAlign: 'right' }}>Haber</th>
                            </tr>
                        </thead>
                        <tbody>
                            {seleccionado.movimientos.map((m, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                    <td style={{ padding: 8 }}>
                                        <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{m.cuentaCodigo}</span>
                                        {m.cuentaNombre}
                                    </td>
                                    <td style={{ padding: 8, textAlign: 'right' }}>{m.debe ? formatoCOP.format(m.debe) : ''}</td>
                                    <td style={{ padding: 8, textAlign: 'right' }}>{m.haber ? formatoCOP.format(m.haber) : ''}</td>
                                </tr>
                            ))}
                            <tr style={{ fontWeight: 700 }}>
                                <td style={{ padding: 8 }}>Total</td>
                                <td style={{ padding: 8, textAlign: 'right' }}>{formatoCOP.format(seleccionado.totalDebe)}</td>
                                <td style={{ padding: 8, textAlign: 'right' }}>{formatoCOP.format(seleccionado.totalHaber)}</td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </Modal>
        </div>
    )
}
