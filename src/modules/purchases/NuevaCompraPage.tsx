import { useState, useEffect, useMemo } from 'react'
import {
    Card, Select, Input, InputNumber, Button, DatePicker, Space,
    message, Row, Col, Divider, Tag, Modal, Form, Tooltip, Upload, Alert
} from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined, UploadOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { proveedorService } from '../../shared/services/proveedorService'
import type { Proveedor } from '../../shared/services/proveedorService'
import { productoService } from '../../shared/services/inventarioService'
import type { Producto } from '../../shared/services/inventarioService'
import { cuentaContableService, centroCostoService } from '../../shared/services/contabilidadService'
import type { CuentaContable, CentroCosto } from '../../shared/services/contabilidadService'
import {
    compraService, calcularValorTotalItem, TIPO_TRANSACCION_LABEL,
    TIPO_ITEM_LABEL, METODO_PAGO_LABEL, TIPOS_FUENTE, TIPOS_REFERENCIA, TIPO_RECIBO_LABEL,
    type Compra, type CompraItem, type FormaPago, type TipoTransaccion, type TipoItem,
    type MetodoPago, type TipoRecibo, type AplicacionPago, type FacturaImportada
} from '../../shared/services/compraService'
import { colors } from '../../shared/theme/colors'

// ── Paleta de la app — alias históricos (el nombre "ROJO" es de antes del
// rebranding a verde, se quedó así para no tocar cada uso) ──
const ROJO = colors.primary
const ROJO_OSCURO = colors.heading

// ── Opciones de impuestos ──
const IMPUESTOS_CARGO = ['IVA 19%', 'IVA 5%', 'IVA 0%', 'Sin impuesto']
const IMPUESTOS_RETENCION = [
    'Retefuente 3,5% Arrendamientos',
    'Retefuente 2,5% Compras',
    'Retefuente 1% Compras',
    'ReteICA 0,4%',
    'Sin retención',
]

// El XML solo trae el IVA total de la factura (no por línea), así que se le
// asigna a cada ítem la etiqueta de IVA más cercana a ese % efectivo.
function etiquetaIvaMasCercana(subtotal?: number, totalIva?: number): string {
    if (!subtotal || subtotal <= 0 || totalIva == null) return 'Sin impuesto'
    const porcentaje = (totalIva / subtotal) * 100
    let mejor = 'Sin impuesto'
    let menorDiferencia = Infinity
    for (const etiqueta of IMPUESTOS_CARGO) {
        const match = etiqueta.match(/(\d+)\s*%/)
        if (!match) continue
        const diferencia = Math.abs(parseFloat(match[1]) - porcentaje)
        if (diferencia < menorDiferencia) {
            menorDiferencia = diferencia
            mejor = etiqueta
        }
    }
    return mejor
}

// Genera un SKU legible a partir del nombre del producto (ej. "Mesa de madera" -> "MESA-MADERA-4821").
// No consulta el backend, así que no garantiza unicidad al 100% — es prácticamente
// imposible que choque en la práctica, pero si pasa, el usuario puede editarlo a mano.
function generarSkuAutomatico(descripcion: string): string {
    const slug = (descripcion || 'PRODUCTO')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join('-')
    const sufijo = Date.now().toString().slice(-5) + Math.floor(Math.random() * 10)
    return `${slug || 'PROD'}-${sufijo}`
}

let itemSeq = 0
const nuevoItem = (): CompraItem & { _key: number } => ({
    _key: itemSeq++,
    tipo: 'PRODUCTO',
    descripcion: '',
    cantidad: 1,
    valorUnitario: 0,
    descuento: 0,
    valorTotal: 0,
})

let pagoSeq = 0
const nuevaFormaPago = (): FormaPago & { _key: number } => ({
    _key: pagoSeq++,
    metodo: 'EFECTIVO',
    valor: 0,
})

