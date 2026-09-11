import { useState, useEffect, useMemo } from 'react'
import { colors } from '../../shared/theme/colors'
import {
    Input, Empty, Card, Tag, Button, Select, InputNumber, Switch,
    Space, message, Divider, Badge, Tooltip
} from 'antd'
import {
    SearchOutlined, ShoppingCartOutlined, ShoppingOutlined,
    PlusOutlined, MinusOutlined, DeleteOutlined, UserOutlined,
    CheckCircleFilled
} from '@ant-design/icons'
import { productoService, PORCENTAJE_IVA, type Producto, type TipoIva } from '../../shared/services/inventarioService'
import { clienteService, type Cliente } from '../../shared/services/clienteService'
import { ventaService, configuracionReciboService, type VentaItem, type FormaPago, type MetodoPago, type Venta, type ConfiguracionRecibo } from '../../shared/services/ventaService'
import { empresaService, type Empresa } from '../../shared/services/empresaService'
import { centroCostoService, type CentroCosto } from '../../shared/services/contabilidadService'
import CrearClienteModal from '../../shared/components/CrearClienteModal'
import ReciboModal from './ReciboModal'
import CajaWidget from './CajaWidget'

const formatoCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
})

const METODOS: { value: MetodoPago; label: string }[] = [
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'TARJETA', label: 'Tarjeta' },
    { value: 'TRANSFERENCIA', label: 'Transferencia' },
    { value: 'MIXTO', label: 'Mixto' },
]

const nombreCliente = (c: Cliente) =>
    c.tipoPersona === 'JURIDICA' ? c.razonSocial : [c.nombres, c.apellidos].filter(Boolean).join(' ')

