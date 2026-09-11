import { useState, useEffect } from 'react'
import {
    Table, Button, Modal, Select, Input, InputNumber, DatePicker, Tag,
    message, Popconfirm, Empty, Alert, Tooltip, Collapse, Divider
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    FileTextOutlined, PlusOutlined, DeleteOutlined, ShoppingCartOutlined, EyeOutlined, PrinterOutlined
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
    cotizacionService, COLOR_ESTADO_COTIZACION,
    type Cotizacion, type EstadoCotizacion, type FormaPago, type VentaItem
} from '../../shared/services/ventaService'
import { clienteService, type Cliente } from '../../shared/services/clienteService'
import { productoService, type Producto } from '../../shared/services/inventarioService'
import CotizacionDocumentoView from './CotizacionDocumentoView'
import CrearClienteModal from '../../shared/components/CrearClienteModal'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

let itemSeq = 0

export default function CotizacionesPage() {
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
    const [clientes, setClientes] = useState<any[]>([])
    const [modalCliente, setModalCliente] = useState(false)
    const [productos, setProductos] = useState<Producto[]>([])
    const [loading, setLoading] = useState(true)

    const [modalNueva, setModalNueva] = useState(false)
    const [clienteId, setClienteId] = useState<number | undefined>()
    const [vencimiento, setVencimiento] = useState<Dayjs>(dayjs().add(15, 'day'))
    const [extra, setExtra] = useState<Record<string, string>>({})
    const setE = (k: string, v: string) => setExtra(prev => ({ ...prev, [k]: v }))
    const [items, setItems] = useState<(VentaItem & { _key: number })[]>([])
    const [guardando, setGuardando] = useState(false)

    const [detalle, setDetalle] = useState<Cotizacion | null>(null)
    const [documento, setDocumento] = useState<Cotizacion | null>(null)
    const [modalConvertir, setModalConvertir] = useState<Cotizacion | null>(null)
    const [metodoPago, setMetodoPago] = useState('EFECTIVO')
    const [convirtiendo, setConvirtiendo] = useState(false)

    const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().subtract(90, 'day'), dayjs()])
    const [clienteFiltro, setClienteFiltro] = useState<number | undefined>()

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([
            cotizacionService.filtrar(rango[0].format('YYYY-MM-DD'), rango[1].format('YYYY-MM-DD')),
            clienteService.listar(),
            productoService.listar(),
        ])
            .then(([rc, rcl, rp]) => {
                if (rc.status === 'fulfilled') setCotizaciones(rc.value.data)
                if (rcl.status === 'fulfilled') setClientes(rcl.value.data)
                if (rp.status === 'fulfilled') setProductos(rp.value.data.filter(p => p.activo))
            })
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [rango])

    const cotizacionesFiltradas = clienteFiltro
        ? cotizaciones.filter(c => c.clienteId === clienteFiltro)
        : cotizaciones

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
        setClienteId(undefined); setItems([]); setExtra({})
        setVencimiento(dayjs().add(15, 'day'))
    }

    const crear = async () => {
        if (items.length === 0) { message.warning('Agrega al menos un producto'); return }
        if (items.some(i => !i.sku)) { message.warning('Todos los ítems deben tener producto seleccionado'); return }
        setGuardando(true)
        try {
            const cliente = clientes.find(c => c.clienteId === clienteId)
            const { data } = await cotizacionService.crear({
                clienteId,
                clienteNombre: cliente ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim() || cliente.razonSocial : undefined,
                clienteCorreo: cliente?.correo,
                fechaVencimiento: vencimiento.format('YYYY-MM-DD'),
                ...extra,
                estado: 'BORRADOR',
                items: items.map(({ _key, ...resto }) => resto),
            })
            message.success(`Cotización ${data.numeroCotizacion} creada`)
            setModalNueva(false)
            limpiar()
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo crear la cotización')
        } finally {
            setGuardando(false)
        }
    }

    const cambiarEstado = async (id: number, estado: EstadoCotizacion) => {
        try {
            await cotizacionService.cambiarEstado(id, estado)
            message.success('Estado actualizado')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo cambiar el estado')
        }
    }

    const convertir = async () => {
        if (!modalConvertir?.cotizacionId) return
        setConvirtiendo(true)
        try {
            const formasPago: FormaPago[] = [{ metodo: metodoPago as any, valor: modalConvertir.total || 0 }]
            const { data } = await cotizacionService.convertir(modalConvertir.cotizacionId, formasPago)
            message.success(`Venta ${data.numeroVenta} generada desde la cotización`)
            setModalConvertir(null)
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo convertir en venta')
        } finally {
            setConvirtiendo(false)
        }
    }

    const columnas = [
        { title: 'Número', dataIndex: 'numeroCotizacion', render: (v: string) => <strong style={{ color: colors.primary }}>{v}</strong> },
        { title: 'Cliente', dataIndex: 'clienteNombre', render: (v: string) => v || 'Sin cliente' },
        { title: 'Fecha', dataIndex: 'fecha', render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '' },
        {
            title: 'Vence', dataIndex: 'fechaVencimiento',
            render: (v: string, r: Cotizacion) => {
                if (!v) return ''
                const vencida = dayjs(v).isBefore(dayjs(), 'day') && r.estado !== 'CONVERTIDA'
                return <span style={{ color: vencida ? colors.red : undefined }}>{dayjs(v).format('DD/MM/YYYY')}</span>
            }
        },
        { title: 'Vendedor', dataIndex: 'creadoPor' },
        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v || 0)}</strong> },
        {
            title: 'Estado', dataIndex: 'estado',
            render: (v: EstadoCotizacion) => <Tag color={COLOR_ESTADO_COTIZACION[v]}>{v}</Tag>
        },
        {
            title: '', key: 'acciones', width: 190,
            render: (_: any, r: Cotizacion) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <Tooltip title="Ver detalle rápido">
                        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetalle(r)} />
                    </Tooltip>
                    <Tooltip title="Ver documento para enviar al cliente">
                        <Button type="text" size="small" icon={<PrinterOutlined />} onClick={() => setDocumento(r)} />
                    </Tooltip>
                    {(r.estado === 'BORRADOR' || r.estado === 'VENCIDA') && (
                        <Button size="small" onClick={() => cambiarEstado(r.cotizacionId!, 'ENVIADA')}>Enviar</Button>
                    )}
                    {r.estado === 'ENVIADA' && (
                        <>
                            <Button size="small" onClick={() => cambiarEstado(r.cotizacionId!, 'APROBADA')}>Aprobar</Button>
                            <Popconfirm title="¿Marcar como rechazada?" onConfirm={() => cambiarEstado(r.cotizacionId!, 'RECHAZADA')} okText="Sí" cancelText="No">
                                <Button size="small" danger>Rechazar</Button>
                            </Popconfirm>
                        </>
                    )}
                    {r.estado === 'APROBADA' && (
                        <Button
                            size="small" type="primary" icon={<ShoppingCartOutlined />}
                            onClick={() => { setModalConvertir(r); setMetodoPago('EFECTIVO') }}
                            style={{ background: colors.primary, borderColor: colors.primary }}
                        >
                            Convertir
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
                        <FileTextOutlined style={{ marginRight: 8 }} />
                        Cotizaciones
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Propuestas comerciales — no afectan inventario ni contabilidad hasta convertirse en venta
                    </p>
                </div>
                <Button
                    type="primary" icon={<PlusOutlined />}
                    onClick={() => { limpiar(); agregarItem(); setModalNueva(true) }}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nueva cotización
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
                dataSource={cotizacionesFiltradas}
                columns={columnas}
                rowKey="cotizacionId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1000 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Todavía no has creado cotizaciones" /> }}
            />

            {/* Nueva cotización */}
            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Nueva cotización</span>}
                open={modalNueva}
                onCancel={() => setModalNueva(false)}
                onOk={crear}
                confirmLoading={guardando}
                okText="Crear cotización"
                cancelText="Cancelar"
                width={900}
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
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
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Válida hasta</div>
                        <DatePicker
                            value={vencimiento} onChange={v => v && setVencimiento(v)}
                            format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }}
                        />
                    </div>
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

                <Collapse
                    style={{ marginTop: 14 }}
                    items={[
                        {
                            key: 'condiciones',
                            label: 'Condiciones comerciales (opcional)',
                            children: (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {([
                                        ['formaPago', 'Forma de pago', '50% anticipo, 50% contra entrega'],
                                        ['tiempoEntrega', 'Tiempo de entrega', '5 días hábiles'],
                                        ['lugarEntrega', 'Lugar de entrega', 'Bodega del cliente'],
                                        ['transporte', 'Transporte', 'Incluido dentro de Fusagasugá'],
                                        ['tiempoFabricacion', 'Tiempo de fabricación', 'Solo si aplica'],
                                        ['instalacion', 'Instalación', 'Solo si aplica'],
                                        ['capacitacion', 'Capacitación', 'Solo si aplica'],
                                        ['lugarEmision', 'Lugar de emisión', 'Se usa tu ciudad si lo dejas vacío'],
                                    ] as [string, string, string][]).map(([k, label, ph]) => (
                                        <div key={k}>
                                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{label}</div>
                                            <Input value={extra[k] || ''} onChange={e => setE(k, e.target.value)} placeholder={ph} />
                                        </div>
                                    ))}
                                </div>
                            ),
                        },
                        {
                            key: 'garantia',
                            label: 'Garantía (opcional)',
                            children: (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {([
                                        ['garantiaTiempo', 'Vigencia', '12 meses'],
                                        ['garantiaCubre', 'Qué cubre', 'Defectos de fabricación'],
                                        ['garantiaNoCubre', 'Qué NO cubre', 'Mal uso, daños por transporte del cliente'],
                                        ['garantiaComoHacerEfectiva', 'Cómo hacerla efectiva', 'Presentar la factura en nuestro punto'],
                                    ] as [string, string, string][]).map(([k, label, ph]) => (
                                        <div key={k}>
                                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{label}</div>
                                            <Input value={extra[k] || ''} onChange={e => setE(k, e.target.value)} placeholder={ph} />
                                        </div>
                                    ))}
                                </div>
                            ),
                        },
                        {
                            key: 'contacto',
                            label: 'Contacto y asesor (opcional)',
                            children: (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {([
                                        ['contactoNombre', 'Contacto en el cliente', 'A quién va dirigida'],
                                        ['contactoCargo', 'Cargo del contacto', 'Gerente de compras'],
                                        ['asesorCargo', 'Tu cargo', 'Asesor comercial'],
                                        ['asesorTelefono', 'Tu teléfono', 'Para que te contacten'],
                                        ['asesorCorreo', 'Tu correo', ''],
                                    ] as [string, string, string][]).map(([k, label, ph]) => (
                                        <div key={k}>
                                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{label}</div>
                                            <Input value={extra[k] || ''} onChange={e => setE(k, e.target.value)} placeholder={ph} />
                                        </div>
                                    ))}
                                    <div style={{ gridColumn: '1 / 3' }}>
                                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Observaciones adicionales</div>
                                        <Input.TextArea rows={2} value={extra.observaciones || ''}
                                            onChange={e => setE('observaciones', e.target.value)}
                                            placeholder="Las condiciones estándar (vigencia, precios sujetos a cambio, no es factura) ya se imprimen solas" />
                                    </div>
                                </div>
                            ),
                        },
                    ]}
                />

                <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                    Total: <span style={{ color: colors.primary }}>{cop.format(subtotal)}</span>
                </div>
            </Modal>

            {/* Convertir en venta */}
            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Convertir en venta</span>}
                open={!!modalConvertir}
                onCancel={() => setModalConvertir(null)}
                onOk={convertir}
                confirmLoading={convirtiendo}
                okText="Convertir en venta"
                cancelText="Cancelar"
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <Alert
                    type="warning" showIcon style={{ marginBottom: 14, fontSize: 12.5 }}
                    message="Esta acción sí afecta tu operación"
                    description="Al convertir se descuenta el inventario y se genera el asiento contable. Si algo falla en el camino, la operación se revierte completa y la cotización sigue aprobada."
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
                    {detalle.numeroCotizacion} · {detalle.clienteNombre || 'Sin cliente'}
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
                        {(detalle.formaPago || detalle.tiempoEntrega) && (
                            <div style={{ marginTop: 12, fontSize: 12.5, color: colors.textSecondary }}>
                                {detalle.formaPago && <div><strong>Pago:</strong> {detalle.formaPago}</div>}
                                {detalle.tiempoEntrega && <div><strong>Entrega:</strong> {detalle.tiempoEntrega}</div>}
                            </div>
                        )}
                        <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                            Total: <span style={{ color: colors.primary }}>{cop.format(detalle.total || 0)}</span>
                        </div>
                        {detalle.ventaGeneradaId && (
                            <Alert type="success" showIcon style={{ marginTop: 12 }}
                                message={`Ya convertida en la venta #${detalle.ventaGeneradaId}`} />
                        )}
                    </>
                )}
            </Modal>
            <CotizacionDocumentoView
                cotizacion={documento}
                open={!!documento}
                onClose={() => setDocumento(null)}
            />
            <CrearClienteModal
                open={modalCliente}
                onClose={() => setModalCliente(false)}
                onCreado={(c: Cliente) => { setClientes(prev => [...prev, c]); setClienteId(c.clienteId) }}
            />
        </div>
    )
}