export default function NuevaCompraPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const tipoInicial = (searchParams.get('tipo') as TipoTransaccion) || 'FACTURA_COMPRA'

    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [productosProveedor, setProductosProveedor] = useState<Producto[]>([])
    const [cargandoProductos, setCargandoProductos] = useState(false)
    const [buscandoSku, setBuscandoSku] = useState<Record<number, string>>({})
    const [cuentasContables, setCuentasContables] = useState<CuentaContable[]>([])
    const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])
    const [centroCostoId, setCentroCostoId] = useState<number | undefined>()

    // Crear proveedor rápido desde cualquiera de los dos selectores de proveedor
    const [modalProveedorVisible, setModalProveedorVisible] = useState(false)
    const [formProveedor] = Form.useForm()
    const [creandoProveedor, setCreandoProveedor] = useState(false)
    const [origenCrearProveedor, setOrigenCrearProveedor] = useState<'principal' | 'pago' | null>(null)

    const [tipoTransaccion, setTipoTransaccion] = useState<TipoTransaccion>(tipoInicial)
    const [proveedorId, setProveedorId] = useState<number | undefined>()
    const [facturaProveedorInput, setFacturaProveedorInput] = useState('')
    const [cufeProveedorInput, setCufeProveedorInput] = useState('')
    const [fechaElaboracion, setFechaElaboracion] = useState(dayjs())
    const [sucursal, setSucursal] = useState('')
    const [items, setItems] = useState<(CompraItem & { _key: number })[]>([nuevoItem()])
    const [formasPago, setFormasPago] = useState<(FormaPago & { _key: number })[]>([nuevaFormaPago()])
    const [guardando, setGuardando] = useState(false)

    // ── Importar factura del proveedor (XML o PDF) ──
    const [modalImportar, setModalImportar] = useState(false)
    const [importando, setImportando] = useState(false)
    const [importado, setImportado] = useState<FacturaImportada | null>(null)

    // ── RP1 (recibo de pago): puede pagar varias facturas del mismo proveedor ──
    const esReciboPago = tipoTransaccion === 'RECIBO_PAGO'
    // ── ND1 (nota débito) / Ajuste de cartera: aplican sobre UNA compra ──
    const esNotaOAjuste = tipoTransaccion === 'NOTA_DEBITO' || tipoTransaccion === 'AJUSTE_CARTERA'
    const esTipoReferencia = esReciboPago || esNotaOAjuste

    // Para ND1 / Ajuste
    const [comprasFuente, setComprasFuente] = useState<Compra[]>([])
    const [compraReferenciaId, setCompraReferenciaId] = useState<number | undefined>()
    const [valorReferencia, setValorReferencia] = useState<number>(0)

    // Para RP1
    const [proveedorPagoId, setProveedorPagoId] = useState<number | undefined>()
    const [tipoRecibo, setTipoRecibo] = useState<TipoRecibo>('ABONO_DEUDA')
    const [origenDinero, setOrigenDinero] = useState<string | undefined>()
    const [facturasPendientes, setFacturasPendientes] = useState<Compra[]>([])
    const [aplicaciones, setAplicaciones] = useState<Record<number, number>>({})
    const [valorAnticipo, setValorAnticipo] = useState<number>(0)

    const [observaciones, setObservaciones] = useState('')

    useEffect(() => {
        if (!esNotaOAjuste) return
        compraService.listar()
            .then(({ data }) => setComprasFuente(
                data.filter(c => TIPOS_FUENTE.includes(c.tipoTransaccion) && c.estado === 'REGISTRADA')
            ))
            .catch(() => message.error('Error al cargar las compras disponibles'))
    }, [esNotaOAjuste])

    const compraReferenciaSeleccionada = comprasFuente.find(c => c.compraId === compraReferenciaId)

    useEffect(() => {
        if (!esReciboPago || !proveedorPagoId) {
            setFacturasPendientes([])
            return
        }
        compraService.pendientesPorProveedor(proveedorPagoId)
            .then(({ data }) => { setFacturasPendientes(data); setAplicaciones({}) })
            .catch(() => message.error('Error al cargar las facturas pendientes del proveedor'))
    }, [esReciboPago, proveedorPagoId])

    const totalAplicado = Object.values(aplicaciones).reduce((s, v) => s + (v || 0), 0)

    useEffect(() => {
        proveedorService.listar()
            .then(({ data }) => setProveedores(data))
            .catch(() => message.error('Error al cargar proveedores'))
    }, [])

    // Si llega ?importar=1 (desde el atajo del dashboard), abre el modal de una vez.
    useEffect(() => {
        if (searchParams.get('importar') === '1') {
            setImportado(null)
            setModalImportar(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        centroCostoService.listar()
            .then(({ data }) => setCentrosCosto(data.filter(cc => cc.activo)))
            .catch(() => { /* si no hay centros de costo configurados, el selector queda vacío */ })
    }, [])

    useEffect(() => {
        cuentaContableService.listar()
            .then(({ data }) => setCuentasContables(data.filter(c => c.esTransaccional && c.activa)))
            .catch(() => message.error('Error al cargar el plan de cuentas'))
    }, [])

    const abrirCrearProveedor = (origen: 'principal' | 'pago') => {
        formProveedor.resetFields()
        setOrigenCrearProveedor(origen)
        setModalProveedorVisible(true)
    }

    const crearProveedorRapido = async (values: any) => {
        setCreandoProveedor(true)
        try {
            const { data } = await proveedorService.guardar(values)
            setProveedores(prev => [...prev, data])
            if (origenCrearProveedor === 'principal') {
                setProveedorId(data.proveedorId)
                setItems(prev => prev.map(it => ({ ...it, productoSku: undefined })))
            } else if (origenCrearProveedor === 'pago') {
                setProveedorPagoId(data.proveedorId)
            }
            message.success(`Proveedor "${data.nombre}" creado`)
            setModalProveedorVisible(false)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al crear el proveedor')
        } finally {
            setCreandoProveedor(false)
        }
    }

    // ── Importar factura del proveedor (XML o PDF) ──────────────────────────

    const procesarArchivo = async (file: File) => {
        setImportando(true)
        setImportado(null)
        try {
            const esXml = file.name.toLowerCase().endsWith('.xml')
            const { data } = esXml
                ? await compraService.importarXml(file)
                : await compraService.importarPdf(file)
            setImportado(data)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo leer el archivo')
        } finally {
            setImportando(false)
        }
    }

    const usarDatosImportados = () => {
        if (!importado) return

        // Si el XML/PDF trae NIT, busca el proveedor ya existente por NIT; si no existe, no lo crea
        // solo (evita duplicados por error de tipeo) — se lo dejamos abierto al usuario con el botón de siempre.
        if (importado.nitProveedor) {
            const existente = proveedores.find(p => p.nit.replace(/\D/g, '') === importado.nitProveedor!.replace(/\D/g, ''))
            if (existente) setProveedorId(existente.proveedorId)
            else message.warning(`No encontré un proveedor con NIT ${importado.nitProveedor} — créalo con el botón "Crear nuevo proveedor" del selector.`)
        }

        // Un XML de factura DIAN de un proveedor es, por definición, una factura electrónica recibida.
        if (importado.fuente === 'XML') setTipoTransaccion('FACTURA_COMPRA_ELECTRONICA')

        if (importado.numeroFacturaProveedor) setFacturaProveedorInput(importado.numeroFacturaProveedor)
        if (importado.cufe) setCufeProveedorInput(importado.cufe)
        if (importado.fecha) setFechaElaboracion(dayjs(importado.fecha))

        const etiquetaIva = etiquetaIvaMasCercana(importado.subtotal, importado.totalIva)

        if (importado.items.length > 0) {
            setItems(importado.items.map((it, i) => ({
                _key: Date.now() + i,
                tipo: 'PRODUCTO' as TipoItem,
                productoSku: generarSkuAutomatico(it.descripcion),
                descripcion: it.descripcion,
                cantidad: it.cantidad || 1,
                valorUnitario: it.valorUnitario || 0,
                descuento: 0,
                impuestoCargo: etiquetaIva,
                impuestoRetencion: 'Sin retención',
            })))
        }

        if (importado.totalIva != null && etiquetaIva === 'Sin impuesto' && importado.totalIva > 0) {
            message.warning('No pude calzar el IVA importado con ninguna de tus tarifas configuradas — revisa el Impuesto Cargo de cada ítem a mano.')
        }

        message.success('Datos aplicados al formulario — revísalos antes de guardar')
        setModalImportar(false)
        setImportado(null)
    }


    useEffect(() => {
        if (!proveedorId) {
            setProductosProveedor([])
            return
        }
        setCargandoProductos(true)
        productoService.listarPorProveedor(proveedorId)
            .then(({ data }) => setProductosProveedor(data))
            .catch(() => {
                message.error('No se pudieron cargar los productos del proveedor')
                setProductosProveedor([])
            })
            .finally(() => setCargandoProductos(false))
    }, [proveedorId])

    // ── Ítems ──
    const actualizarItem = (key: number, cambios: Partial<CompraItem>) => {
        setItems(prev => prev.map(it => {
            if (it._key !== key) return it
            const actualizado = { ...it, ...cambios }
            actualizado.valorTotal = calcularValorTotalItem(actualizado)
            return actualizado
        }))
    }

    // Cuando eligen un producto del catálogo del proveedor, autocompleta descripción y precio
    const seleccionarProductoEnItem = (key: number, sku: string) => {
        const producto = productosProveedor.find(p => p.sku === sku)
        if (producto) {
            // Producto existente: autocompleta descripción y costo desde el catálogo.
            actualizarItem(key, {
                productoSku: producto.sku,
                descripcion: producto.nombre,
                valorUnitario: producto.precioCompra,
            })
        } else {
            // SKU nuevo (no existe en el catálogo todavía): se asigna tal cual,
            // se crea solo en inventario al guardar la compra. No se toca
            // descripción/valor porque el usuario ya los puede haber escrito.
            actualizarItem(key, { productoSku: sku })
        }
    }

    const agregarItem = () => setItems(prev => [...prev, nuevoItem()])

    const eliminarItem = (key: number) => {
        if (items.length === 1) {
            message.warning('Debe existir al menos un ítem')
            return
        }
        setItems(prev => prev.filter(it => it._key !== key))
    }

    // ── Formas de pago ──
    const actualizarPago = (key: number, cambios: Partial<FormaPago>) => {
        setFormasPago(prev => prev.map(p => p._key === key ? { ...p, ...cambios } : p))
    }

    const agregarFormaPago = () => setFormasPago(prev => [...prev, nuevaFormaPago()])

    const eliminarFormaPago = (key: number) => {
        if (formasPago.length === 1) {
            message.warning('Debe existir al menos una forma de pago')
            return
        }
        setFormasPago(prev => prev.filter(p => p._key !== key))
    }

    // ── Totales ──
    const totales = useMemo(() => {
        const itemsValidos = items.filter(it => it.descripcion?.trim())
        const totalBruto = itemsValidos.reduce((s, it) => s + calcularValorTotalItem(it), 0)
        const totalDescuentos = itemsValidos.reduce((s, it) => s + (it.descuento || 0), 0)
        const subtotal = totalBruto

        const extraerPorcentaje = (texto?: string) => {
            if (!texto) return 0
            const match = texto.match(/([\d,.]+)\s*%/)
            return match ? parseFloat(match[1].replace(',', '.')) / 100 : 0
        }

        let totalIva = 0
        let totalRetencion = 0
        itemsValidos.forEach(it => {
            const base = calcularValorTotalItem(it)
            totalIva += base * extraerPorcentaje(it.impuestoCargo)
            totalRetencion += base * extraerPorcentaje(it.impuestoRetencion)
        })

        const totalPagar = subtotal + totalIva - totalRetencion
        const totalFormasPago = formasPago.reduce((s, p) => s + (p.valor || 0), 0)

        return { totalBruto, totalDescuentos, subtotal, totalIva, totalRetencion, totalPagar, totalFormasPago }
    }, [items, formasPago])

    const proveedorSeleccionado = proveedores.find(p => p.proveedorId === proveedorId)

    // ── Guardar ──
    const guardar = async () => {
        if (esReciboPago) {
            if (!proveedorPagoId) {
                message.error('Selecciona un proveedor')
                return
            }

            if (tipoRecibo === 'ANTICIPO') {
                if (!valorAnticipo || valorAnticipo <= 0) {
                    message.error('El valor pagado debe ser mayor a 0')
                    return
                }
            } else if (totalAplicado <= 0) {
                message.error('Selecciona al menos una factura y su valor a pagar')
                return
            }

            const proveedorPago = proveedores.find(p => p.proveedorId === proveedorPagoId)
            const aplicacionesPayload: AplicacionPago[] = Object.entries(aplicaciones)
                .filter(([, valor]) => valor > 0)
                .map(([compraReferenciaId, valorAplicado]) => ({ compraReferenciaId: Number(compraReferenciaId), valorAplicado }))

            const compra: Compra = {
                tipoTransaccion: 'RECIBO_PAGO',
                proveedorId: proveedorPagoId,
                proveedorNombre: proveedorPago?.nombre,
                tipoRecibo,
                origenDinero,
                totalPagar: tipoRecibo === 'ANTICIPO' ? valorAnticipo : totalAplicado,
                aplicaciones: tipoRecibo === 'ANTICIPO' ? [] : aplicacionesPayload,
                fechaElaboracion: fechaElaboracion.format('YYYY-MM-DD'),
                observaciones: observaciones || undefined,
                items: [],
                formasPago: [],
            }

            setGuardando(true)
            try {
                await compraService.registrar(compra)
                message.success('Recibo de pago registrado correctamente')
                navigate('/compras')
            } catch (error: any) {
                message.error(error.response?.data?.message || 'Error al registrar el recibo')
            } finally {
                setGuardando(false)
            }
            return
        }

        if (esNotaOAjuste) {
            if (!compraReferenciaId) {
                message.error('Selecciona la compra sobre la que aplica este documento')
                return
            }
            if (!valorReferencia || valorReferencia <= 0) {
                message.error('El valor debe ser mayor a 0')
                return
            }

            const compra: Compra = {
                tipoTransaccion,
                proveedorId: compraReferenciaSeleccionada?.proveedorId || 0,
                compraReferenciaId,
                totalPagar: valorReferencia,
                fechaElaboracion: fechaElaboracion.format('YYYY-MM-DD'),
                observaciones: observaciones || undefined,
                items: [],
                formasPago: [],
            }

            setGuardando(true)
            try {
                await compraService.registrar(compra)
                message.success(`${TIPO_TRANSACCION_LABEL[tipoTransaccion]} registrado correctamente`)
                navigate('/compras')
            } catch (error: any) {
                message.error(error.response?.data?.message || 'Error al registrar')
            } finally {
                setGuardando(false)
            }
            return
        }

        if (!proveedorId) {
            message.error('Selecciona un proveedor')
            return
        }
        const itemsValidos = items.filter(it => it.descripcion?.trim() && it.valorUnitario)
        if (itemsValidos.length === 0) {
            message.error('Agrega al menos un ítem válido')
            return
        }

        const credito = formasPago.find(p => p.metodo === 'CREDITO_PROVEEDOR')
        if (credito && !credito.fechaVencimiento) {
            message.error('Indica la fecha de vencimiento del crédito a proveedores')
            return
        }

        const compra: Compra = {
            tipoTransaccion,
            proveedorId,
            proveedorNombre: proveedorSeleccionado?.nombre,
            facturaProveedor: facturaProveedorInput || undefined,
            cufeProveedor: cufeProveedorInput || undefined,
            fechaElaboracion: fechaElaboracion.format('YYYY-MM-DD'),
            sucursal: sucursal || undefined,
            centroCostoId,
            centroCostoNombre: centrosCosto.find(cc => cc.centroCostoId === centroCostoId)?.nombre,
            totalDescuentos: totales.totalDescuentos,
            totalIva: totales.totalIva,
            totalRetencion: totales.totalRetencion,
            items: itemsValidos.map(({ _key, ...resto }) => resto),
            formasPago: formasPago.map(({ _key, ...resto }) => resto),
        }

        setGuardando(true)
        try {
            await compraService.registrar(compra)
            message.success('Compra registrada correctamente')
            navigate('/compras')
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al registrar la compra')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: ROJO_OSCURO, margin: 0 }}>
                    Nueva {TIPO_TRANSACCION_LABEL[tipoTransaccion]}
                </h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    {TIPOS_FUENTE.includes(tipoTransaccion) && (
                        <Button
                            icon={<UploadOutlined />}
                            onClick={() => { setImportado(null); setModalImportar(true) }}
                        >
                            Importar factura (XML/PDF)
                        </Button>
                    )}
                    <Select
                        value={tipoTransaccion}
                        onChange={(v) => {
                            setTipoTransaccion(v)
                            setCompraReferenciaId(undefined)
                            setValorReferencia(0)
                        }}
                        style={{ width: 280 }}
                        options={Object.entries(TIPO_TRANSACCION_LABEL).map(([value, label]) => ({ value, label }))}
                    />
                </div>
            </div>

            {esReciboPago ? (
                /* ── RP1: recibo de pago — puede pagar varias facturas del proveedor a la vez ── */
                <Card size="small" style={{ borderRadius: 16, marginBottom: 16, borderColor: colors.border }}>
                    <Row gutter={[16, 12]}>
                        <Col xs={24} md={8}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Proveedores/otros *</div>
                            <Select
                                placeholder="Buscar proveedor"
                                showSearch
                                optionFilterProp="label"
                                value={proveedorPagoId}
                                onChange={setProveedorPagoId}
                                style={{ width: '100%' }}
                                suffixIcon={<SearchOutlined />}
                                options={proveedores.map(p => ({ value: p.proveedorId, label: `${p.nombre} · ${p.nit}` }))}
                                popupRender={(menu) => (
                                    <>
                                        {menu}
                                        <Divider style={{ margin: '6px 0' }} />
                                        <Button
                                            type="text" block icon={<PlusOutlined />}
                                            onClick={() => abrirCrearProveedor('pago')}
                                            style={{ textAlign: 'left', color: ROJO }}
                                        >
                                            Crear nuevo proveedor
                                        </Button>
                                    </>
                                )}
                            />
                        </Col>
                        <Col xs={24} md={6}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Realizar un *</div>
                            <Select
                                value={tipoRecibo}
                                onChange={setTipoRecibo}
                                style={{ width: '100%' }}
                                options={Object.entries(TIPO_RECIBO_LABEL).map(([value, label]) => ({ value, label }))}
                            />
                        </Col>
                        <Col xs={24} md={6}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>De donde sale el dinero</div>
                            <Select
                                placeholder="Efectivo, banco, etc."
                                allowClear
                                value={origenDinero}
                                onChange={setOrigenDinero}
                                style={{ width: '100%' }}
                                options={['Efectivo', 'Consignación bancaria', 'Transferencia', 'Otro'].map(v => ({ value: v, label: v }))}
                            />
                        </Col>
                        <Col xs={24} md={4}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fecha de elaboración *</div>
                            <DatePicker
                                value={fechaElaboracion}
                                onChange={(v) => v && setFechaElaboracion(v)}
                                format="DD/MM/YYYY"
                                style={{ width: '100%' }}
                            />
                        </Col>
                    </Row>

                    {tipoRecibo === 'ANTICIPO' ? (
                        <div style={{ marginTop: 16, maxWidth: 260 }}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Valor pagado *</div>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                value={valorAnticipo}
                                onChange={(v) => setValorAnticipo(Number(v) || 0)}
                            />
                            <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 6 }}>
                                El anticipo queda como saldo a favor con el proveedor; aún no se aplica a ninguna factura.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginTop: 20, marginBottom: 8, fontWeight: 600, color: ROJO_OSCURO, fontSize: 13 }}>
                                Facturas pendientes de este proveedor
                            </div>
                            {!proveedorPagoId ? (
                                <div style={{ color: colors.textMuted, fontSize: 12.5 }}>Selecciona un proveedor para ver sus facturas pendientes.</div>
                            ) : facturasPendientes.length === 0 ? (
                                <div style={{ color: colors.textMuted, fontSize: 12.5 }}>Este proveedor no tiene facturas con saldo pendiente.</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                    <thead>
                                        <tr style={{ background: colors.primaryLight, textAlign: 'left', color: colors.heading }}>
                                            <th style={{ padding: 8, width: 30 }}></th>
                                            <th style={{ padding: 8 }}>Comprobante</th>
                                            <th style={{ padding: 8 }}>Vencimiento</th>
                                            <th style={{ padding: 8, textAlign: 'right' }}>Saldo</th>
                                            <th style={{ padding: 8, textAlign: 'right', width: 160 }}>Valor a aplicar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {facturasPendientes.map(f => {
                                            const seleccionada = (aplicaciones[f.compraId!] || 0) > 0
                                            return (
                                                <tr key={f.compraId} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                                    <td style={{ padding: 8 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={seleccionada}
                                                            onChange={(e) => setAplicaciones(prev => ({
                                                                ...prev,
                                                                [f.compraId!]: e.target.checked ? (f.saldoPendiente || 0) : 0
                                                            }))}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8, fontWeight: 600, color: '#4E6F3A' }}>{f.numeroComprobante}</td>
                                                    <td style={{ padding: 8 }}>
                                                        {f.fechaVencimientoCredito ? dayjs(f.fechaVencimientoCredito).format('DD/MM/YYYY') : '—'}
                                                    </td>
                                                    <td style={{ padding: 8, textAlign: 'right' }}>
                                                        ${(f.saldoPendiente || 0).toLocaleString('es-CO')}
                                                    </td>
                                                    <td style={{ padding: 8 }}>
                                                        <InputNumber
                                                            min={0}
                                                            max={f.saldoPendiente || 0}
                                                            size="small"
                                                            style={{ width: '100%' }}
                                                            value={aplicaciones[f.compraId!] || 0}
                                                            onChange={(v) => setAplicaciones(prev => ({ ...prev, [f.compraId!]: Number(v) || 0 }))}
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                            <div style={{ textAlign: 'right', marginTop: 10, fontWeight: 700, color: ROJO_OSCURO }}>
                                Valor pagado: ${totalAplicado.toLocaleString('es-CO')}
                            </div>
                        </>
                    )}

                    <div style={{ fontSize: 12, color: colors.textSecondary, margin: '16px 0 4px' }}>Observaciones</div>
                    <Input.TextArea
                        rows={3}
                        value={observaciones}
                        onChange={e => setObservaciones(e.target.value)}
                        placeholder="Opcional"
                    />

                    <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                        <Button onClick={() => navigate('/compras')}>Cancelar</Button>
                        <Button
                            type="primary"
                            loading={guardando}
                            onClick={guardar}
                            style={{ background: ROJO, borderColor: ROJO, fontWeight: 600 }}
                        >
                            Guardar
                        </Button>
                    </div>
                </Card>
            ) : esNotaOAjuste ? (
                /* ── ND1 / Ajuste de cartera: aplican sobre una compra ya existente ── */
                <Card size="small" style={{ borderRadius: 16, marginBottom: 16, borderColor: colors.border }}>
                    <Row gutter={[16, 12]}>
                        <Col xs={24} md={12}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                                Compra / documento sobre el que aplica *
                            </div>
                            <Select
                                placeholder="Buscar factura de compra, documento soporte o electrónica"
                                showSearch
                                optionFilterProp="label"
                                value={compraReferenciaId}
                                onChange={setCompraReferenciaId}
                                style={{ width: '100%' }}
                                options={comprasFuente.map(c => ({
                                    value: c.compraId,
                                    label: `${c.numeroComprobante} · ${c.proveedorNombre} · Saldo: $${(c.saldoPendiente ?? 0).toLocaleString('es-CO')}`
                                }))}
                            />
                        </Col>
                        <Col xs={24} md={6}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fecha *</div>
                            <DatePicker
                                value={fechaElaboracion}
                                onChange={(v) => v && setFechaElaboracion(v)}
                                format="DD/MM/YYYY"
                                style={{ width: '100%' }}
                            />
                        </Col>
                        <Col xs={24} md={6}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                                {tipoTransaccion === 'RECIBO_PAGO' ? 'Valor pagado *' : 'Valor *'}
                            </div>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                value={valorReferencia}
                                onChange={(v) => setValorReferencia(Number(v) || 0)}
                            />
                        </Col>
                    </Row>

                    {compraReferenciaSeleccionada && (
                        <Tag color="blue" style={{ marginTop: 10 }}>
                            Saldo pendiente actual: ${(compraReferenciaSeleccionada.saldoPendiente ?? 0).toLocaleString('es-CO')}
                        </Tag>
                    )}

                    <div style={{ fontSize: 12, color: colors.textSecondary, margin: '14px 0 4px' }}>Observaciones</div>
                    <Input.TextArea
                        rows={3}
                        value={observaciones}
                        onChange={e => setObservaciones(e.target.value)}
                        placeholder="Opcional"
                    />

                    <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                        <Button onClick={() => navigate('/compras')}>Cancelar</Button>
                        <Button
                            type="primary"
                            loading={guardando}
                            onClick={guardar}
                            style={{ background: ROJO, borderColor: ROJO, fontWeight: 600 }}
                        >
                            Guardar
                        </Button>
                    </div>
                </Card>
            ) : (
            <>

            {/* Datos generales */}
            <Card size="small" style={{ borderRadius: 16, marginBottom: 16, borderColor: colors.border }}>
                <Row gutter={[16, 12]}>
                    <Col xs={24} md={8}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Proveedor *</div>
                        <Select
                            placeholder="Buscar proveedor"
                            showSearch
                            allowClear
                            optionFilterProp="label"
                            value={proveedorId}
                            onChange={(v) => {
                                setProveedorId(v)
                                // limpiar productos de los ítems ya cargados, porque cambió el catálogo disponible
                                setItems(prev => prev.map(it => ({ ...it, productoSku: undefined })))
                            }}
                            style={{ width: '100%' }}
                            suffixIcon={<SearchOutlined />}
                            options={proveedores.map(p => ({
                                value: p.proveedorId,
                                label: `${p.nombre} · ${p.nit}`
                            }))}
                            popupRender={(menu) => (
                                <>
                                    {menu}
                                    <Divider style={{ margin: '6px 0' }} />
                                    <Button
                                        type="text" block icon={<PlusOutlined />}
                                        onClick={() => abrirCrearProveedor('principal')}
                                        style={{ textAlign: 'left', color: ROJO }}
                                    >
                                        Crear nuevo proveedor
                                    </Button>
                                </>
                            )}
                        />
                    </Col>
                    <Col xs={24} md={8}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fecha elaboración *</div>
                        <DatePicker
                            value={fechaElaboracion}
                            onChange={(v) => v && setFechaElaboracion(v)}
                            format="DD/MM/YYYY"
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={24} md={4}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Sucursal</div>
                        <Input
                            placeholder="Opcional"
                            value={sucursal}
                            onChange={e => setSucursal(e.target.value)}
                        />
                    </Col>
                    <Col xs={24} md={4}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Centro de costo</div>
                        <Select
                            placeholder={centrosCosto.length ? 'Opcional' : 'Sin configurar'}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            value={centroCostoId}
                            onChange={setCentroCostoId}
                            style={{ width: '100%' }}
                            notFoundContent="Créalos en Contabilidad → Centros de costo"
                            options={centrosCosto.map(cc => ({
                                value: cc.centroCostoId,
                                label: `${cc.codigo} · ${cc.nombre}`
                            }))}
                        />
                    </Col>
                </Row>
                <Row gutter={[16, 12]} style={{ marginTop: 12 }}>
                    <Col xs={24} md={8}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Número de factura del proveedor</div>
                        <Input
                            placeholder="Ej: FE-12345 (el número que ellos le pusieron, no el nuestro)"
                            value={facturaProveedorInput}
                            onChange={e => setFacturaProveedorInput(e.target.value)}
                        />
                    </Col>
                    <Col xs={24} md={16}>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                            CUFE de la factura electrónica del proveedor (opcional)
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Input
                                placeholder="Cadena de 96 caracteres — se llena sola si importas el XML"
                                value={cufeProveedorInput}
                                onChange={e => setCufeProveedorInput(e.target.value)}
                                style={{ fontFamily: cufeProveedorInput ? 'monospace' : undefined, fontSize: 12.5 }}
                            />
                            {cufeProveedorInput && (
                                <Tooltip title="Abre el portal oficial de la DIAN para verificar este CUFE (tendrás que resolver el captcha tú mismo, la DIAN no permite consultarlo automáticamente)">
                                    <Button
                                        icon={<LinkOutlined />}
                                        onClick={() => window.open('https://catalogo-vpfe.dian.gov.co/User/SearchDocument', '_blank')}
                                    >
                                        Verificar en la DIAN
                                    </Button>
                                </Tooltip>
                            )}
                        </div>
                    </Col>
                </Row>
                {!proveedorId && (
                    <div style={{ marginTop: 10, fontSize: 12, color: ROJO }}>
                        Selecciona un proveedor para poder elegir productos de su catálogo en los ítems.
                    </div>
                )}
            </Card>

            {/* Tabla de ítems */}
            <Card size="small" style={{ borderRadius: 16, marginBottom: 16, borderColor: colors.border }} bodyStyle={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                        <thead>
                            <tr style={{ background: colors.primaryLight, textAlign: 'left' }}>
                                {['#', 'Tipo', 'Producto / Cuenta', 'Descripción', 'Cant', 'Valor Unitario', 'Descuento', 'Impuesto Cargo', 'Impuesto Retención', 'Valor Total', ''].map(h => (
                                    <th key={h} style={{ padding: '10px 8px', fontSize: 12, color: colors.textSecondary, fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={item._key} style={{ borderBottom: '1px solid #fbeaea' }}>
                                    <td style={{ padding: '8px', fontSize: 13, color: colors.textSecondary }}>{idx + 1}</td>
                                    <td style={{ padding: '8px', minWidth: 140 }}>
                                        <Select
                                            value={item.tipo}
                                            onChange={(v: TipoItem) => actualizarItem(item._key, { tipo: v })}
                                            style={{ width: '100%' }}
                                            size="small"
                                            options={Object.entries(TIPO_ITEM_LABEL).map(([value, label]) => ({ value, label }))}
                                        />
                                    </td>
                                    <td style={{ padding: '8px', minWidth: 180 }}>
                                        {item.tipo === 'GASTO_CUENTA' ? (
                                            <Select
                                                placeholder="Buscar cuenta contable"
                                                showSearch
                                                allowClear
                                                optionFilterProp="label"
                                                size="small"
                                                style={{ width: '100%' }}
                                                value={item.cuentaContableCodigo}
                                                onChange={(v) => actualizarItem(item._key, { cuentaContableCodigo: v })}
                                                notFoundContent="No hay cuentas transaccionales cargadas"
                                                options={cuentasContables.map(c => ({
                                                    value: c.codigo,
                                                    label: `${c.codigo} · ${c.nombre}`
                                                }))}
                                            />
                                        ) : item.tipo === 'ACTIVO_FIJO' ? (
                                            <Tooltip title='Se clasifica solo según la descripción: si menciona "computador", "portátil" o "laptop" va a Equipo de cómputo; si no, a Muebles y enseres.'>
                                                <span style={{ fontSize: 11.5, color: colors.textMuted }}>Se clasifica por la descripción →</span>
                                            </Tooltip>
                                        ) : (
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <Select
                                                    placeholder={proveedorId ? 'Producto existente o escribe un SKU nuevo' : 'Escribe un SKU para crear el producto'}
                                                    loading={cargandoProductos}
                                                    showSearch
                                                    allowClear
                                                    filterOption={false}
                                                    size="small"
                                                    style={{ width: '100%' }}
                                                    value={item.productoSku}
                                                    searchValue={buscandoSku[item._key] ?? ''}
                                                    onSearch={(texto) => setBuscandoSku(prev => ({ ...prev, [item._key]: texto }))}
                                                    onChange={(v) => {
                                                        if (v) seleccionarProductoEnItem(item._key, v)
                                                        else actualizarItem(item._key, { productoSku: undefined })
                                                        setBuscandoSku(prev => ({ ...prev, [item._key]: '' }))
                                                    }}
                                                    notFoundContent={null}
                                                    options={(() => {
                                                        const texto = (buscandoSku[item._key] || '').trim()
                                                        const existentes = productosProveedor
                                                            .filter(p => !texto ||
                                                                p.nombre.toLowerCase().includes(texto.toLowerCase()) ||
                                                                p.sku.toLowerCase().includes(texto.toLowerCase()))
                                                            .map(p => ({ value: p.sku, label: `${p.nombre} (${p.sku})` }))
                                                        const coincideExacto = productosProveedor.some(p => p.sku.toLowerCase() === texto.toLowerCase())
                                                        const opcionNuevo = texto && !coincideExacto
                                                            ? [{ value: texto, label: `+ Usar "${texto}" como SKU nuevo (se crea al guardar)` }]
                                                            : []
                                                        return [...opcionNuevo, ...existentes]
                                                    })()}
                                                />
                                                {!item.productoSku && (
                                                    <Tooltip title="Generar un código automático a partir de la descripción">
                                                        <Button
                                                            size="small"
                                                            onClick={() => actualizarItem(item._key, { productoSku: generarSkuAutomatico(item.descripcion) })}
                                                        >
                                                            Generar
                                                        </Button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px', minWidth: 180 }}>
                                        <Input
                                            placeholder="Descripción"
                                            size="small"
                                            value={item.descripcion}
                                            onChange={e => actualizarItem(item._key, { descripcion: e.target.value })}
                                        />
                                    </td>
                                    <td style={{ padding: '8px', width: 80 }}>
                                        <InputNumber
                                            min={0} size="small" style={{ width: '100%' }}
                                            value={item.cantidad}
                                            onChange={(v) => actualizarItem(item._key, { cantidad: Number(v) || 0 })}
                                        />
                                    </td>
                                    <td style={{ padding: '8px', minWidth: 110 }}>
                                        <InputNumber
                                            min={0} size="small" style={{ width: '100%' }}
                                            value={item.valorUnitario}
                                            onChange={(v) => actualizarItem(item._key, { valorUnitario: Number(v) || 0 })}
                                        />
                                    </td>
                                    <td style={{ padding: '8px', minWidth: 100 }}>
                                        <InputNumber
                                            min={0} size="small" style={{ width: '100%' }}
                                            value={item.descuento}
                                            onChange={(v) => actualizarItem(item._key, { descuento: Number(v) || 0 })}
                                        />
                                    </td>
                                    <td style={{ padding: '8px', minWidth: 140 }}>
                                        <Select
                                            placeholder="—"
                                            allowClear
                                            size="small"
                                            style={{ width: '100%' }}
                                            value={item.impuestoCargo}
                                            onChange={(v) => actualizarItem(item._key, { impuestoCargo: v })}
                                            options={IMPUESTOS_CARGO.map(v => ({ value: v, label: v }))}
                                        />
                                    </td>
                                    <td style={{ padding: '8px', minWidth: 160 }}>
                                        <Select
                                            placeholder="—"
                                            allowClear
                                            size="small"
                                            style={{ width: '100%' }}
                                            value={item.impuestoRetencion}
                                            onChange={(v) => actualizarItem(item._key, { impuestoRetencion: v })}
                                            options={IMPUESTOS_RETENCION.map(v => ({ value: v, label: v }))}
                                        />
                                    </td>
                                    <td style={{ padding: '8px', fontWeight: 700, whiteSpace: 'nowrap', color: ROJO_OSCURO }}>
                                        {(item.valorTotal || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <Button
                                            type="text" danger size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={() => eliminarItem(item._key)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: 12 }}>
                    <Button
                        type="dashed" icon={<PlusOutlined />} onClick={agregarItem} block
                        style={{ borderColor: ROJO, color: ROJO }}
                    >
                        Agregar ítem
                    </Button>
                </div>
            </Card>

            <Row gutter={16}>
                {/* Formas de pago */}
                <Col xs={24} md={14}>
                    <Card
                        size="small"
                        title={<span style={{ color: ROJO_OSCURO, fontWeight: 700 }}>Formas de pago</span>}
                        style={{ borderRadius: 16, borderColor: colors.border }}
                    >
                        <Space direction="vertical" style={{ width: '100%' }} size={10}>
                            {formasPago.map(pago => (
                                <div key={pago._key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <Select
                                        value={pago.metodo}
                                        onChange={(v: MetodoPago) => actualizarPago(pago._key, { metodo: v })}
                                        style={{ width: 180 }}
                                        options={Object.entries(METODO_PAGO_LABEL).map(([value, label]) => ({ value, label }))}
                                    />
                                    <InputNumber
                                        min={0}
                                        style={{ flex: 1 }}
                                        value={pago.valor}
                                        onChange={(v) => actualizarPago(pago._key, { valor: Number(v) || 0 })}
                                    />
                                    {pago.metodo === 'CREDITO_PROVEEDOR' && (
                                        <DatePicker
                                            placeholder="Vence"
                                            value={pago.fechaVencimiento ? dayjs(pago.fechaVencimiento) : undefined}
                                            onChange={(v) => actualizarPago(pago._key, { fechaVencimiento: v ? v.format('YYYY-MM-DD') : undefined })}
                                            format="DD/MM/YYYY"
                                            style={{ width: 140 }}
                                        />
                                    )}
                                    <Button
                                        type="text" danger icon={<DeleteOutlined />}
                                        onClick={() => eliminarFormaPago(pago._key)}
                                    />
                                </div>
                            ))}
                            <Button
                                type="link" icon={<PlusOutlined />} onClick={agregarFormaPago}
                                style={{ paddingLeft: 0, color: ROJO }}
                            >
                                Agregar otra forma de pago
                            </Button>
                        </Space>

                        {Math.abs(totales.totalFormasPago - totales.totalPagar) > 0.01 && (
                            <Tag color="orange" style={{ marginTop: 8 }}>
                                Diferencia con el total a pagar: $
                                {(totales.totalPagar - totales.totalFormasPago).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                            </Tag>
                        )}
                    </Card>
                </Col>

                {/* Totales */}
                <Col xs={24} md={10}>
                    <Card size="small" style={{ borderRadius: 16, borderColor: colors.border }}>
                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                            <FilaTotal label="Total Bruto" valor={totales.totalBruto} />
                            <FilaTotal label="Descuentos" valor={totales.totalDescuentos} />
                            <FilaTotal label="Subtotal" valor={totales.subtotal} />
                            <FilaTotal label="IVA" valor={totales.totalIva} />
                            <FilaTotal label="Retención" valor={-totales.totalRetencion} />
                            <Divider style={{ margin: '8px 0' }} />
                            <FilaTotal label="Total a pagar" valor={totales.totalPagar} grande />
                        </Space>
                    </Card>

                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <Button block onClick={() => navigate('/compras')}>
                            Cancelar
                        </Button>
                        <Button
                            type="primary" block
                            loading={guardando}
                            onClick={guardar}
                            style={{ background: ROJO, borderColor: ROJO, fontWeight: 600 }}
                        >
                            Guardar
                        </Button>
                    </div>
                </Col>
            </Row>
            </>
            )}

            <Modal
                title={<span style={{ color: ROJO_OSCURO, fontWeight: 700 }}>Nuevo proveedor</span>}
                open={modalProveedorVisible}
                onCancel={() => setModalProveedorVisible(false)}
                footer={null}
                destroyOnHidden
            >
                <Form form={formProveedor} layout="vertical" onFinish={crearProveedorRapido}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="Distribuidora XYZ S.A.S." />
                        </Form.Item>
                        <Form.Item name="nit" label="NIT" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="900123456-7" />
                        </Form.Item>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="telefono" label="Teléfono">
                            <Input placeholder="3001234567" />
                        </Form.Item>
                        <Form.Item name="correo" label="Correo">
                            <Input placeholder="contacto@proveedor.com" />
                        </Form.Item>
                    </div>
                    <Form.Item name="direccion" label="Dirección">
                        <Input placeholder="Calle 123 # 45-67" />
                    </Form.Item>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="ciudad" label="Ciudad">
                            <Input placeholder="Bogotá" />
                        </Form.Item>
                        <Form.Item name="plazoCredito" label="Plazo de crédito">
                            <Input placeholder="30 días" />
                        </Form.Item>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setModalProveedorVisible(false)}>Cancelar</Button>
                        <Button
                            type="primary" htmlType="submit" loading={creandoProveedor}
                            style={{ background: ROJO, borderColor: ROJO, fontWeight: 600 }}
                        >
                            Crear proveedor
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ── Modal: importar factura de proveedor (XML o PDF) ── */}
            <Modal
                title={<span style={{ color: ROJO_OSCURO, fontWeight: 700 }}>Importar factura de proveedor</span>}
                open={modalImportar}
                onCancel={() => { setModalImportar(false); setImportado(null) }}
                footer={null}
                destroyOnHidden
                width={560}
            >
                {!importado ? (
                    <>
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="El XML se lee completo y confiable (es el documento estructurado real)."
                            description="El PDF es solo la representación visual — cada proveedor la diseña distinto, así que te muestro lo que se alcanza a leer para que lo revises antes de guardar. Ningún dato se toma de la DIAN: solo leemos el archivo que subas."
                        />
                        <Upload.Dragger
                            accept=".xml,.pdf"
                            multiple={false}
                            showUploadList={false}
                            disabled={importando}
                            beforeUpload={(file) => { procesarArchivo(file); return false }}
                            style={{ padding: '20px 0' }}
                        >
                            <p style={{ fontSize: 32, margin: 0, color: ROJO }}>
                                <UploadOutlined />
                            </p>
                            <p style={{ fontWeight: 600, margin: '8px 0 4px' }}>
                                {importando ? 'Leyendo archivo...' : 'Arrastra o haz clic para subir el XML o PDF'}
                            </p>
                            <p style={{ fontSize: 12, color: colors.textMuted }}>
                                Solo se acepta .xml y .pdf, hasta 10MB
                            </p>
                        </Upload.Dragger>
                    </>
                ) : (
                    <>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                            fontSize: 13, color: importado.fuente === 'XML' ? ROJO : '#D99A0F', fontWeight: 600,
                        }}>
                            <FileTextOutlined />
                            {importado.fuente === 'XML'
                                ? 'Leído desde XML — datos confiables'
                                : 'Leído desde PDF — best effort, revisa antes de usar'}
                        </div>

                        <div style={{
                            background: colors.pageBg, border: `1px solid ${colors.border}`, borderRadius: 16,
                            padding: 14, marginBottom: 14, fontSize: 13,
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 6 }}>
                                <span style={{ color: colors.textSecondary }}>Proveedor</span>
                                <span>{importado.nombreProveedor || <em style={{ color: colors.textMuted }}>No detectado</em>}</span>
                                <span style={{ color: colors.textSecondary }}>NIT</span>
                                <span>{importado.nitProveedor || <em style={{ color: colors.textMuted }}>No detectado</em>}</span>
                                <span style={{ color: colors.textSecondary }}>Número factura</span>
                                <span>{importado.numeroFacturaProveedor || <em style={{ color: colors.textMuted }}>No detectado</em>}</span>
                                <span style={{ color: colors.textSecondary }}>Fecha</span>
                                <span>{importado.fecha || <em style={{ color: colors.textMuted }}>No detectada</em>}</span>
                                <span style={{ color: colors.textSecondary }}>CUFE</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                                    {importado.cufe || <em style={{ color: colors.textMuted, fontFamily: 'inherit' }}>No detectado</em>}
                                </span>
                                <span style={{ color: colors.textSecondary }}>Subtotal</span>
                                <span>{importado.subtotal != null ? `$${importado.subtotal.toLocaleString('es-CO')}` : <em style={{ color: colors.textMuted }}>No detectado</em>}</span>
                                <span style={{ color: colors.textSecondary }}>IVA</span>
                                <span>{importado.totalIva != null ? `$${importado.totalIva.toLocaleString('es-CO')}` : <em style={{ color: colors.textMuted }}>No detectado</em>}</span>
                                <span style={{ color: colors.textSecondary }}>Total</span>
                                <span style={{ fontWeight: 700 }}>{importado.total != null ? `$${importado.total.toLocaleString('es-CO')}` : <em style={{ color: colors.textMuted, fontWeight: 400 }}>No detectado</em>}</span>
                                <span style={{ color: colors.textSecondary }}>Ítems</span>
                                <span>{importado.items.length > 0 ? `${importado.items.length} ítems detectados` : <em style={{ color: colors.textMuted }}>Ninguno</em>}</span>
                            </div>
                        </div>

                        {importado.camposNoExtraidos.length > 0 && (
                            <Alert
                                type="warning"
                                showIcon
                                style={{ marginBottom: 16 }}
                                message="Esto no se pudo leer automáticamente — complétalo a mano después:"
                                description={
                                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                                        {importado.camposNoExtraidos.map((c, i) => <li key={i}>{c}</li>)}
                                    </ul>
                                }
                            />
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button block onClick={() => setImportado(null)}>
                                Subir otro archivo
                            </Button>
                            <Button
                                type="primary" block
                                onClick={usarDatosImportados}
                                style={{ background: ROJO, borderColor: ROJO, fontWeight: 600 }}
                            >
                                Usar estos datos
                            </Button>
                        </div>
                    </>
                )}
            </Modal>
        </div>
    )
}

function FilaTotal({ label, valor, grande }: { label: string; valor: number; grande?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: grande ? colors.heading : colors.textSecondary, fontWeight: grande ? 700 : 400, fontSize: grande ? 15 : 13 }}>
                {label}:
            </span>
            <span style={{ color: grande ? ROJO_OSCURO : colors.heading, fontWeight: grande ? 700 : 500, fontSize: grande ? 16 : 13 }}>
                ${valor.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
            </span>
        </div>
    )
}