export default function VentasPage() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [loadingProductos, setLoadingProductos] = useState(true)

    const [carrito, setCarrito] = useState<VentaItem[]>([])
    const [clienteId, setClienteId] = useState<number | undefined>(undefined)
    const [modalCliente, setModalCliente] = useState(false)
    const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])
    const [centroCostoId, setCentroCostoId] = useState<number | undefined>(undefined)
    const [esObsequio, setEsObsequio] = useState(false)
    const [descuentoTotal, setDescuentoTotal] = useState<number>(0)
    const [formasPago, setFormasPago] = useState<FormaPago[]>([{ metodo: 'EFECTIVO', valor: 0 }])
    const [procesando, setProcesando] = useState(false)

    const [ventaRegistrada, setVentaRegistrada] = useState<Venta | null>(null)
    const [correoCliente, setCorreoCliente] = useState<string | undefined>(undefined)
    const [mostrarRecibo, setMostrarRecibo] = useState(false)
    const [nombreEmpresa, setNombreEmpresa] = useState('')
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    const [configRecibo, setConfigRecibo] = useState<ConfiguracionRecibo | undefined>(undefined)

    useEffect(() => {
        empresaService.obtener()
            .then(({ data }) => {
                setEmpresa(data)
                setNombreEmpresa(data.nombreComercial || data.razonSocial || data.nombres || '')
            })
            .catch(() => setNombreEmpresa(''))
        configuracionReciboService.obtener()
            .then(({ data }) => setConfigRecibo(data))
            .catch(() => { /* el modal usa sus propios valores por defecto si esto falla */ })
    }, [])

    const cargarProductos = () => {
        setLoadingProductos(true)
        productoService.listar()
            .then(({ data }) => setProductos(data.filter(p => p.activo)))
            .catch(() => message.error('Error al cargar productos'))
            .finally(() => setLoadingProductos(false))
    }

    useEffect(() => {
        cargarProductos()
        clienteService.listar().then(({ data }) => setClientes(data)).catch(() => {})
    }, [])

    const productosFiltrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.sku.toLowerCase().includes(busqueda.toLowerCase())
    )

    // ─── Carrito ────────────────────────────────────────────────────
    const stockEnCarrito = (sku: string) => carrito.find(i => i.sku === sku)?.cantidad || 0

    const agregarProducto = (producto: Producto) => {
        const enCarrito = stockEnCarrito(producto.sku)
        if (enCarrito >= producto.stock) {
            message.warning(`Solo hay ${producto.stock} unidades disponibles de ${producto.nombre}`)
            return
        }
        setCarrito(prev => {
            const existe = prev.find(i => i.sku === producto.sku)
            if (existe) {
                return prev.map(i => i.sku === producto.sku ? { ...i, cantidad: i.cantidad + 1 } : i)
            }
            return [...prev, {
                sku: producto.sku,
                nombreProducto: producto.nombre,
                cantidad: 1,
                precioUnitario: producto.precioVenta,
                descuento: 0,
                tipoIva: producto.tipoIva,
            }]
        })
    }

    const cambiarCantidad = (sku: string, delta: number) => {
        const producto = productos.find(p => p.sku === sku)
        setCarrito(prev => prev
            .map(i => {
                if (i.sku !== sku) return i
                const nueva = i.cantidad + delta
                if (producto && nueva > producto.stock) {
                    message.warning(`Solo hay ${producto.stock} unidades disponibles`)
                    return i
                }
                return { ...i, cantidad: nueva }
            })
            .filter(i => i.cantidad > 0)
        )
    }

    const quitarItem = (sku: string) => setCarrito(prev => prev.filter(i => i.sku !== sku))

    const limpiarVenta = () => {
        setCarrito([])
        setClienteId(undefined)
        setDescuentoTotal(0)
        setFormasPago([{ metodo: 'EFECTIVO', valor: 0 }])
    }

    // ─── Totales ────────────────────────────────────────────────────
    // precioUnitario es el precio de venta al público, IVA INCLUIDO (igual que en
    // Producto.precioVenta) — se desglosa hacia adentro, no se suma encima. Solo
    // referencial: el backend siempre recalcula el desglose real al registrar la venta.
    const { subtotal, totalIva } = useMemo(() => {
        let base = 0, iva = 0
        for (const i of carrito) {
            const valorConIva = i.cantidad * i.precioUnitario - (i.descuento || 0)
            const tasa = (PORCENTAJE_IVA[i.tipoIva as TipoIva] ?? 19) / 100
            const valorBase = valorConIva / (1 + tasa)
            base += valorBase
            iva += valorConIva - valorBase
        }
        return { subtotal: base, totalIva: iva }
    }, [carrito])
    const total = Math.max(subtotal + totalIva - descuentoTotal, 0)
    const totalPagado = formasPago.reduce((acc, f) => acc + (f.valor || 0), 0)

    // ─── Formas de pago ─────────────────────────────────────────────
    const actualizarFormaPago = (idx: number, cambios: Partial<FormaPago>) => {
        setFormasPago(prev => prev.map((f, i) => i === idx ? { ...f, ...cambios } : f))
    }
    const agregarFormaPago = () => setFormasPago(prev => [...prev, { metodo: 'EFECTIVO', valor: 0 }])
    const quitarFormaPago = (idx: number) => setFormasPago(prev => prev.filter((_, i) => i !== idx))

    // Mantiene la primera forma de pago sincronizada con el total mientras solo haya una
    useEffect(() => {
        if (formasPago.length === 1) {
            setFormasPago([{ ...formasPago[0], valor: total }])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [total])

    // ─── Cobrar ─────────────────────────────────────────────────────
    useEffect(() => {
        centroCostoService.listar()
            .then(({ data }) => setCentrosCosto(data.filter(cc => cc.activo)))
            .catch(() => { /* sin centros de costo configurados el selector no aparece */ })
    }, [])

    const cobrar = async () => {
        if (carrito.length === 0) {
            message.warning('Agrega al menos un producto al carrito')
            return
        }
        if (totalPagado <= 0) {
            message.warning('Registra al menos una forma de pago')
            return
        }

        setProcesando(true)
        try {
            const cliente = clientes.find(c => c.clienteId === clienteId)
            const { data } = await ventaService.registrar({
                clienteId,
                clienteNombre: cliente ? nombreCliente(cliente) : undefined,
                items: carrito,
                formasPago,
                descuentoTotal,
                centroCostoId,
                centroCostoNombre: centrosCosto.find(cc => cc.centroCostoId === centroCostoId)?.nombre,
                esObsequio,
            })
            message.success(`Venta ${data.numeroVenta} registrada correctamente`)
            setVentaRegistrada(data)
            setCorreoCliente(cliente?.correo)
            setMostrarRecibo(true)
            limpiarVenta()
            setEsObsequio(false)
            cargarProductos() // refleja el nuevo stock descontado
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo registrar la venta')
        } finally {
            setProcesando(false)
        }
    }

    return (
        <>
            <CajaWidget />
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
            {/* ── Catálogo de productos ─────────────────────────────── */}
            <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: '0 0 4px' }}>
                    <ShoppingCartOutlined style={{ marginRight: 8 }} />
                    Punto de venta
                </h2>
                <p style={{ color: colors.textSecondary, margin: '0 0 16px', fontSize: 13 }}>
                    Selecciona productos para agregarlos al carrito
                </p>

                <Input
                    placeholder="Buscar por nombre o SKU..."
                    prefix={<SearchOutlined style={{ color: colors.primary }} />}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={{ marginBottom: 16, borderRadius: 14 }}
                    allowClear
                    size="large"
                />

                {!loadingProductos && productosFiltrados.length === 0 ? (
                    <Empty description="No se encontraron productos" style={{ marginTop: 60 }} />
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: 12,
                    }}>
                        {productosFiltrados.map(p => {
                            const disponible = p.stock - stockEnCarrito(p.sku)
                            const agotado = disponible <= 0
                            return (
                                <Card
                                    key={p.sku}
                                    hoverable={!agotado}
                                    onClick={() => !agotado && agregarProducto(p)}
                                    style={{
                                        borderRadius: 18,
                                        border: '1px solid #ECEFEA',
                                        opacity: agotado ? 0.5 : 1,
                                        cursor: agotado ? 'not-allowed' : 'pointer',
                                    }}
                                    styles={{ body: { padding: 14 } }}
                                >
                                    <div style={{
                                        height: 64, borderRadius: 14, background: colors.primaryLight,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 10,
                                    }}>
                                        <ShoppingOutlined style={{ fontSize: 26, color: colors.primary }} />
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.3, marginBottom: 4 }}>
                                        {p.nombre}
                                    </div>
                                    <div style={{ color: colors.primary, fontWeight: 700, fontSize: 15 }}>
                                        {formatoCOP.format(p.precioVenta)}
                                    </div>
                                    <Tag
                                        color={agotado ? 'default' : disponible <= p.stockMinimo ? 'orange' : 'green'}
                                        style={{ marginTop: 6, borderRadius: 10 }}
                                    >
                                        {agotado ? 'Sin stock' : `${disponible} disp.`}
                                    </Tag>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Carrito / cobro ───────────────────────────────────── */}
            <Card
                style={{ borderRadius: 22, position: 'sticky', top: 16, border: '1px solid #ECEFEA' }}
                styles={{ body: { padding: 18 } }}
            >
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: colors.heading }}>
                        <ShoppingCartOutlined style={{ marginRight: 6 }} />
                        Carrito
                    </span>
                    <Badge count={carrito.length} color="#4E6F3A" />
                </Space>

                <Select
                    showSearch
                    allowClear
                    placeholder="Consumidor final"
                    value={clienteId}
                    onChange={setClienteId}
                    style={{ width: '100%', marginBottom: 14 }}
                    suffixIcon={<UserOutlined style={{ color: colors.primary }} />}
                    filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                    options={clientes.map(c => ({
                        value: c.clienteId,
                        label: `${nombreCliente(c)} — ${c.numeroDocumento}`,
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
                <CrearClienteModal
                    open={modalCliente}
                    onClose={() => setModalCliente(false)}
                    onCreado={(c) => { setClientes(prev => [...prev, c]); setClienteId(c.clienteId) }}
                />

                {centrosCosto.length > 0 && (
                    <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="Centro de costo (opcional)"
                        value={centroCostoId}
                        onChange={setCentroCostoId}
                        style={{ width: '100%', marginBottom: 12 }}
                        options={centrosCosto.map(cc => ({
                            value: cc.centroCostoId,
                            label: `${cc.codigo} · ${cc.nombre}`,
                        }))}
                    />
                )}

                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 14, padding: '6px 10px', borderRadius: 14,
                    background: esObsequio ? '#FFF7E6' : 'transparent',
                    border: esObsequio ? '1px solid #FBC02D' : '1px solid transparent',
                }}>
                    <Tooltip title="Entrega sin cobro (muestra o cortesía). Contablemente es un gasto, no un ingreso — pero el IVA normalmente sí se causa, confírmalo con tu contador.">
                        <span style={{ fontSize: 12.5, color: colors.textSecondary }}>Marcar como obsequio</span>
                    </Tooltip>
                    <Switch size="small" checked={esObsequio} onChange={setEsObsequio} />
                </div>

                {carrito.length === 0 ? (
                    <Empty description="Carrito vacío" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '30px 0' }} />
                ) : (
                    <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
                        {carrito.map(item => (
                            <div key={item.sku} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 0', borderBottom: '1px solid #ffe8e8',
                            }}>
                                <div style={{ flex: 1, marginRight: 8 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.nombreProducto}</div>
                                    <div style={{ color: colors.textSecondary, fontSize: 12 }}>
                                        {formatoCOP.format(item.precioUnitario)} c/u
                                    </div>
                                </div>
                                <Space size={4}>
                                    <Button
                                        size="small" shape="circle" icon={<MinusOutlined />}
                                        onClick={() => cambiarCantidad(item.sku, -1)}
                                    />
                                    <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 600 }}>
                                        {item.cantidad}
                                    </span>
                                    <Button
                                        size="small" shape="circle" icon={<PlusOutlined />}
                                        onClick={() => cambiarCantidad(item.sku, 1)}
                                    />
                                    <Button
                                        size="small" shape="circle" danger icon={<DeleteOutlined />}
                                        onClick={() => quitarItem(item.sku)}
                                        style={{ marginLeft: 4 }}
                                    />
                                </Space>
                            </div>
                        ))}
                    </div>
                )}

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: colors.textSecondary }}>Subtotal</span>
                    <span>{formatoCOP.format(subtotal)}</span>
                </div>
                {totalIva > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                        <span style={{ color: colors.textSecondary }}>IVA</span>
                        <span>{formatoCOP.format(totalIva)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 10 }}>
                    <span style={{ color: colors.textSecondary }}>Descuento</span>
                    <InputNumber
                        min={0}
                        max={subtotal}
                        value={descuentoTotal}
                        onChange={(v) => setDescuentoTotal(v || 0)}
                        formatter={(v) => `$ ${v}`}
                        style={{ width: 130 }}
                        size="small"
                    />
                </div>
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontWeight: 700, fontSize: 18, color: colors.heading, marginBottom: 14,
                }}>
                    <span>Total</span>
                    <span>{formatoCOP.format(total)}</span>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Forma de pago</div>
                {formasPago.map((f, idx) => (
                    <Space key={idx} style={{ width: '100%', marginBottom: 8 }} align="center">
                        <Select
                            value={f.metodo}
                            onChange={(v) => actualizarFormaPago(idx, { metodo: v })}
                            options={METODOS}
                            style={{ width: 130 }}
                        />
                        <InputNumber
                            min={0}
                            value={f.valor}
                            onChange={(v) => actualizarFormaPago(idx, { valor: v || 0 })}
                            formatter={(v) => `$ ${v}`}
                            style={{ width: 140 }}
                        />
                        {formasPago.length > 1 && (
                            <Button
                                size="small" shape="circle" danger icon={<DeleteOutlined />}
                                onClick={() => quitarFormaPago(idx)}
                            />
                        )}
                    </Space>
                ))}
                <Button type="link" size="small" onClick={agregarFormaPago} style={{ padding: 0, marginBottom: 12, color: colors.primary }}>
                    + Agregar otra forma de pago
                </Button>

                {formasPago.length > 1 && (
                    <div style={{
                        fontSize: 12, marginBottom: 12,
                        color: totalPagado === total ? '#27ae60' : '#e67e22',
                    }}>
                        {totalPagado === total
                            ? <><CheckCircleFilled /> Pagos cuadran con el total</>
                            : `Pagado: ${formatoCOP.format(totalPagado)} / Total: ${formatoCOP.format(total)}`}
                    </div>
                )}

                <Tooltip title={carrito.length === 0 ? 'Agrega productos al carrito' : ''}>
                    <Button
                        type="primary"
                        block
                        size="large"
                        loading={procesando}
                        disabled={carrito.length === 0}
                        onClick={cobrar}
                        style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 16, fontWeight: 700 }}
                    >
                        Cobrar {carrito.length > 0 && formatoCOP.format(total)}
                    </Button>
                </Tooltip>
            </Card>
            </div>

            <ReciboModal
                venta={ventaRegistrada}
                empresaNombre={nombreEmpresa || 'Tu empresa'}
                empresaDireccion={empresa?.direccion}
                empresaTelefono={empresa?.telefono}
                empresaLogoUrl={empresa?.logoUrl}
                config={configRecibo}
                clienteCorreo={correoCliente}
                open={mostrarRecibo}
                onClose={() => setMostrarRecibo(false)}
            />
        </>
    )
}
