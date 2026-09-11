import { useState, useEffect } from 'react'
import { Table, Select, DatePicker, Tag, Empty, Tooltip, Button } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { FileTextOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { ventaService, type Venta } from '../../shared/services/ventaService'
import { clienteService } from '../../shared/services/clienteService'
import { empresaService } from '../../shared/services/empresaService'
import ReciboModal from './ReciboModal'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const { RangePicker } = DatePicker

export default function FacturasVentaPage() {
    const [ventas, setVentas] = useState<Venta[]>([])
    const [clientes, setClientes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [clienteId, setClienteId] = useState<number | undefined>()
    const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
    const [verRecibo, setVerRecibo] = useState<Venta | null>(null)
    const [nombreEmpresa, setNombreEmpresa] = useState('')

    useEffect(() => {
        empresaService.obtener()
            .then(({ data }) => setNombreEmpresa(data.nombreComercial || data.razonSocial || data.nombres || ''))
            .catch(() => setNombreEmpresa(''))
    }, [])

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([
            ventaService.filtrar({
                clienteId,
                fechaInicio: rango[0].format('YYYY-MM-DD'),
                fechaFin: rango[1].format('YYYY-MM-DD'),
            }),
            clienteService.listar(),
        ]).then(([rv, rc]) => {
            if (rv.status === 'fulfilled') setVentas(rv.value.data)
            if (rc.status === 'fulfilled') setClientes(rc.value.data)
        }).finally(() => setLoading(false))
    }

    useEffect(cargar, [clienteId, rango])

    const totalPeriodo = ventas.filter(v => v.estado === 'REGISTRADA').reduce((s, v) => s + v.total, 0)

    const columnas = [
        { title: 'Número', dataIndex: 'numeroVenta', render: (v: string) => <strong style={{ color: colors.primary }}>{v}</strong> },
        { title: 'Cliente', dataIndex: 'clienteNombre', render: (v: string) => v || 'Consumidor final' },
        { title: 'Fecha', dataIndex: 'fecha', render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '' },
        {
            title: 'Formas de pago', dataIndex: 'formasPago',
            render: (fp: Venta['formasPago']) => (fp || []).map(f => f.metodo).join(', ') || '—'
        },
        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v || 0)}</strong> },
        {
            title: 'Saldo', dataIndex: 'saldoPendiente', align: 'right' as const,
            render: (v: number) => v ? <span style={{ color: colors.red, fontWeight: 600 }}>{cop.format(v)}</span> : <span style={{ color: colors.textMuted }}>Pagada</span>
        },
        {
            title: 'Estado', dataIndex: 'estado',
            render: (v: string) => <Tag color={v === 'ANULADA' ? 'red' : 'green'}>{v}</Tag>
        },
        {
            title: '', key: 'acciones', width: 60,
            render: (_: any, r: Venta) => (
                <Tooltip title="Ver comprobante">
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setVerRecibo(r)} />
                </Tooltip>
            )
        },
    ]

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    Facturas de venta / Ingresos
                </h2>
                <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                    Ventas ya registradas — el propio ticket del POS es la factura, esta es su listado
                </p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <RangePicker
                    value={rango}
                    onChange={(v) => v && v[0] && v[1] && setRango([v[0], v[1]])}
                    format="DD/MM/YYYY"
                    allowClear={false}
                />
                <Select
                    showSearch allowClear optionFilterProp="label"
                    placeholder="Todos los clientes"
                    value={clienteId} onChange={setClienteId}
                    style={{ minWidth: 240 }}
                    options={clientes.map(c => ({
                        value: c.clienteId,
                        label: `${c.nombres || c.razonSocial || ''} ${c.apellidos || ''} — ${c.numeroDocumento || ''}`.trim(),
                    }))}
                />
                <span style={{ marginLeft: 'auto', fontSize: 13, color: colors.textSecondary }}>
                    Total del período: <strong style={{ color: colors.heading }}>{cop.format(totalPeriodo)}</strong>
                </span>
            </div>

            <TablaOrdenable
                dataSource={ventas}
                columns={columnas}
                rowKey="ventaId"
                loading={loading}
                pagination={{ pageSize: 15 }}
                scroll={{ x: 1000 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Sin ventas en este período" /> }}
            />

            <ReciboModal
                venta={verRecibo}
                empresaNombre={nombreEmpresa || 'Tu empresa'}
                clienteCorreo={undefined}
                open={!!verRecibo}
                onClose={() => setVerRecibo(null)}
            />
        </div>
    )
}
