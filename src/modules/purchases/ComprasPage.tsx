import { useState, useEffect, useCallback } from 'react'
import { colors } from '../../shared/theme/colors'
import {
    Table, Button, Input, Tag, Space, Select, DatePicker, message,
    Popconfirm, Card, Row, Col, Statistic, Dropdown
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    SearchOutlined, PlusOutlined, DownOutlined, FileExcelOutlined,
    ShoppingCartOutlined, FileTextOutlined, StopOutlined, EyeOutlined, SendOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import { proveedorService } from '../../shared/services/proveedorService'
import type { Proveedor } from '../../shared/services/proveedorService'
import {
    compraService, TIPO_TRANSACCION_LABEL, ESTADO_COLOR,
    type Compra, type TipoTransaccion, type FiltrosCompra
} from '../../shared/services/compraService'
import { documentoSoporteService } from '../../shared/services/facturacionService'

const RANGOS_RAPIDOS: { label: string; dias: number }[] = [
    { label: 'Hoy', dias: 0 },
    { label: 'Últimos 7 días', dias: 7 },
    { label: 'Últimos 15 días', dias: 15 },
    { label: 'Últimos 30 días', dias: 30 },
]

export default function ComprasPage() {
    const navigate = useNavigate()
    const [compras, setCompras] = useState<Compra[]>([])
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [loading, setLoading] = useState(true)

    // ── Filtros ──
    const [proveedorId, setProveedorId] = useState<number | undefined>()
    const [tipoTransaccion, setTipoTransaccion] = useState<TipoTransaccion | undefined>()
    const [rango, setRango] = useState<[Dayjs, Dayjs] | null>([
        dayjs().subtract(15, 'day'), dayjs()
    ])
    const [creadoPor, setCreadoPor] = useState('')
    const [rangoRapido, setRangoRapido] = useState('Últimos 15 días')

    // ── Carga inicial ──
    const cargarProveedores = useCallback(() => {
        proveedorService.listar()
            .then(({ data }) => setProveedores(data))
            .catch(() => { /* silencioso, no es crítico para la tabla */ })
    }, [])

    const buscar = useCallback(() => {
        setLoading(true)
        const filtros: FiltrosCompra = {
            proveedorId,
            tipoTransaccion,
            fechaInicio: rango?.[0]?.format('YYYY-MM-DD'),
            fechaFin: rango?.[1]?.format('YYYY-MM-DD'),
            creadoPor: creadoPor || undefined,
        }
        compraService.filtrar(filtros)
            .then(({ data }) => setCompras(data))
            .catch(() => message.error('Error al cargar las compras'))
            .finally(() => setLoading(false))
    }, [proveedorId, tipoTransaccion, rango, creadoPor])

    useEffect(() => {
        cargarProveedores()
        buscar()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const limpiarFiltros = () => {
        setProveedorId(undefined)
        setTipoTransaccion(undefined)
        setCreadoPor('')
        setRango([dayjs().subtract(15, 'day'), dayjs()])
        setRangoRapido('Últimos 15 días')
        setTimeout(buscar, 0)
    }

    const aplicarRangoRapido = (label: string, dias: number) => {
        setRangoRapido(label)
        setRango([dayjs().subtract(dias, 'day'), dayjs()])
    }

    const anularCompra = async (compraId: number) => {
        try {
            await compraService.anular(compraId)
            message.success('Compra anulada')
            buscar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al anular la compra')
        }
    }

    // Documento soporte DIAN (compras a proveedores no obligados a facturar) — se
    // genera con un clic, sin ítems que completar a mano, ya vienen de la compra.
    const [generandoDS, setGenerandoDS] = useState<number | null>(null)
    const generarDocumentoSoporte = async (compraId: number) => {
        setGenerandoDS(compraId)
        try {
            const { data } = await documentoSoporteService.generar(compraId)
            message.success(
                data.estado === 'ACEPTADA'
                    ? `Documento soporte ${data.numeroDocumento} aceptado por la DIAN`
                    : `Documento soporte ${data.numeroDocumento}: ${data.estado}`
            )
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo generar el documento soporte')
        } finally {
            setGenerandoDS(null)
        }
    }

    // ── Estadísticas rápidas ──
    const totalRegistradas = compras.filter(c => c.estado === 'REGISTRADA').length
    const totalPagar = compras
        .filter(c => c.estado === 'REGISTRADA')
        .reduce((s, c) => s + (c.totalPagar || 0), 0)

    // ── Columnas ──
    const columnas = [
        {
            title: 'Tipo de transacción',
            dataIndex: 'tipoTransaccion',
            key: 'tipoTransaccion',
            render: (v: TipoTransaccion) => (
                <Tag
                    icon={v === 'FACTURA_COMPRA' ? <FileTextOutlined /> : <ShoppingCartOutlined />}
                    color={v === 'FACTURA_COMPRA' ? 'red' : 'volcano'}
                    style={{ borderRadius: 10 }}
                >
                    {TIPO_TRANSACCION_LABEL[v]}
                </Tag>
            )
        },
        {
            title: 'Comprobante',
            dataIndex: 'numeroComprobante',
            key: 'numeroComprobante',
            render: (v: string) => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: colors.primary }}>{v}</span>
        },
        {
            title: 'Factura proveedor',
            dataIndex: 'numeroComprobante',
            key: 'facturaProveedor',
            render: () => <span style={{ color: colors.textMuted }}>—</span>
        },
        {
            title: 'Fecha elaboración',
            dataIndex: 'fechaElaboracion',
            key: 'fechaElaboracion',
            render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—'
        },
        {
            title: 'Identificación',
            key: 'identificacion',
            render: (_: any, record: Compra) => {
                const prov = proveedores.find(p => p.proveedorId === record.proveedorId)
                return prov?.nit || '—'
            }
        },
        {
            title: 'Sucursal',
            dataIndex: 'sucursal',
            key: 'sucursal',
            render: (v: string) => v || '—'
        },
        {
            title: 'Proveedor',
            dataIndex: 'proveedorNombre',
            key: 'proveedorNombre',
            render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>
        },
        {
            title: 'Total a pagar',
            dataIndex: 'totalPagar',
            key: 'totalPagar',
            render: (v: number) => v != null
                ? <span style={{ fontWeight: 700 }}>${v.toLocaleString('es-CO')}</span>
                : '—'
        },
        {
            title: 'Saldo pendiente',
            key: 'saldoPendiente',
            render: (_: any, record: Compra) => {
                if (!record.tieneCreditoProveedor) return '—'
                const vencido = record.fechaVencimientoCredito && dayjs(record.fechaVencimientoCredito).isBefore(dayjs(), 'day')
                const saldo = record.saldoPendiente ?? 0
                return (
                    <div>
                        <span style={{ fontWeight: 700, color: saldo > 0 ? (vencido ? colors.red : colors.orange) : colors.primary }}>
                            ${saldo.toLocaleString('es-CO')}
                        </span>
                        {saldo > 0 && record.fechaVencimientoCredito && (
                            <div style={{ fontSize: 11, color: vencido ? colors.red : colors.textMuted }}>
                                {vencido ? 'Vencido' : 'Vence'} {dayjs(record.fechaVencimientoCredito).format('DD/MM/YYYY')}
                            </div>
                        )}
                    </div>
                )
            }
        },
        {
            title: 'Estado',
            dataIndex: 'estado',
            key: 'estado',
            render: (v: Compra['estado']) => v ? <Tag color={ESTADO_COLOR[v]}>{v}</Tag> : '—'
        },
        {
            title: 'Acciones',
            key: 'acciones',
            render: (_: any, record: Compra) => (
                <Space>
                    <Button
                        type="text" icon={<EyeOutlined />}
                        onClick={() => navigate(`/compras/ver/${record.compraId}`)}
                    />
                    {record.tipoTransaccion === 'DOCUMENTO_SOPORTE' && record.estado === 'REGISTRADA' && (
                        <Button
                            type="text" icon={<SendOutlined />}
                            loading={generandoDS === record.compraId}
                            title="Generar documento soporte ante la DIAN"
                            onClick={() => generarDocumentoSoporte(record.compraId!)}
                        />
                    )}
                    {record.estado === 'REGISTRADA' && (
                        <Popconfirm
                            title="¿Anular esta compra?"
                            description="Esta acción no se puede deshacer"
                            onConfirm={() => anularCompra(record.compraId!)}
                            okText="Sí, anular" cancelText="Cancelar"
                            okButtonProps={{ danger: true }}
                        >
                            <Button type="text" icon={<StopOutlined />} danger />
                        </Popconfirm>
                    )}
                </Space>
            )
        },
    ]

    const opcionesNuevo = [
        { key: 'FACTURA_COMPRA', label: 'Factura de Compra / Gasto', icon: <FileTextOutlined /> },
        { key: 'DOCUMENTO_SOPORTE', label: 'Documento soporte', icon: <FileTextOutlined /> },
        { key: 'FACTURA_COMPRA_ELECTRONICA', label: 'Factura de compra electrónica', icon: <FileTextOutlined /> },
        { key: 'ORDEN_COMPRA', label: 'Orden de Compra', icon: <ShoppingCartOutlined /> },
        { type: 'divider' as const },
        { key: 'RECIBO_PAGO', label: 'Recibo de Pago / Egreso', icon: <ShoppingCartOutlined /> },
        { key: 'NOTA_DEBITO', label: 'Nota débito / Nota de ajuste', icon: <FileTextOutlined /> },
        { key: 'AJUSTE_CARTERA', label: 'Ajuste cartera / proveedores', icon: <FileTextOutlined /> },
    ]

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        Compras, Gastos y Documento Soporte
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: 0, fontSize: 13 }}>
                        {compras.length} transacciones encontradas
                    </p>
                </div>
                <Dropdown
                    menu={{
                        items: opcionesNuevo,
                        onClick: ({ key }) => navigate(`/compras/nueva?tipo=${key}`)
                    }}
                >
                    <Button type="primary" style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}>
                        Nueva Compra / Gasto / Doc Soporte <DownOutlined />
                    </Button>
                </Dropdown>
            </div>

            {/* Tarjetas resumen */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={12} sm={8}>
                    <Card size="small" style={{ borderRadius: 16, borderColor: colors.border }}>
                        <Statistic title="Transacciones registradas" value={totalRegistradas} valueStyle={{ color: colors.primary, fontWeight: 700 }} />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card size="small" style={{ borderRadius: 16, borderColor: colors.border }}>
                        <Statistic
                            title="Total a pagar (periodo)"
                            value={totalPagar}
                            formatter={v => `$${Number(v).toLocaleString('es-CO')}`}
                            valueStyle={{ color: '#52c41a', fontWeight: 700, fontSize: 16 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card size="small" style={{ borderRadius: 16, borderColor: colors.border }}>
                        <Statistic title="Proveedores activos" value={proveedores.filter(p => p.activo).length} valueStyle={{ color: colors.heading, fontWeight: 700 }} />
                    </Card>
                </Col>
            </Row>

            {/* Panel de filtros (igual a la imagen) */}
            <Card size="small" style={{ borderRadius: 16, marginBottom: 16, borderColor: colors.border }}>
                <Row gutter={[16, 12]}>
                    <Col xs={24} md={12}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Proveedor</div>
                        <Select
                            placeholder="Buscar"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            value={proveedorId}
                            onChange={setProveedorId}
                            style={{ width: '100%' }}
                            options={proveedores.map(p => ({
                                value: p.proveedorId,
                                label: `${p.nombre} · ${p.nit}`
                            }))}
                        />
                    </Col>
                    <Col xs={24} md={12}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fecha elaboración</div>
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                value={rangoRapido}
                                onChange={(label) => {
                                    const opt = RANGOS_RAPIDOS.find(r => r.label === label)
                                    if (opt) aplicarRangoRapido(opt.label, opt.dias)
                                }}
                                style={{ width: 160 }}
                                options={RANGOS_RAPIDOS.map(r => ({ value: r.label, label: r.label }))}
                            />
                            <DatePicker.RangePicker
                                value={rango}
                                onChange={(v) => setRango(v as [Dayjs, Dayjs] | null)}
                                format="DD/MM/YYYY"
                                style={{ width: '100%' }}
                            />
                        </Space.Compact>
                    </Col>
                    <Col xs={24} md={12}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Tipo de transacción</div>
                        <Select
                            placeholder="Todos"
                            allowClear
                            value={tipoTransaccion}
                            onChange={setTipoTransaccion}
                            style={{ width: '100%' }}
                            options={[
                                { value: 'FACTURA_COMPRA', label: 'Factura de compra' },
                                { value: 'RECIBO_EGRESO', label: 'Recibo / Egreso' },
                            ]}
                        />
                    </Col>
                    <Col xs={24} md={12}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Creado por</div>
                        <Input
                            placeholder="Buscar"
                            prefix={<SearchOutlined style={{ color: colors.textMuted }} />}
                            value={creadoPor}
                            onChange={e => setCreadoPor(e.target.value)}
                            allowClear
                        />
                    </Col>
                </Row>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <Button
                        type="primary" icon={<SearchOutlined />} onClick={buscar} loading={loading}
                        style={{ background: colors.primary, borderColor: colors.primary }}
                    >
                        Buscar
                    </Button>
                    <Button onClick={limpiarFiltros}>
                        Limpiar filtros
                    </Button>
                </div>
            </Card>

            {/* Tabla */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Button icon={<FileExcelOutlined />} size="small">
                    Exportar
                </Button>
            </div>

            <TablaOrdenable
                dataSource={compras}
                rowKey="compraId"
                columns={columnas}
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `${t} registros` }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                scroll={{ x: 1100 }}
                size="middle"
            />
        </div>
    )
}
