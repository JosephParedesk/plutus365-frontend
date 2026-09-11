import { useState, useEffect } from 'react'
import {
    Table, Button, Modal, Select, Input, InputNumber, DatePicker, Tag, Radio,
    message, Popconfirm, Empty, Alert, Tooltip, Checkbox, Divider
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { WalletOutlined, PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
    reciboCajaService, ORIGEN_DINERO_LABEL, TIPO_RECIBO_CAJA_LABEL,
    type ReciboCaja, type TipoReciboCaja, type OrigenDineroRecibo, type Venta, type AplicacionCobro,
} from '../../shared/services/ventaService'
import { clienteService, type Cliente } from '../../shared/services/clienteService'
import CrearClienteModal from '../../shared/components/CrearClienteModal'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export default function RecibosCajaPage() {
    const [recibos, setRecibos] = useState<ReciboCaja[]>([])
    const [clientes, setClientes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [modalNuevo, setModalNuevo] = useState(false)
    const [tipoRecibo, setTipoRecibo] = useState<TipoReciboCaja>('ABONO_CARTERA')
    const [clienteId, setClienteId] = useState<number | undefined>()
    const [modalCliente, setModalCliente] = useState(false)
    const [cartera, setCartera] = useState<Venta[]>([])
    const [cargandoCartera, setCargandoCartera] = useState(false)
    const [aplicaciones, setAplicaciones] = useState<Record<number, number>>({}) // ventaId -> valorAplicado
    const [totalAnticipo, setTotalAnticipo] = useState<number>(0)
    const [origenDinero, setOrigenDinero] = useState<OrigenDineroRecibo>('EFECTIVO')
    const [fechaRecibido, setFechaRecibido] = useState<Dayjs>(dayjs())
    const [referenciaPago, setReferenciaPago] = useState('')
    const [guardando, setGuardando] = useState(false)

    const [detalle, setDetalle] = useState<ReciboCaja | null>(null)

    const [rangoLista, setRangoLista] = useState<[Dayjs, Dayjs]>([dayjs().subtract(90, 'day'), dayjs()])
    const [clienteFiltroLista, setClienteFiltroLista] = useState<number | undefined>()

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([
            reciboCajaService.filtrar(rangoLista[0].format('YYYY-MM-DD'), rangoLista[1].format('YYYY-MM-DD')),
            clienteService.listar(),
        ])
            .then(([rr, rc]) => {
                if (rr.status === 'fulfilled') setRecibos(rr.value.data)
                if (rc.status === 'fulfilled') setClientes(rc.value.data)
            })
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [rangoLista])

    const recibosFiltrados = clienteFiltroLista
        ? recibos.filter(r => r.clienteId === clienteFiltroLista)
        : recibos

    useEffect(() => {
        if (tipoRecibo !== 'ABONO_CARTERA' || !modalNuevo) return
        setCargandoCartera(true)
        reciboCajaService.cartera(clienteId)
            .then(({ data }) => setCartera(data))
            .catch(() => message.error('No se pudo cargar la cartera pendiente'))
            .finally(() => setCargandoCartera(false))
    }, [clienteId, tipoRecibo, modalNuevo])

    const totalAplicado = Object.values(aplicaciones).reduce((s, v) => s + (v || 0), 0)
    const totalRecibido = tipoRecibo === 'ABONO_CARTERA' ? totalAplicado : totalAnticipo

    const limpiar = () => {
        setTipoRecibo('ABONO_CARTERA'); setClienteId(undefined); setCartera([]); setAplicaciones({})
        setTotalAnticipo(0); setOrigenDinero('EFECTIVO'); setFechaRecibido(dayjs()); setReferenciaPago('')
    }

    const registrar = async () => {
        if (totalRecibido <= 0) { message.warning('El valor recibido debe ser mayor a 0'); return }
        if (tipoRecibo === 'ANTICIPO' && !clienteId) { message.warning('Selecciona el cliente que hace el anticipo'); return }

        setGuardando(true)
        try {
            const cliente = clientes.find(c => c.clienteId === clienteId)
            const payload: ReciboCaja = {
                clienteId,
                clienteNombre: cliente ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim() || cliente.razonSocial : undefined,
                fechaRecibido: fechaRecibido.format('YYYY-MM-DD'),
                tipoRecibo,
                origenDinero,
                referenciaPago: referenciaPago || undefined,
                totalRecibido,
            }
            if (tipoRecibo === 'ABONO_CARTERA') {
                payload.aplicaciones = Object.entries(aplicaciones)
                    .filter(([, valor]) => valor > 0)
                    .map(([ventaId, valorAplicado]): AplicacionCobro => ({ ventaId: Number(ventaId), valorAplicado }))
                if (payload.aplicaciones.length === 0) { message.warning('Indica cuánto abonas a cada factura'); setGuardando(false); return }
            }

            const { data } = await reciboCajaService.registrar(payload)
            message.success(`Recibo ${data.numeroRecibo} registrado`)
            setModalNuevo(false)
            limpiar()
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo registrar el recibo')
        } finally {
            setGuardando(false)
        }
    }

    const anular = async (id: number) => {
        try {
            await reciboCajaService.anular(id)
            message.success('Recibo anulado, la deuda vuelve a las facturas')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo anular')
        }
    }

    const columnas = [
        { title: 'Número', dataIndex: 'numeroRecibo', render: (v: string) => <strong style={{ color: colors.primary }}>{v}</strong> },
        { title: 'Cliente', dataIndex: 'clienteNombre', render: (v: string) => v || 'Sin cliente' },
        { title: 'Fecha', dataIndex: 'fechaRecibido', render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '' },
        { title: 'Tipo', dataIndex: 'tipoRecibo', render: (v: TipoReciboCaja) => TIPO_RECIBO_CAJA_LABEL[v] || v },
        { title: 'Origen', dataIndex: 'origenDinero', render: (v: OrigenDineroRecibo) => ORIGEN_DINERO_LABEL[v] || v },
        { title: 'Total', dataIndex: 'totalRecibido', align: 'right' as const, render: (v: number) => <strong>{cop.format(v || 0)}</strong> },
        {
            title: 'Estado', dataIndex: 'estado',
            render: (v: string) => <Tag color={v === 'ANULADO' ? 'red' : v === 'ERROR_CONTABILIZACION' ? 'orange' : 'green'}>{v}</Tag>
        },
        {
            title: '', key: 'acciones', width: 110,
            render: (_: any, r: ReciboCaja) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <Tooltip title="Ver detalle">
                        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetalle(r)} />
                    </Tooltip>
                    {r.estado === 'REGISTRADO' && (
                        <Popconfirm title="¿Anular este recibo?" description="La deuda vuelve a las facturas." onConfirm={() => anular(r.reciboId!)} okText="Sí" cancelText="No">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </div>
            )
        },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <WalletOutlined style={{ marginRight: 8 }} />
                        Recibos de caja
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Abonos de clientes a facturas a crédito, o anticipos sin factura todavía
                    </p>
                </div>
                <Button
                    type="primary" icon={<PlusOutlined />}
                    onClick={() => { limpiar(); setModalNuevo(true) }}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nuevo recibo
                </Button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <DatePicker.RangePicker
                    value={rangoLista}
                    onChange={(v) => v && v[0] && v[1] && setRangoLista([v[0], v[1]])}
                    format="DD/MM/YYYY"
                    allowClear={false}
                />
                <Select
                    showSearch allowClear optionFilterProp="label"
                    placeholder="Todos los clientes"
                    value={clienteFiltroLista} onChange={setClienteFiltroLista}
                    style={{ minWidth: 240 }}
                    options={clientes.map(c => ({
                        value: c.clienteId,
                        label: `${c.nombres || c.razonSocial || ''} ${c.apellidos || ''}`.trim(),
                    }))}
                />
            </div>

            <TablaOrdenable
                dataSource={recibosFiltrados}
                columns={columnas}
                rowKey="reciboId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 900 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Todavía no has registrado recibos de caja" /> }}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Nuevo recibo de caja</span>}
                open={modalNuevo}
                onCancel={() => setModalNuevo(false)}
                onOk={registrar}
                confirmLoading={guardando}
                okText="Registrar recibo"
                cancelText="Cancelar"
                width={720}
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <Radio.Group
                    value={tipoRecibo}
                    onChange={e => { setTipoRecibo(e.target.value); setAplicaciones({}); setTotalAnticipo(0) }}
                    style={{ marginBottom: 14 }}
                >
                    <Radio.Button value="ABONO_CARTERA">Abono a factura(s)</Radio.Button>
                    <Radio.Button value="ANTICIPO">Anticipo sin factura</Radio.Button>
                </Radio.Group>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Cliente</div>
                        <Select
                            showSearch allowClear optionFilterProp="label"
                            placeholder={tipoRecibo === 'ABONO_CARTERA' ? 'Todos los clientes con cartera' : 'Selecciona el cliente'}
                            value={clienteId} onChange={setClienteId}
                            style={{ width: '100%' }}
                            options={clientes.map(c => ({
                                value: c.clienteId,
                                label: `${c.nombres || c.razonSocial || ''} ${c.apellidos || ''} — ${c.numeroDocumento || ''}`.trim(),
                            }))}
                            popupRender={(menu) => (
                                <>
                                    {menu}
                                    <Divider style={{ margin: '6px 0' }} />
                                    <Button type="text" block icon={<PlusOutlined />} onClick={() => setModalCliente(true)} style={{ textAlign: 'left', color: colors.primary }}>
                                        Crear nuevo cliente
                                    </Button>
                                </>
                            )}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fecha</div>
                        <DatePicker value={fechaRecibido} onChange={v => v && setFechaRecibido(v)} format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }} />
                    </div>
                </div>

                {tipoRecibo === 'ABONO_CARTERA' ? (
                    <>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Facturas con saldo pendiente</div>
                        <TablaOrdenable
                            dataSource={cartera}
                            rowKey="ventaId"
                            size="small"
                            loading={cargandoCartera}
                            pagination={false}
                            locale={{ emptyText: <Empty description="Sin facturas pendientes" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                            columns={[
                                {
                                    title: '', width: 32,
                                    render: (_: any, v: Venta) => (
                                        <Checkbox
                                            checked={(aplicaciones[v.ventaId] || 0) > 0}
                                            onChange={e => setAplicaciones(prev => ({
                                                ...prev, [v.ventaId]: e.target.checked ? (v.saldoPendiente || 0) : 0,
                                            }))}
                                        />
                                    )
                                },
                                { title: 'Factura', dataIndex: 'numeroVenta' },
                                { title: 'Cliente', dataIndex: 'clienteNombre' },
                                { title: 'Saldo', dataIndex: 'saldoPendiente', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                                {
                                    title: 'Aplicar', width: 130,
                                    render: (_: any, v: Venta) => (
                                        <InputNumber
                                            size="small" min={0} max={v.saldoPendiente || 0} style={{ width: '100%' }}
                                            value={aplicaciones[v.ventaId] || 0}
                                            disabled={!(aplicaciones[v.ventaId] > 0)}
                                            onChange={val => setAplicaciones(prev => ({ ...prev, [v.ventaId]: Number(val) || 0 }))}
                                        />
                                    )
                                },
                            ]}
                        />
                    </>
                ) : (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Valor del anticipo</div>
                        <InputNumber min={0} style={{ width: '100%' }} value={totalAnticipo} onChange={v => setTotalAnticipo(Number(v) || 0)}
                            formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Origen del dinero</div>
                        <Select
                            value={origenDinero} onChange={setOrigenDinero} style={{ width: '100%' }}
                            options={Object.entries(ORIGEN_DINERO_LABEL).map(([value, label]) => ({ value, label }))}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Referencia (opcional)</div>
                        <Input value={referenciaPago} onChange={e => setReferenciaPago(e.target.value)} placeholder="Número de transacción, cheque..." />
                    </div>
                </div>

                <div style={{ textAlign: 'right', marginTop: 14, fontWeight: 700, fontSize: 16 }}>
                    Total recibido: <span style={{ color: colors.primary }}>{cop.format(totalRecibido)}</span>
                </div>
            </Modal>

            {/* Detalle */}
            <Modal
                title={detalle && <span style={{ color: colors.heading, fontWeight: 700 }}>
                    {detalle.numeroRecibo} · {detalle.clienteNombre || 'Sin cliente'}
                </span>}
                open={!!detalle}
                onCancel={() => setDetalle(null)}
                footer={null}
                width={600}
            >
                {detalle && (
                    <>
                        {detalle.estado === 'ERROR_CONTABILIZACION' && (
                            <Alert type="error" showIcon style={{ marginBottom: 12 }}
                                message="Este recibo no se pudo contabilizar y fue revertido" />
                        )}
                        {detalle.aplicaciones && detalle.aplicaciones.length > 0 && (
                            <TablaOrdenable
                                dataSource={detalle.aplicaciones}
                                rowKey="ventaId"
                                size="small"
                                pagination={false}
                                columns={[
                                    { title: 'Factura', dataIndex: 'numeroVenta' },
                                    { title: 'Saldo antes', dataIndex: 'saldoAnterior', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                                    { title: 'Aplicado', dataIndex: 'valorAplicado', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                                    { title: 'Saldo después', dataIndex: 'saldoNuevo', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                                ]}
                            />
                        )}
                        <div style={{ marginTop: 12, fontSize: 12.5, color: colors.textSecondary }}>
                            <div><strong>Origen:</strong> {ORIGEN_DINERO_LABEL[detalle.origenDinero as OrigenDineroRecibo] || detalle.origenDinero}</div>
                            {detalle.referenciaPago && <div><strong>Referencia:</strong> {detalle.referenciaPago}</div>}
                        </div>
                        <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                            Total: <span style={{ color: colors.primary }}>{cop.format(detalle.totalRecibido || 0)}</span>
                        </div>
                    </>
                )}
            </Modal>
            <CrearClienteModal
                open={modalCliente}
                onClose={() => setModalCliente(false)}
                onCreado={(c: Cliente) => { setClientes(prev => [...prev, c]); setClienteId(c.clienteId) }}
            />
        </div>
    )
}
