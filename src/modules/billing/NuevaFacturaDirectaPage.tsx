import { useState, useEffect } from 'react'
import { Button, Select, InputNumber, Input, message, Empty, Tag, Alert, Divider } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import CrearClienteModal from '../../shared/components/CrearClienteModal'
import { FileAddOutlined, PlusOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { clienteService, type Cliente } from '../../shared/services/clienteService'
import { productoService, PORCENTAJE_IVA, type Producto, type TipoIva } from '../../shared/services/inventarioService'
import { ventaService, type VentaItem, type MetodoPago } from '../../shared/services/ventaService'
import { facturaService } from '../../shared/services/facturacionService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const nombreCliente = (c: Cliente) =>
    c.tipoPersona === 'JURIDICA' ? c.razonSocial : [c.nombres, c.apellidos].filter(Boolean).join(' ')

let itemSeq = 0

// Genera una factura electrónica sin pasar por el carrito/caja del POS — para
// cuando el POS está apagado (ver Configuración) o simplemente no aplica al
// negocio (servicios, facturación por encargo, etc.). Por debajo sigue creando
// una Venta (ahí vive el cálculo de IVA/inventario/contabilidad) e inmediatamente
// intenta generarle la factura DIAN — mismo par de pasos que ya hace
// FacturacionPage con una venta existente, solo que acá la venta se crea en el momento.
export default function NuevaFacturaDirectaPage() {
    const navigate = useNavigate()
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [cargando, setCargando] = useState(true)

    const [clienteId, setClienteId] = useState<number | undefined>()
    const [items, setItems] = useState<(VentaItem & { _key: number })[]>([])
    const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO')
    const [generando, setGenerando] = useState(false)
    const [modalCliente, setModalCliente] = useState(false)

    useEffect(() => {
        Promise.allSettled([clienteService.listar(), productoService.listar()])
            .then(([rc, rp]) => {
                if (rc.status === 'fulfilled') setClientes(rc.value.data)
                if (rp.status === 'fulfilled') setProductos(rp.value.data.filter(p => p.activo))
            })
            .finally(() => setCargando(false))
    }, [])

    const agregarItem = () => setItems(prev => [...prev, {
        _key: ++itemSeq, sku: '', nombreProducto: '', cantidad: 1, precioUnitario: 0, descuento: 0,
    }])

    const actualizarItem = (key: number, cambios: Partial<VentaItem>) =>
        setItems(prev => prev.map(i => i._key === key ? { ...i, ...cambios } : i))

    const quitarItem = (key: number) => setItems(prev => prev.filter(i => i._key !== key))

    const seleccionarProducto = (key: number, sku: string) => {
        const p = productos.find(x => x.sku === sku)
        if (!p) return
        actualizarItem(key, { sku: p.sku, nombreProducto: p.nombre, precioUnitario: p.precioVenta, tipoIva: p.tipoIva })
    }

    // Igual que VentasPage: precioUnitario ya incluye IVA, se desglosa hacia
    // adentro. Solo referencial — el backend recalcula el desglose real al registrar.
    const { subtotal, totalIva } = items.reduce((acc, i) => {
        const valorConIva = i.cantidad * (i.precioUnitario || 0) - (i.descuento || 0)
        const tasa = (PORCENTAJE_IVA[i.tipoIva as TipoIva] ?? 19) / 100
        const base = valorConIva / (1 + tasa)
        acc.subtotal += base
        acc.totalIva += valorConIva - base
        return acc
    }, { subtotal: 0, totalIva: 0 })
    const total = subtotal + totalIva

    const limpiar = () => {
        setClienteId(undefined)
        setItems([])
    }

    const generar = async () => {
        if (!clienteId) { message.warning('Selecciona el cliente'); return }
        if (items.length === 0) { message.warning('Agrega al menos un producto'); return }
        if (items.some(i => !i.sku)) { message.warning('Todos los ítems deben tener producto seleccionado'); return }

        setGenerando(true)
        try {
            const cliente = clientes.find(c => c.clienteId === clienteId)
            const { data: venta } = await ventaService.registrar({
                clienteId,
                clienteNombre: cliente ? nombreCliente(cliente) : undefined,
                items,
                formasPago: [{ metodo: metodoPago, valor: total }],
            })

            try {
                const { data: factura } = await facturaService.generar(venta.ventaId)
                message.success(
                    factura.estado === 'ACEPTADA'
                        ? `Factura ${factura.numeroFactura} aceptada por la DIAN`
                        : `Venta registrada. Factura ${factura.numeroFactura}: ${factura.estado}`
                )
                limpiar()
                navigate('/facturacion')
            } catch (errorFactura: any) {
                // La venta sí quedó — solo falló el paso de facturar (ej. falta
                // configurar la DIAN). No se pierde nada, se puede reintentar
                // desde Facturación con esta misma venta.
                message.warning(
                    `Venta ${venta.numeroVenta} registrada, pero no se pudo generar la factura: ` +
                    (errorFactura.response?.data?.message || 'error desconocido') +
                    '. Puedes reintentarlo desde Facturación.'
                )
                limpiar()
                navigate('/facturacion')
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo registrar la venta')
        } finally {
            setGenerando(false)
        }
    }

    if (cargando) return null

    return (
        <div style={{ maxWidth: 900 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                <FileAddOutlined style={{ marginRight: 8 }} />
                Nueva factura
            </h2>
            <p style={{ color: colors.textSecondary, margin: '4px 0 20px', fontSize: 13 }}>
                Genera una factura electrónica directa, sin pasar por el carrito de venta del POS.
            </p>

            <Select
                showSearch
                allowClear
                placeholder="Cliente"
                value={clienteId}
                onChange={setClienteId}
                style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                options={clientes.map(c => ({ value: c.clienteId, label: `${nombreCliente(c)} — ${c.numeroDocumento}` }))}
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

            <CrearClienteModal
                open={modalCliente}
                onClose={() => setModalCliente(false)}
                onCreado={(c) => { setClientes(prev => [...prev, c]); setClienteId(c.clienteId) }}
            />

            {items.length === 0 ? (
                <Empty description="Agrega productos a la factura" style={{ margin: '30px 0' }} />
            ) : (
                <TablaOrdenable
                    dataSource={items}
                    rowKey="_key"
                    pagination={false}
                    style={{ marginBottom: 12 }}
                    columns={[
                        {
                            title: 'Producto', width: 260,
                            render: (_: any, r: any) => (
                                <Select
                                    showSearch
                                    placeholder="Selecciona un producto"
                                    value={r.sku || undefined}
                                    onChange={(v) => seleccionarProducto(r._key, v)}
                                    style={{ width: '100%' }}
                                    filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                                    options={productos.map(p => ({ value: p.sku, label: `${p.nombre} (${p.sku})` }))}
                                />
                            )
                        },
                        {
                            title: 'IVA', dataIndex: 'tipoIva', width: 90,
                            render: (v: TipoIva) => v ? <Tag>{PORCENTAJE_IVA[v]}%</Tag> : '—'
                        },
                        {
                            title: 'Cant.', dataIndex: 'cantidad', width: 90,
                            render: (v: number, r: any) => (
                                <InputNumber min={1} value={v} onChange={(val) => actualizarItem(r._key, { cantidad: val || 1 })} style={{ width: '100%' }} />
                            )
                        },
                        {
                            title: 'Precio (IVA incl.)', dataIndex: 'precioUnitario', width: 150,
                            render: (v: number, r: any) => (
                                <InputNumber
                                    min={0} value={v}
                                    formatter={(val) => `$ ${val}`}
                                    onChange={(val) => actualizarItem(r._key, { precioUnitario: val || 0 })}
                                    style={{ width: '100%' }}
                                />
                            )
                        },
                        {
                            title: 'Total', dataIndex: 'valorTotal', width: 120, align: 'right' as const,
                            render: (_: any, r: any) => cop.format(r.cantidad * (r.precioUnitario || 0) - (r.descuento || 0))
                        },
                        {
                            title: '', key: 'acciones', width: 50,
                            render: (_: any, r: any) => (
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => quitarItem(r._key)} />
                            )
                        },
                    ]}
                />
            )}

            <Button icon={<PlusOutlined />} onClick={agregarItem} style={{ marginBottom: 24, borderRadius: 14 }}>
                Agregar producto
            </Button>

            {items.length > 0 && (
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', marginBottom: 20,
                }}>
                    <div style={{ width: 280, background: colors.pageBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                            <span style={{ color: colors.textSecondary }}>Subtotal</span>
                            <span>{cop.format(subtotal)}</span>
                        </div>
                        {totalIva > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                <span style={{ color: colors.textSecondary }}>IVA</span>
                                <span>{cop.format(totalIva)}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17, color: colors.heading, marginBottom: 14 }}>
                            <span>Total</span>
                            <span>{cop.format(total)}</span>
                        </div>
                        <Select
                            value={metodoPago}
                            onChange={setMetodoPago}
                            style={{ width: '100%' }}
                            options={[
                                { value: 'EFECTIVO', label: 'Efectivo' },
                                { value: 'TARJETA', label: 'Tarjeta' },
                                { value: 'TRANSFERENCIA', label: 'Transferencia' },
                            ]}
                        />
                    </div>
                </div>
            )}

            <Alert
                type="info" showIcon style={{ marginBottom: 16, fontSize: 12.5, maxWidth: 620 }}
                message="Esto registra la venta y de una vez intenta generar la factura DIAN"
                description="Si Factus no está configurado todavía, la venta igual queda guardada — puedes generar la factura después desde Facturación."
            />

            <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                loading={generando}
                disabled={items.length === 0}
                onClick={generar}
                style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 700 }}
            >
                Generar factura electrónica
            </Button>
        </div>
    )
}
