import { useState, useEffect } from 'react'
import {
    Table, Button, Modal, Select, Input, InputNumber, DatePicker, Tag, Switch,
    message, Popconfirm, Empty, Alert, Tooltip, Divider
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    SyncOutlined, PlusOutlined, DeleteOutlined, ThunderboltOutlined, CalendarOutlined
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
    recurrenteService, PERIODICIDAD_LABEL,
    type FacturaRecurrente, type Periodicidad, type VentaItem
} from '../../shared/services/ventaService'
import { clienteService, type Cliente } from '../../shared/services/clienteService'
import CrearClienteModal from '../../shared/components/CrearClienteModal'
import { productoService, type Producto } from '../../shared/services/inventarioService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
let itemSeq = 0

export default function RecurrentesPage() {
    const [recurrentes, setRecurrentes] = useState<FacturaRecurrente[]>([])
    const [pendientes, setPendientes] = useState<FacturaRecurrente[]>([])
    const [clientes, setClientes] = useState<any[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [loading, setLoading] = useState(true)

    const [modal, setModal] = useState(false)
    const [nombre, setNombre] = useState('')
    const [clienteId, setClienteId] = useState<number | undefined>()
    const [modalCliente, setModalCliente] = useState(false)
    const [periodicidad, setPeriodicidad] = useState<Periodicidad>('MENSUAL')
    const [diaGeneracion, setDiaGeneracion] = useState<number>(1)
    const [fechaInicio, setFechaInicio] = useState<Dayjs>(dayjs())
    const [fechaFin, setFechaFin] = useState<Dayjs | null>(null)
    const [metodoPago, setMetodoPago] = useState('TRANSFERENCIA')
    const [items, setItems] = useState<(VentaItem & { _key: number })[]>([])
    const [guardando, setGuardando] = useState(false)
    const [generando, setGenerando] = useState<number | null>(null)

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([
            recurrenteService.listar(), recurrenteService.pendientes(),
            clienteService.listar(), productoService.listar(),
        ]).then(([rr, rp, rc, rpr]) => {
            if (rr.status === 'fulfilled') setRecurrentes(rr.value.data)
            if (rp.status === 'fulfilled') setPendientes(rp.value.data)
            if (rc.status === 'fulfilled') setClientes(rc.value.data)
            if (rpr.status === 'fulfilled') setProductos(rpr.value.data.filter(p => p.activo))
        }).finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    const agregarItem = () => setItems(prev => [...prev, {
        _key: ++itemSeq, sku: '', nombreProducto: '', cantidad: 1, precioUnitario: 0, descuento: 0,
    }])

    const actualizarItem = (key: number, cambios: Partial<VentaItem>) =>
        setItems(prev => prev.map(i => i._key === key ? { ...i, ...cambios } : i))

    const seleccionarProducto = (key: number, sku: string) => {
        const p = productos.find(x => x.sku === sku)
        if (p) actualizarItem(key, { sku: p.sku, nombreProducto: p.nombre, precioUnitario: p.precioVenta })
    }

    const total = items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0), 0)

    const limpiar = () => {
        setNombre(''); setClienteId(undefined); setItems([])
        setPeriodicidad('MENSUAL'); setDiaGeneracion(1)
        setFechaInicio(dayjs()); setFechaFin(null)
    }

    const crear = async () => {
        if (!nombre.trim()) { message.warning('Ponle un nombre para identificarla'); return }
        if (items.length === 0 || items.some(i => !i.sku)) {
            message.warning('Agrega al menos un producto y selecciónalo'); return
        }
        setGuardando(true)
        try {
            const cliente = clientes.find(c => c.clienteId === clienteId)
            await recurrenteService.crear({
                nombre,
                clienteId,
                clienteNombre: cliente ? (cliente.razonSocial || `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim()) : undefined,
                clienteCorreo: cliente?.correo,
                periodicidad,
                diaGeneracion,
                fechaInicio: fechaInicio.format('YYYY-MM-DD'),
                fechaFin: fechaFin ? fechaFin.format('YYYY-MM-DD') : undefined,
                metodoPagoPredeterminado: metodoPago,
                items: items.map(({ _key, ...resto }) => resto),
            })
            message.success('Recurrencia creada')
            setModal(false)
            limpiar()
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo crear')
        } finally {
            setGuardando(false)
        }
    }

    const generar = async (id: number) => {
        setGenerando(id)
        try {
            const { data } = await recurrenteService.generar(id)
            message.success(`Venta ${data.numeroVenta} generada`)
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo generar la venta')
        } finally {
            setGenerando(null)
        }
    }

    const cambiarEstado = async (id: number, activa: boolean) => {
        try {
            await recurrenteService.cambiarEstado(id, activa)
            message.success(activa ? 'Recurrencia activada' : 'Recurrencia pausada')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo actualizar')
        }
    }

    const eliminar = async (id: number) => {
        try {
            await recurrenteService.eliminar(id)
            message.success('Recurrencia eliminada')
            cargar()
        } catch {
            message.error('No se pudo eliminar')
        }
    }

    const columnas = [
        { title: 'Nombre', dataIndex: 'nombre', render: (v: string) => <strong>{v}</strong> },
        { title: 'Cliente', dataIndex: 'clienteNombre', render: (v: string) => v || 'Sin cliente' },
        {
            title: 'Periodicidad', dataIndex: 'periodicidad',
            render: (v: Periodicidad, r: FacturaRecurrente) => (
                <span>{PERIODICIDAD_LABEL[v]}{r.diaGeneracion ? ` · día ${r.diaGeneracion}` : ''}</span>
            )
        },
        { title: 'Valor', dataIndex: 'total', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
        {
            title: 'Próxima', dataIndex: 'proximaGeneracion',
            render: (v: string, r: FacturaRecurrente) => {
                if (!v) return '—'
                const vencida = dayjs(v).isBefore(dayjs(), 'day')
                return (
                    <span style={{ color: vencida && r.activa ? colors.orange : undefined, fontWeight: vencida && r.activa ? 600 : 400 }}>
                        {dayjs(v).format('DD/MM/YYYY')}
                    </span>
                )
            }
        },
        { title: 'Generadas', dataIndex: 'vecesGeneradas', align: 'right' as const, width: 100 },
        {
            title: 'Estado', dataIndex: 'activa', width: 110,
            render: (v: boolean, r: FacturaRecurrente) => (
                <Switch size="small" checked={v} onChange={c => cambiarEstado(r.recurrenteId!, c)}
                    checkedChildren="Activa" unCheckedChildren="Pausada" />
            )
        },
        {
            title: '', key: 'acciones', width: 130,
            render: (_: any, r: FacturaRecurrente) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <Tooltip title="Generar la venta de este período ahora">
                        <Button
                            size="small" type="primary" icon={<ThunderboltOutlined />}
                            disabled={!r.activa}
                            loading={generando === r.recurrenteId}
                            onClick={() => generar(r.recurrenteId!)}
                            style={{ background: r.activa ? colors.primary : undefined, borderColor: r.activa ? colors.primary : undefined }}
                        >
                            Generar
                        </Button>
                    </Tooltip>
                    <Popconfirm title="¿Eliminar esta recurrencia?" onConfirm={() => eliminar(r.recurrenteId!)} okText="Sí" cancelText="No">
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </div>
            )
        },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <SyncOutlined style={{ marginRight: 8 }} />
                        Facturación recurrente
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Arriendos, suscripciones y cobros que se repiten
                    </p>
                </div>
                <Button
                    type="primary" icon={<PlusOutlined />}
                    onClick={() => { limpiar(); agregarItem(); setModal(true) }}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nueva recurrencia
                </Button>
            </div>

            {pendientes.length > 0 && (
                <Alert
                    type="warning" showIcon icon={<CalendarOutlined />} style={{ marginBottom: 16 }}
                    message={`Tienes ${pendientes.length} ${pendientes.length === 1 ? 'cobro pendiente' : 'cobros pendientes'} por generar`}
                    description={
                        <div style={{ marginTop: 6 }}>
                            {pendientes.map(p => (
                                <div key={p.recurrenteId} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '5px 0', fontSize: 13,
                                }}>
                                    <span>
                                        <strong>{p.nombre}</strong> · {p.clienteNombre || 'Sin cliente'} · {cop.format(p.total || 0)}
                                        <span style={{ color: colors.textMuted, marginLeft: 8 }}>
                                            (venció el {dayjs(p.proximaGeneracion).format('DD/MM/YYYY')})
                                        </span>
                                    </span>
                                    <Button
                                        size="small" type="primary" loading={generando === p.recurrenteId}
                                        onClick={() => generar(p.recurrenteId!)}
                                        style={{ background: colors.primary, borderColor: colors.primary }}
                                    >
                                        Generar venta
                                    </Button>
                                </div>
                            ))}
                        </div>
                    }
                />
            )}

            <Alert
                type="info" showIcon style={{ marginBottom: 16, fontSize: 12.5 }}
                message="Las ventas no se generan solas"
                description="Cuando llega la fecha, el cobro aparece arriba como pendiente y tú lo confirmas. Así ninguna venta descuenta inventario ni contabiliza sin que la revises."
            />

            <TablaOrdenable
                dataSource={recurrentes}
                columns={columnas}
                rowKey="recurrenteId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1000 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Todavía no tienes cobros recurrentes configurados" /> }}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Nueva facturación recurrente</span>}
                open={modal}
                onCancel={() => setModal(false)}
                onOk={crear}
                confirmLoading={guardando}
                okText="Crear recurrencia"
                cancelText="Cancelar"
                width={860}
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Nombre *</div>
                        <Input value={nombre} onChange={e => setNombre(e.target.value)}
                            placeholder="Arriendo local 2 — Cliente X" />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Cliente</div>
                        <Select
                            showSearch allowClear optionFilterProp="label"
                            value={clienteId} onChange={setClienteId} style={{ width: '100%' }}
                            placeholder="Selecciona"
                            options={clientes.map(c => ({
                                value: c.clienteId,
                                label: `${c.razonSocial || c.nombres || ''} ${c.apellidos || ''} — ${c.numeroDocumento || ''}`.trim(),
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
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Periodicidad</div>
                        <Select value={periodicidad} onChange={setPeriodicidad} style={{ width: '100%' }}
                            options={Object.entries(PERIODICIDAD_LABEL).map(([value, label]) => ({ value, label }))} />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Día de cobro</div>
                        <InputNumber min={1} max={28} value={diaGeneracion} style={{ width: '100%' }}
                            onChange={v => setDiaGeneracion(Number(v) || 1)} />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Empieza</div>
                        <DatePicker value={fechaInicio} onChange={v => v && setFechaInicio(v)}
                            format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Termina (opcional)</div>
                        <DatePicker value={fechaFin} onChange={setFechaFin}
                            format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Indefinida" />
                    </div>
                </div>

                <div style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 12, marginTop: -6 }}>
                    El día de cobro va de 1 a 28 para que exista también en febrero.
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Productos o servicios a cobrar</span>
                    <Button size="small" icon={<PlusOutlined />} onClick={agregarItem}>Agregar</Button>
                </div>

                <TablaOrdenable
                    dataSource={items}
                    rowKey="_key"
                    size="small"
                    pagination={false}
                    columns={[
                        {
                            title: 'Producto',
                            render: (_: any, r: any) => (
                                <Select showSearch optionFilterProp="label" size="small" style={{ width: '100%' }}
                                    placeholder="Selecciona" value={r.sku || undefined}
                                    onChange={v => seleccionarProducto(r._key, v)}
                                    options={productos.map(p => ({ value: p.sku, label: `${p.nombre} (${p.sku})` }))} />
                            )
                        },
                        {
                            title: 'Cant.', width: 80,
                            render: (_: any, r: any) => (
                                <InputNumber size="small" min={1} style={{ width: '100%' }} value={r.cantidad}
                                    onChange={v => actualizarItem(r._key, { cantidad: Number(v) || 1 })} />
                            )
                        },
                        {
                            title: 'Precio', width: 120,
                            render: (_: any, r: any) => (
                                <InputNumber size="small" min={0} style={{ width: '100%' }} value={r.precioUnitario}
                                    onChange={v => actualizarItem(r._key, { precioUnitario: Number(v) || 0 })} />
                            )
                        },
                        {
                            title: 'Total', width: 110, align: 'right' as const,
                            render: (_: any, r: any) => cop.format(r.cantidad * (r.precioUnitario || 0))
                        },
                        {
                            title: '', width: 40,
                            render: (_: any, r: any) => (
                                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                                    onClick={() => setItems(prev => prev.filter(i => i._key !== r._key))} />
                            )
                        },
                    ]}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <div style={{ width: 220 }}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Forma de pago habitual</div>
                        <Select value={metodoPago} onChange={setMetodoPago} style={{ width: '100%' }}
                            options={[
                                { value: 'TRANSFERENCIA', label: 'Transferencia' },
                                { value: 'EFECTIVO', label: 'Efectivo' },
                                { value: 'TARJETA', label: 'Tarjeta' },
                            ]} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                        Valor por período: <span style={{ color: colors.primary }}>{cop.format(total)}</span>
                    </div>
                </div>
            </Modal>
            <CrearClienteModal
                open={modalCliente}
                onClose={() => setModalCliente(false)}
                onCreado={(c: Cliente) => { setClientes(prev => [...prev, c]); setClienteId(c.clienteId) }}
            />
        </div>
    )
}
