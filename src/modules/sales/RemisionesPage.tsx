import { useState, useEffect } from 'react'
import {
    Table, Button, Modal, Select, Input, InputNumber, DatePicker, Tag,
    message, Empty, Alert, Tooltip, Divider
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    CarOutlined, PlusOutlined, DeleteOutlined, ShoppingCartOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
    remisionService, COLOR_ESTADO_REMISION,
    type Remision, type EstadoRemision, type FormaPago, type VentaItem
} from '../../shared/services/ventaService'
import { clienteService, type Cliente } from '../../shared/services/clienteService'
import CrearClienteModal from '../../shared/components/CrearClienteModal'
import { productoService, type Producto } from '../../shared/services/inventarioService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

let itemSeq = 0

export default function RemisionesPage() {
    const [remisiones, setRemisiones] = useState<Remision[]>([])
    const [clientes, setClientes] = useState<any[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [loading, setLoading] = useState(true)

    const [modalNueva, setModalNueva] = useState(false)
    const [clienteId, setClienteId] = useState<number | undefined>()
    const [modalCliente, setModalCliente] = useState(false)
    const [lugarEntrega, setLugarEntrega] = useState('')
    const [transportador, setTransportador] = useState('')
    const [observaciones, setObservaciones] = useState('')
    const [items, setItems] = useState<(VentaItem & { _key: number })[]>([])
    const [guardando, setGuardando] = useState(false)

    const [detalle, setDetalle] = useState<Remision | null>(null)
    const [modalConvertir, setModalConvertir] = useState<Remision | null>(null)
    const [metodoPago, setMetodoPago] = useState('EFECTIVO')
    const [convirtiendo, setConvirtiendo] = useState(false)

    const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().subtract(90, 'day'), dayjs()])
    const [clienteFiltro, setClienteFiltro] = useState<number | undefined>()

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([
            remisionService.filtrar(rango[0].format('YYYY-MM-DD'), rango[1].format('YYYY-MM-DD')),
            clienteService.listar(),
            productoService.listar(),
        ])
            .then(([rr, rcl, rp]) => {
                if (rr.status === 'fulfilled') setRemisiones(rr.value.data)
                if (rcl.status === 'fulfilled') setClientes(rcl.value.data)
                if (rp.status === 'fulfilled') setProductos(rp.value.data.filter(p => p.activo))
            })
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [rango])

    const remisionesFiltradas = clienteFiltro
        ? remisiones.filter(r => r.clienteId === clienteFiltro)
        : remisiones

    const agregarItem = () => setItems(prev => [...prev, {
        _key: ++itemSeq, sku: '', nombreProducto: '', cantidad: 1, precioUnitario: 0, descuento: 0,
    }])

    const actualizarItem = (key: number, cambios: Partial<VentaItem>) =>
        setItems(prev => prev.map(i => i._key === key ? { ...i, ...cambios } : i))

    const seleccionarProducto = (key: number, sku: string) => {
        const p = productos.find(x => x.sku === sku)
        if (!p) return
        actualizarItem(key, { sku: p.sku, nombreProducto: p.nombre, precioUnitario: p.precioVenta })
    }

    const subtotal = items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0) - (i.descuento || 0), 0)

    const limpiar = () => {
        setClienteId(undefined); setItems([]); setLugarEntrega(''); setTransportador(''); setObservaciones('')
    }

    const crear = async () => {
        if (items.length === 0) { message.warning('Agrega al menos un producto'); return }
        if (items.some(i => !i.sku)) { message.warning('Todos los ítems deben tener producto seleccionado'); return }
        setGuardando(true)
        try {
            const cliente = clientes.find(c => c.clienteId === clienteId)
            const { data } = await remisionService.crear({
                clienteId,
                clienteNombre: cliente ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim() || cliente.razonSocial : undefined,
                lugarEntrega, transportador, observaciones,
                estado: 'BORRADOR',
                items: items.map(({ _key, ...resto }) => resto),
            })
            message.success(`Remisión ${data.numeroRemision} creada`)
            setModalNueva(false)
            limpiar()
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo crear la remisión')
        } finally {
            setGuardando(false)
        }
    }

    const cambiarEstado = async (id: number, estado: EstadoRemision) => {
        try {
            await remisionService.cambiarEstado(id, estado)
            message.success('Estado actualizado')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo cambiar el estado')
        }
    }

    const convertir = async () => {
        if (!modalConvertir?.remisionId) return
        setConvirtiendo(true)
        try {
            const formasPago: FormaPago[] = [{ metodo: metodoPago as any, valor: modalConvertir.total || 0 }]
            const { data } = await remisionService.convertir(modalConvertir.remisionId, formasPago)
            message.success(`Venta ${data.numeroVenta} generada desde la remisión`)
            setModalConvertir(null)
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo facturar la remisión')
        } finally {
            setConvirtiendo(false)
        }
    }

    const columnas = [
        { title: 'Número', dataIndex: 'numeroRemision', render: (v: string) => <strong style={{ color: colors.primary }}>{v}</strong> },
        { title: 'Cliente', dataIndex: 'clienteNombre', render: (v: string) => v || 'Sin cliente' },
        { title: 'Fecha', dataIndex: 'fecha', render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '' },
        { title: 'Entrega', dataIndex: 'lugarEntrega', render: (v: string) => v || '—' },
        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v || 0)}</strong> },
        {
            title: 'Estado', dataIndex: 'estado',
            render: (v: EstadoRemision) => <Tag color={COLOR_ESTADO_REMISION[v]}>{v}</Tag>
        },
        {
            title: '', key: 'acciones', width: 170,
            render: (_: any, r: Remision) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <Tooltip title="Ver detalle">
                        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetalle(r)} />
                    </Tooltip>
                    {r.estado === 'BORRADOR' && (
                        <Button size="small" onClick={() => cambiarEstado(r.remisionId!, 'ENTREGADA')}>Marcar entregada</Button>
                    )}
                    {r.estado === 'ENTREGADA' && (
                        <Button
                            size="small" type="primary" icon={<ShoppingCartOutlined />}
                            onClick={() => { setModalConvertir(r); setMetodoPago('EFECTIVO') }}
                            style={{ background: colors.primary, borderColor: colors.primary }}
                        >
                            Facturar
                        </Button>
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
                        <CarOutlined style={{ marginRight: 8 }} />
                        Remisiones
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Constancia de mercancía entregada — no afecta inventario ni contabilidad hasta facturarse
                    </p>
                </div>
                <Button
                    type="primary" icon={<PlusOutlined />}
                    onClick={() => { limpiar(); agregarItem(); setModalNueva(true) }}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nueva remisión
                </Button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <DatePicker.RangePicker
                    value={rango}
                    onChange={(v) => v && v[0] && v[1] && setRango([v[0], v[1]])}
                    format="DD/MM/YYYY"
                    allowClear={false}
                />
                <Select
                    showSearch allowClear optionFilterProp="label"
                    placeholder="Todos los clientes"
                    value={clienteFiltro} onChange={setClienteFiltro}
                    style={{ minWidth: 240 }}
                    options={clientes.map(c => ({
                        value: c.clienteId,
                        label: `${c.nombres || c.razonSocial || ''} ${c.apellidos || ''}`.trim(),
                    }))}
                />
            </div>

            <TablaOrdenable
                dataSource={remisionesFiltradas}
                columns={columnas}
                rowKey="remisionId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 900 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Todavía no has creado remisiones" /> }}
            />

            {/* Nueva remisión */}
            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Nueva remisión</span>}
                open={modalNueva}
                onCancel={() => setModalNueva(false)}
                onOk={crear}
                confirmLoading={guardando}
                okText="Crear remisión"
                cancelText="Cancelar"
                width={800}
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Cliente</div>
                    <Select
                        showSearch allowClear optionFilterProp="label"
                        placeholder="Sin cliente asignado"
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Productos</span>
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
                                <Select
                                    showSearch optionFilterProp="label" size="small" style={{ width: '100%' }}
                                    placeholder="Selecciona" value={r.sku || undefined}
                                    onChange={v => seleccionarProducto(r._key, v)}
                                    options={productos.map(p => ({ value: p.sku, label: `${p.nombre} (${p.sku})` }))}
                                />
                            )
                        },
                        {
                            title: 'Cantidad', width: 90,
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Lugar de entrega</div>
                        <Input value={lugarEntrega} onChange={e => setLugarEntrega(e.target.value)} placeholder="Bodega del cliente" />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Transportador</div>
                        <Input value={transportador} onChange={e => setTransportador(e.target.value)} placeholder="Quién lo lleva" />
                    </div>
                    <div style={{ gridColumn: '1 / 3' }}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Observaciones</div>
                        <Input.TextArea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                    </div>
                </div>

                <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                    Total: <span style={{ color: colors.primary }}>{cop.format(subtotal)}</span>
                </div>
            </Modal>

            {/* Facturar (convertir en venta) */}
            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Facturar remisión</span>}
                open={!!modalConvertir}
                onCancel={() => setModalConvertir(null)}
                onOk={convertir}
                confirmLoading={convirtiendo}
                okText="Facturar"
                cancelText="Cancelar"
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <Alert
                    type="warning" showIcon style={{ marginBottom: 14, fontSize: 12.5 }}
                    message="Esta acción sí afecta tu operación"
                    description="Al facturar se descuenta el inventario y se genera el asiento contable. Si algo falla en el camino, la operación se revierte completa y la remisión sigue como entregada."
                />
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Forma de pago</div>
                    <Select
                        value={metodoPago} onChange={setMetodoPago} style={{ width: '100%' }}
                        options={[
                            { value: 'EFECTIVO', label: 'Efectivo' },
                            { value: 'TARJETA', label: 'Tarjeta' },
                            { value: 'TRANSFERENCIA', label: 'Transferencia' },
                        ]}
                    />
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16 }}>
                    Total: <span style={{ color: colors.primary }}>{cop.format(modalConvertir?.total || 0)}</span>
                </div>
            </Modal>

            {/* Detalle */}
            <Modal
                title={detalle && <span style={{ color: colors.heading, fontWeight: 700 }}>
                    {detalle.numeroRemision} · {detalle.clienteNombre || 'Sin cliente'}
                </span>}
                open={!!detalle}
                onCancel={() => setDetalle(null)}
                footer={null}
                width={700}
            >
                {detalle && (
                    <>
                        <TablaOrdenable
                            dataSource={detalle.items}
                            rowKey="sku"
                            size="small"
                            pagination={false}
                            columns={[
                                { title: 'Producto', dataIndex: 'nombreProducto' },
                                { title: 'Cant.', dataIndex: 'cantidad', width: 70 },
                                { title: 'Precio', dataIndex: 'precioUnitario', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'valorTotal', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                            ]}
                        />
                        {(detalle.lugarEntrega || detalle.transportador) && (
                            <div style={{ marginTop: 12, fontSize: 12.5, color: colors.textSecondary }}>
                                {detalle.lugarEntrega && <div><strong>Entrega:</strong> {detalle.lugarEntrega}</div>}
                                {detalle.transportador && <div><strong>Transportador:</strong> {detalle.transportador}</div>}
                            </div>
                        )}
                        <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                            Total: <span style={{ color: colors.primary }}>{cop.format(detalle.total || 0)}</span>
                        </div>
                        {detalle.ventaGeneradaId && (
                            <Alert type="success" showIcon style={{ marginTop: 12 }}
                                message={`Ya facturada como la venta #${detalle.ventaGeneradaId}`} />
                        )}
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
