import { useState, useEffect, useCallback } from 'react'
import { colors } from '../../shared/theme/colors'
import {
    Table, Button, Input, Tag, Space, Modal, Form, InputNumber,
    Select, message, Popconfirm, Upload, Tooltip, Statistic, Row, Col, Card, Tabs, Badge, Divider,
    DatePicker, Alert
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
    WarningOutlined, InboxOutlined, UploadOutlined, PictureOutlined,
    ShopOutlined, TagsOutlined, ArrowUpOutlined, ArrowDownOutlined,
    ReloadOutlined, PercentageOutlined, DollarOutlined, FileExcelOutlined, BankOutlined,
    StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import dayjs from 'dayjs'
import { productoService, calcularGanancia, TIPO_IVA_LABEL, PORCENTAJE_IVA } from '../../shared/services/inventarioService'
import type { Producto, ProductoRequest, ResultadoImportacionCatalogo, ResultadoSaldoInicial, TipoIva } from '../../shared/services/inventarioService'
import { proveedorService } from '../../shared/services/proveedorService'
import type { Proveedor } from '../../shared/services/proveedorService'
import CrearProveedorModal from '../../shared/components/CrearProveedorModal'
import { categoriaService } from '../../shared/services/categoriaService'
import type { Categoria } from '../../shared/services/categoriaService'

const UNIDADES = ['Unidad', 'Kilogramo', 'Litro', 'Caja', 'Paquete', 'Metro', 'Gramo', 'Mililitro']

// ─── Componente imagen producto ────────────────────────────────────────────────
function ImagenProducto({ url, nombre }: { url?: string; nombre: string }) {
    if (url) {
        return (
            <img
                src={url}
                alt={nombre}
                style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 14, border: `1px solid ${colors.border}` }}
            />
        )
    }
    return (
        <div style={{
            width: 40, height: 40, borderRadius: 14, background: colors.pageBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px dashed ${colors.border}`
        }}>
            <PictureOutlined style={{ color: colors.textMuted, fontSize: 16 }} />
        </div>
    )
}

// ─── Panel gestión de categorías (microservicio real) ──────────────────────────
function CategoriasPanel({
    categorias, loading, onActualizar
}: {
    categorias: Categoria[]
    loading: boolean
    onActualizar: () => void
}) {
    const [modalVisible, setModalVisible] = useState(false)
    const [editando, setEditando] = useState<Categoria | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [form] = Form.useForm()

    const abrirModal = (cat?: Categoria) => {
        setEditando(cat || null)
        form.setFieldsValue(cat || { activo: true })
        setModalVisible(true)
    }

    const guardar = async (values: any) => {
        setGuardando(true)
        try {
            if (editando) {
                await categoriaService.actualizar(editando.categoriaId, values)
                message.success('Categoría actualizada')
            } else {
                await categoriaService.guardar({ ...values, activo: true })
                message.success('Categoría creada')
            }
            setModalVisible(false)
            form.resetFields()
            onActualizar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar la categoría')
        } finally {
            setGuardando(false)
        }
    }

    const eliminar = async (id: number) => {
        try {
            await categoriaService.eliminar(id)
            message.success('Categoría eliminada')
            onActualizar()
        } catch {
            message.error('Error al eliminar la categoría')
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 600, color: colors.textSecondary }}>
                    {categorias.length} categorías registradas
                </span>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => abrirModal()}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14 }}
                    size="small"
                >
                    Nueva categoría
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {categorias.map(cat => (
                    <div key={cat.categoriaId} style={{
                        background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16,
                        padding: '12px 16px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        opacity: cat.activo ? 1 : 0.5
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <TagsOutlined style={{ fontSize: 16, color: colors.primary }} />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: colors.heading }}>{cat.nombre}</div>
                                {cat.descripcion && (
                                    <div style={{ fontSize: 11, color: colors.textMuted }}>{cat.descripcion}</div>
                                )}
                                {!cat.activo && <Tag color="default" style={{ fontSize: 10, marginTop: 2 }}>Inactiva</Tag>}
                            </div>
                        </div>
                        <Space size={4}>
                            <Button
                                type="text" size="small" icon={<EditOutlined />}
                                onClick={() => abrirModal(cat)}
                                style={{ color: colors.primary }}
                            />
                            <Popconfirm
                                title="¿Eliminar categoría?"
                                onConfirm={() => eliminar(cat.categoriaId)}
                                okText="Sí" cancelText="No"
                                okButtonProps={{ danger: true }}
                            >
                                <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                            </Popconfirm>
                        </Space>
                    </div>
                ))}
                {!loading && categorias.length === 0 && (
                    <div style={{ color: colors.textMuted, fontSize: 13, padding: 16 }}>
                        No hay categorías registradas todavía.
                    </div>
                )}
            </div>

            <Modal
                title={
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        {editando ? 'Editar categoría' : 'Nueva categoría'}
                    </span>
                }
                open={modalVisible}
                onCancel={() => { setModalVisible(false); form.resetFields() }}
                footer={null}
                width={420}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onFinish={guardar} style={{ marginTop: 16 }}>
                    <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Ej: Bebidas" style={{ borderRadius: 14 }} />
                    </Form.Item>
                    <Form.Item name="descripcion" label="Descripción (opcional)">
                        <Input placeholder="Descripción breve" style={{ borderRadius: 14 }} />
                    </Form.Item>
                    {editando && (
                        <Form.Item name="activo" label="Estado">
                            <Select>
                                <Select.Option value={true}>Activa</Select.Option>
                                <Select.Option value={false}>Inactiva</Select.Option>
                            </Select>
                        </Form.Item>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <Button onClick={() => { setModalVisible(false); form.resetFields() }}>Cancelar</Button>
                        <Button
                            type="primary" htmlType="submit" loading={guardando}
                            style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14 }}
                        >
                            {editando ? 'Guardar cambios' : 'Crear categoría'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function InventarioPage() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingCategorias, setLoadingCategorias] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const [filtroCat, setFiltroCat] = useState<number | undefined>()
    const [filtroProveedor, setFiltroProveedor] = useState<string | undefined>()
    const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS')
    const [filtroStock, setFiltroStock] = useState<'TODOS' | 'BAJO' | 'SIN_STOCK' | 'CON_STOCK'>('TODOS')
    const [filtroUnidad, setFiltroUnidad] = useState<string | undefined>()
    const [precioVentaMin, setPrecioVentaMin] = useState<number | undefined>()
    const [precioVentaMax, setPrecioVentaMax] = useState<number | undefined>()
    const [ordenarPor, setOrdenarPor] = useState<'nombre' | 'precioVenta_asc' | 'precioVenta_desc' | 'stock_asc' | 'stock_desc'>('nombre')
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false)
    const [modalVisible, setModalVisible] = useState(false)
    const [editando, setEditando] = useState<Producto | null>(null)
    const [loadingModal, setLoadingModal] = useState(false)
    const [imagenPreview, setImagenPreview] = useState<string | undefined>()
    const [imagenFile, setImagenFile] = useState<File | undefined>()
    const [fileList, setFileList] = useState<UploadFile[]>([])
    const [precioCompra, setPrecioCompra] = useState(0)
    const [precioVenta, setPrecioVenta] = useState(0)
    const [activeTab, setActiveTab] = useState('productos')
    const [modalProveedor, setModalProveedor] = useState(false)
    const [form] = Form.useForm()

    // ── Importar catálogo desde Excel ──
    const [modalCatalogoVisible, setModalCatalogoVisible] = useState(false)
    const [archivoCatalogo, setArchivoCatalogo] = useState<File | undefined>()
    const [importandoCatalogo, setImportandoCatalogo] = useState(false)
    const [resultadoCatalogo, setResultadoCatalogo] = useState<ResultadoImportacionCatalogo | null>(null)

    // ── Cargar saldo inicial de inventario desde Excel ──
    const [modalSaldoVisible, setModalSaldoVisible] = useState(false)
    const [archivoSaldo, setArchivoSaldo] = useState<File | undefined>()
    const [cargandoSaldo, setCargandoSaldo] = useState(false)
    const [resultadoSaldo, setResultadoSaldo] = useState<ResultadoSaldoInicial | null>(null)
    const [formSaldo] = Form.useForm()

    const tipoIvaSeleccionado = Form.useWatch('tipoIva', form)
    const ganancia = calcularGanancia(precioCompra, precioVenta, tipoIvaSeleccionado)

    // ── Carga de datos ──
    const cargarProductos = useCallback(() => {
        setLoading(true)
        productoService.listar()
            .then(({ data }) => setProductos(data))
            .catch(() => message.error('Error al cargar los productos'))
            .finally(() => setLoading(false))
    }, [])

    const cargarCategorias = useCallback(() => {
        setLoadingCategorias(true)
        categoriaService.listar()
            .then(({ data }) => setCategorias(data))
            .catch(() => message.error('Error al cargar las categorías'))
            .finally(() => setLoadingCategorias(false))
    }, [])

    const cargarProveedores = useCallback(() => {
        proveedorService.listar()
            .then(({ data }) => setProveedores(data))
            .catch(() => { /* no crítico para listar productos */ })
    }, [])

    useEffect(() => {
        cargarProductos()
        cargarCategorias()
        cargarProveedores()
    }, [cargarProductos, cargarCategorias, cargarProveedores])

    // ── Helpers de nombre por id ──
    const nombreProveedor = (proveedorId?: string) =>
        proveedores.find(p => String(p.proveedorId) === proveedorId)?.nombre

    const categoriaDe = (categoriaId?: string) =>
        categorias.find(c => String(c.categoriaId) === categoriaId)

    // ── Filtros ──
    const productosFiltrados = productos
        .filter(p => {
            const matchBusqueda = !busqueda ||
                p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                p.sku.toLowerCase().includes(busqueda.toLowerCase()) ||
                (p.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
            const matchCat = !filtroCat || p.categoriaId === String(filtroCat)
            const matchProveedor = !filtroProveedor || p.proveedorId === filtroProveedor
            const matchEstado = filtroEstado === 'TODOS' || (filtroEstado === 'ACTIVO' ? p.activo : !p.activo)
            const matchStock = filtroStock === 'TODOS'
                || (filtroStock === 'BAJO' && p.stock <= p.stockMinimo && p.stock > 0)
                || (filtroStock === 'SIN_STOCK' && p.stock <= 0)
                || (filtroStock === 'CON_STOCK' && p.stock > p.stockMinimo)
            const matchUnidad = !filtroUnidad || p.unidad === filtroUnidad
            const matchPrecioMin = precioVentaMin == null || p.precioVenta >= precioVentaMin
            const matchPrecioMax = precioVentaMax == null || p.precioVenta <= precioVentaMax
            return matchBusqueda && matchCat && matchProveedor && matchEstado && matchStock && matchUnidad && matchPrecioMin && matchPrecioMax
        })
        .sort((a, b) => {
            switch (ordenarPor) {
                case 'precioVenta_asc': return a.precioVenta - b.precioVenta
                case 'precioVenta_desc': return b.precioVenta - a.precioVenta
                case 'stock_asc': return a.stock - b.stock
                case 'stock_desc': return b.stock - a.stock
                default: return a.nombre.localeCompare(b.nombre)
            }
        })

    const filtrosActivos = [
        filtroCat, filtroProveedor, filtroUnidad, precioVentaMin, precioVentaMax,
        filtroEstado !== 'TODOS' ? filtroEstado : undefined,
        filtroStock !== 'TODOS' ? filtroStock : undefined,
    ].filter(v => v !== undefined && v !== null).length

    const limpiarFiltros = () => {
        setBusqueda('')
        setFiltroCat(undefined)
        setFiltroProveedor(undefined)
        setFiltroEstado('TODOS')
        setFiltroStock('TODOS')
        setFiltroUnidad(undefined)
        setPrecioVentaMin(undefined)
        setPrecioVentaMax(undefined)
        setOrdenarPor('nombre')
    }

    const stockBajo = productos.filter(p => p.stock <= p.stockMinimo)

    // ── Estadísticas ──
    const valorInventario = productos.reduce((s, p) => s + p.precioVenta * p.stock, 0)
    const gananciaPotencial = productos.reduce((s, p) => s + (p.precioVenta - p.precioCompra) * p.stock, 0)

    // ── Modal producto ──
    const abrirModal = (producto?: Producto) => {
        setImagenPreview(undefined)
        setImagenFile(undefined)
        setFileList([])
        if (producto) {
            setEditando(producto)
            setPrecioCompra(producto.precioCompra)
            setPrecioVenta(producto.precioVenta)
            form.setFieldsValue({
                ...producto,
                categoriaId: producto.categoriaId ? Number(producto.categoriaId) : undefined,
                proveedorId: producto.proveedorId ? Number(producto.proveedorId) : undefined,
            })
            if (producto.imagenUrl) setImagenPreview(producto.imagenUrl)
        } else {
            setEditando(null)
            setPrecioCompra(0)
            setPrecioVenta(0)
            form.resetFields()
            form.setFieldsValue({ activo: true, stock: 0, stockMinimo: 5, unidad: 'Unidad', tipoIva: 'GENERAL_19' })
        }
        setModalVisible(true)
    }

    const guardarProducto = async (values: any) => {
        setLoadingModal(true)
        try {
            const request: ProductoRequest = {
                sku: values.sku,
                nombre: values.nombre,
                descripcion: values.descripcion,
                categoriaId: values.categoriaId != null ? String(values.categoriaId) : undefined,
                proveedorId: values.proveedorId != null ? String(values.proveedorId) : undefined,
                precioCompra: values.precioCompra || 0,
                precioVenta: values.precioVenta || 0,
                stock: values.stock || 0,
                stockMinimo: values.stockMinimo || 0,
                unidad: values.unidad,
                activo: values.activo,
                imagenUrl: editando?.imagenUrl,
                tipoIva: values.tipoIva || 'GENERAL_19',
            }

            if (editando) {
                await productoService.actualizar(editando.sku, request)
                message.success('Producto actualizado')
            } else {
                await productoService.guardar(request)
                message.success('Producto creado')
            }

            if (imagenFile) {
                try {
                    await productoService.subirImagen?.(request.sku, imagenFile)
                } catch {
                    message.warning('El producto se guardó, pero la imagen no se pudo subir')
                }
            }

            setModalVisible(false)
            form.resetFields()
            cargarProductos()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar el producto')
        } finally {
            setLoadingModal(false)
        }
    }

    const eliminarProducto = async (sku: string) => {
        try {
            await productoService.eliminar(sku)
            message.success('Producto eliminado')
            cargarProductos()
        } catch {
            message.error('Error al eliminar el producto')
        }
    }

    // ── Importar catálogo desde Excel ──
    const cerrarModalCatalogo = () => {
        setModalCatalogoVisible(false)
        setArchivoCatalogo(undefined)
        setResultadoCatalogo(null)
    }

    const importarCatalogo = async () => {
        if (!archivoCatalogo) { message.warning('Selecciona primero un archivo de Excel'); return }
        setImportandoCatalogo(true)
        try {
            const { data } = await productoService.importarCatalogo(archivoCatalogo)
            setResultadoCatalogo(data)
            if (data.creados + data.actualizados > 0) {
                message.success(`${data.creados} creados, ${data.actualizados} actualizados`)
                cargarProductos()
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo importar el archivo')
        } finally {
            setImportandoCatalogo(false)
        }
    }

    // ── Cargar saldo inicial de inventario desde Excel ──
    const cerrarModalSaldo = () => {
        setModalSaldoVisible(false)
        setArchivoSaldo(undefined)
        setResultadoSaldo(null)
        formSaldo.resetFields()
    }

    const cargarSaldoInicial = async (values: any) => {
        if (!archivoSaldo) { message.warning('Selecciona primero un archivo de Excel'); return }
        setCargandoSaldo(true)
        try {
            const fechaCorte = values.fechaCorte ? dayjs(values.fechaCorte).format('YYYY-MM-DD') : undefined
            const { data } = await productoService.importarSaldosIniciales(archivoSaldo, values.cuentaContrapartida, fechaCorte)
            setResultadoSaldo(data)
            if (data.numeroAsiento) {
                message.success(`Saldo inicial cargado — asiento ${data.numeroAsiento}`)
                cargarProductos()
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo cargar el saldo inicial')
        } finally {
            setCargandoSaldo(false)
        }
    }

    // ── Upload imagen ──
    const uploadProps: UploadProps = {
        beforeUpload: (file) => {
            const isImage = file.type.startsWith('image/')
            if (!isImage) { message.error('Solo se permiten imágenes'); return false }
            const isLt2M = file.size / 1024 / 1024 < 2
            if (!isLt2M) { message.error('La imagen debe ser menor a 2MB'); return false }
            setImagenFile(file)
            const reader = new FileReader()
            reader.onload = (e) => setImagenPreview(e.target?.result as string)
            reader.readAsDataURL(file)
            return false
        },
        fileList,
        onChange: ({ fileList: fl }) => setFileList(fl.slice(-1)),
        showUploadList: false,
    }

    // ── Columnas tabla ──
    const columnas = [
        {
            title: '',
            key: 'imagen',
            width: 56,
            render: (_: any, record: Producto) => (
                <ImagenProducto url={record.imagenUrl} nombre={record.nombre} />
            )
        },
        {
            title: 'SKU',
            dataIndex: 'sku',
            key: 'sku',
            width: 110,
            render: (v: string) => (
                <span style={{ fontWeight: 600, color: colors.primary, fontFamily: 'monospace', fontSize: 12 }}>{v}</span>
            )
        },
        {
            title: 'Producto',
            dataIndex: 'nombre',
            key: 'nombre',
            render: (v: string, record: Producto) => {
                const prov = nombreProveedor(record.proveedorId)
                return (
                    <div>
                        <div style={{ fontWeight: 600, color: colors.heading }}>{v}</div>
                        {prov && (
                            <div style={{ fontSize: 11, color: colors.textMuted }}>
                                <ShopOutlined style={{ marginRight: 3 }} />{prov}
                            </div>
                        )}
                    </div>
                )
            }
        },
        {
            title: 'Categoría',
            dataIndex: 'categoriaId',
            key: 'categoria',
            render: (categoriaId: string) => {
                const cat = categoriaDe(categoriaId)
                if (!cat) return <Tag style={{ borderRadius: 10 }}>Sin categoría</Tag>
                return (
                    <Tag color="green" style={{ borderRadius: 10, fontWeight: 500 }}>
                        {cat.nombre}
                    </Tag>
                )
            }
        },
        {
            title: 'Precio compra',
            dataIndex: 'precioCompra',
            key: 'precioCompra',
            render: (v: number) => (
                <span style={{ color: colors.textSecondary, fontSize: 13 }}>${v.toLocaleString('es-CO')}</span>
            )
        },
        {
            title: 'Precio venta',
            dataIndex: 'precioVenta',
            key: 'precioVenta',
            render: (v: number) => (
                <span style={{ fontWeight: 700, color: '#2c3e50' }}>${v.toLocaleString('es-CO')}</span>
            )
        },
        {
            title: 'Ganancia',
            key: 'ganancia',
            render: (_: any, record: Producto) => {
                const g = calcularGanancia(record.precioCompra, record.precioVenta, record.tipoIva)
                return (
                    <Tooltip title={`$${g.pesos.toLocaleString('es-CO')} por unidad`}>
                        <Tag
                            color={g.porcentaje >= 20 ? 'green' : g.porcentaje >= 0 ? 'orange' : 'red'}
                            style={{ borderRadius: 10, fontWeight: 600 }}
                        >
                            {g.porcentaje >= 0
                                ? <ArrowUpOutlined style={{ fontSize: 10 }} />
                                : <ArrowDownOutlined style={{ fontSize: 10 }} />
                            }
                            {' '}{Math.abs(g.porcentaje).toFixed(1)}%
                        </Tag>
                    </Tooltip>
                )
            }
        },
        {
            title: 'IVA',
            dataIndex: 'tipoIva',
            key: 'tipoIva',
            render: (v: TipoIva) => (
                <Tooltip title={TIPO_IVA_LABEL[v] ?? v}>
                    <Tag style={{ borderRadius: 10 }}>
                        {v === 'EXENTO' ? 'Exento' : v === 'EXCLUIDO' ? 'Excluido' : `${PORCENTAJE_IVA[v] ?? 19}%`}
                    </Tag>
                </Tooltip>
            )
        },
        {
            title: 'Stock',
            dataIndex: 'stock',
            key: 'stock',
            render: (v: number, record: Producto) => (
                <Space>
                    <span style={{
                        fontWeight: 700,
                        color: v <= record.stockMinimo ? colors.primary : v <= record.stockMinimo * 2 ? '#fa8c16' : '#52c41a'
                    }}>
                        {v} {record.unidad}
                    </span>
                    {v <= record.stockMinimo && <WarningOutlined style={{ color: colors.primary, fontSize: 12 }} />}
                </Space>
            )
        },
        {
            title: 'Estado',
            dataIndex: 'activo',
            key: 'activo',
            render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>
        },
        {
            title: 'Acciones',
            key: 'acciones',
            render: (_: any, record: Producto) => (
                <Space>
                    <Button
                        type="text" icon={<EditOutlined />}
                        onClick={() => abrirModal(record)}
                        style={{ color: colors.primary }}
                    />
                    <Popconfirm
                        title="¿Eliminar producto?"
                        description="Esta acción no se puede deshacer"
                        onConfirm={() => eliminarProducto(record.sku)}
                        okText="Sí, eliminar" cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            )
        },
    ]

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <InboxOutlined style={{ marginRight: 8 }} />
                        Inventario
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: 0, fontSize: 13 }}>
                        {productos.length} productos registrados
                        {stockBajo.length > 0 && (
                            <span style={{ color: colors.primary, marginLeft: 8, fontWeight: 600 }}>
                                · <WarningOutlined /> {stockBajo.length} con stock bajo
                            </span>
                        )}
                    </p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={cargarProductos} style={{ borderRadius: 14 }}>
                        Actualizar
                    </Button>
                    <Button
                        icon={<FileExcelOutlined />}
                        onClick={() => setModalCatalogoVisible(true)}
                        style={{ borderRadius: 14 }}
                    >
                        Importar catálogo
                    </Button>
                    <Button
                        icon={<BankOutlined />}
                        onClick={() => setModalSaldoVisible(true)}
                        style={{ borderRadius: 14 }}
                    >
                        Saldo inicial
                    </Button>
                    <Button
                        type="primary" icon={<PlusOutlined />}
                        onClick={() => { setActiveTab('productos'); abrirModal() }}
                        style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                    >
                        Nuevo producto
                    </Button>
                </Space>
            </div>

            {/* Tarjetas resumen */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ borderRadius: 16, borderColor: colors.border }}>
                        <Statistic
                            title="Productos activos"
                            value={productos.filter(p => p.activo).length}
                            prefix={<InboxOutlined style={{ color: colors.primary }} />}
                            styles={{ content: { color: colors.primary, fontWeight: 700 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ borderRadius: 16, borderColor: colors.border }}>
                        <Statistic
                            title="Stock bajo"
                            value={stockBajo.length}
                            prefix={<WarningOutlined style={{ color: '#fa8c16' }} />}
                            styles={{ content: { color: stockBajo.length > 0 ? '#fa8c16' : '#52c41a', fontWeight: 700 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ borderRadius: 16, borderColor: colors.border }}>
                        <Statistic
                            title="Valor inventario"
                            value={valorInventario}
                            prefix={<DollarOutlined style={{ color: colors.primary }} />}
                            formatter={v => `$${Number(v).toLocaleString('es-CO')}`}
                            styles={{ content: { color: colors.heading, fontWeight: 700, fontSize: 15 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ borderRadius: 16, borderColor: colors.border }}>
                        <Statistic
                            title="Ganancia potencial"
                            value={gananciaPotencial}
                            prefix={<PercentageOutlined style={{ color: '#52c41a' }} />}
                            formatter={v => `$${Number(v).toLocaleString('es-CO')}`}
                            styles={{ content: { color: '#52c41a', fontWeight: 700, fontSize: 15 } }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Alerta stock bajo */}
            {stockBajo.length > 0 && (
                <div style={{
                    background: colors.primaryLight, border: `1px solid ${colors.border}`, borderRadius: 14,
                    padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
                }}>
                    <WarningOutlined style={{ color: colors.primary }} />
                    <span style={{ color: colors.primary, fontWeight: 500, fontSize: 13 }}>
                        Stock bajo: {stockBajo.map(p => p.nombre).join(', ')}
                    </span>
                </div>
            )}

            {/* Tabs: Productos / Categorías */}
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'productos',
                        label: (
                            <span>
                                <InboxOutlined /> Productos
                                <Badge count={productos.length} style={{ marginLeft: 6, background: colors.primary }} />
                            </span>
                        ),
                        children: (
                            <div>
                                {/* Filtros — fila básica siempre visible */}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Input
                                        placeholder="Buscar por nombre, SKU o descripción..."
                                        prefix={<SearchOutlined style={{ color: colors.primary }} />}
                                        value={busqueda}
                                        onChange={e => setBusqueda(e.target.value)}
                                        style={{ borderRadius: 14, maxWidth: 300 }}
                                        allowClear
                                    />
                                    <Select
                                        placeholder="Categoría"
                                        allowClear
                                        value={filtroCat}
                                        onChange={setFiltroCat}
                                        style={{ width: 180 }}
                                        options={categorias.map(c => ({
                                            value: c.categoriaId,
                                            label: c.nombre
                                        }))}
                                    />
                                    <Select
                                        placeholder="Proveedor"
                                        allowClear
                                        showSearch
                                        optionFilterProp="label"
                                        value={filtroProveedor}
                                        onChange={setFiltroProveedor}
                                        style={{ width: 180 }}
                                        options={proveedores.map(p => ({ value: String(p.proveedorId), label: p.nombre }))}
                                    />
                                    <Select
                                        value={filtroStock}
                                        onChange={setFiltroStock}
                                        style={{ width: 160 }}
                                        options={[
                                            { value: 'TODOS', label: 'Todo el stock' },
                                            { value: 'BAJO', label: <><WarningOutlined style={{ color: '#fa8c16', marginRight: 6 }} />Stock bajo</> },
                                            { value: 'SIN_STOCK', label: <><StopOutlined style={{ color: colors.red, marginRight: 6 }} />Sin stock</> },
                                            { value: 'CON_STOCK', label: <><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />Con stock</> },
                                        ]}
                                    />
                                    <Button
                                        type={mostrarMasFiltros ? 'primary' : 'default'}
                                        onClick={() => setMostrarMasFiltros(v => !v)}
                                        style={{ borderRadius: 14 }}
                                    >
                                        Más filtros {filtrosActivos > 0 && `(${filtrosActivos})`}
                                    </Button>
                                    {(busqueda || filtrosActivos > 0) && (
                                        <Button type="text" onClick={limpiarFiltros} style={{ color: colors.textMuted }}>
                                            Limpiar filtros
                                        </Button>
                                    )}
                                </div>

                                {/* Filtros avanzados — desplegable */}
                                {mostrarMasFiltros && (
                                    <div style={{
                                        display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center',
                                        background: colors.pageBg, border: '1px solid #ECEFEA', borderRadius: 16, padding: 14,
                                    }}>
                                        <Select
                                            value={filtroEstado}
                                            onChange={setFiltroEstado}
                                            style={{ width: 150 }}
                                            options={[
                                                { value: 'TODOS', label: 'Activos e inactivos' },
                                                { value: 'ACTIVO', label: 'Solo activos' },
                                                { value: 'INACTIVO', label: 'Solo inactivos' },
                                            ]}
                                        />
                                        <Select
                                            placeholder="Unidad"
                                            allowClear
                                            value={filtroUnidad}
                                            onChange={setFiltroUnidad}
                                            style={{ width: 150 }}
                                            options={UNIDADES.map(u => ({ value: u, label: u }))}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 12.5, color: colors.textSecondary }}>Precio venta</span>
                                            <InputNumber
                                                placeholder="Mín"
                                                min={0}
                                                value={precioVentaMin}
                                                onChange={(v) => setPrecioVentaMin(v ?? undefined)}
                                                style={{ width: 100 }}
                                            />
                                            <span style={{ color: colors.textMuted }}>—</span>
                                            <InputNumber
                                                placeholder="Máx"
                                                min={0}
                                                value={precioVentaMax}
                                                onChange={(v) => setPrecioVentaMax(v ?? undefined)}
                                                style={{ width: 100 }}
                                            />
                                        </div>
                                        <Select
                                            value={ordenarPor}
                                            onChange={setOrdenarPor}
                                            style={{ width: 190 }}
                                            options={[
                                                { value: 'nombre', label: 'Ordenar: nombre (A-Z)' },
                                                { value: 'precioVenta_asc', label: 'Precio: menor a mayor' },
                                                { value: 'precioVenta_desc', label: 'Precio: mayor a menor' },
                                                { value: 'stock_asc', label: 'Stock: menor a mayor' },
                                                { value: 'stock_desc', label: 'Stock: mayor a menor' },
                                            ]}
                                        />
                                    </div>
                                )}

                                <div style={{ marginBottom: 12, fontSize: 12.5, color: colors.textSecondary }}>
                                    Mostrando {productosFiltrados.length} de {productos.length} productos
                                </div>

                                <TablaOrdenable
                                    dataSource={productosFiltrados}
                                    rowKey="sku"
                                    columns={columnas}
                                    loading={loading}
                                    pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `${t} productos` }}
                                    style={{ background: colors.cardBg, borderRadius: 18 }}
                                    scroll={{ x: 900 }}
                                    size="middle"
                                />
                            </div>
                        )
                    },
                    {
                        key: 'categorias',
                        label: (
                            <span>
                                <TagsOutlined /> Categorías
                                <Badge count={categorias.length} style={{ marginLeft: 6, background: '#9b59b6' }} />
                            </span>
                        ),
                        children: (
                            <CategoriasPanel
                                categorias={categorias}
                                loading={loadingCategorias}
                                onActualizar={cargarCategorias}
                            />
                        )
                    }
                ]}
            />

            {/* ── Modal crear/editar producto ── */}
            <Modal
                title={
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        {editando ? 'Editar producto' : 'Nuevo producto'}
                    </span>
                }
                open={modalVisible}
                onCancel={() => { setModalVisible(false); form.resetFields() }}
                footer={null}
                width={680}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onFinish={guardarProducto} style={{ marginTop: 12 }}>
                    {/* Imagen */}
                    <Form.Item label="Imagen del producto">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: 16,
                                border: `2px dashed ${colors.border}`, overflow: 'hidden',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: colors.pageBg, flexShrink: 0
                            }}>
                                {imagenPreview
                                    ? <img src={imagenPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <PictureOutlined style={{ fontSize: 28, color: colors.textMuted }} />
                                }
                            </div>
                            <div>
                                <Upload {...uploadProps}>
                                    <Button icon={<UploadOutlined />} style={{ borderRadius: 14 }}>
                                        {imagenPreview ? 'Cambiar imagen' : 'Subir imagen'}
                                    </Button>
                                </Upload>
                                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                                    JPG, PNG o WebP · Máx 2MB
                                </div>
                            </div>
                        </div>
                    </Form.Item>

                    <Divider style={{ margin: '8px 0 16px' }} />

                    {/* SKU + Categoría */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="sku" label="SKU" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="PRD-001" style={{ borderRadius: 14 }} disabled={!!editando} />
                        </Form.Item>
                        <Form.Item name="categoriaId" label="Categoría">
                            <Select
                                placeholder="Selecciona categoría"
                                allowClear
                                loading={loadingCategorias}
                                options={categorias.filter(c => c.activo).map(c => ({
                                    value: c.categoriaId,
                                    label: c.nombre
                                }))}
                                dropdownRender={menu => (
                                    <>
                                        {menu}
                                        <Divider style={{ margin: '4px 0' }} />
                                        <div
                                            style={{ padding: '6px 12px', cursor: 'pointer', color: colors.primary, fontWeight: 500, fontSize: 13 }}
                                            onClick={() => { setModalVisible(false); setActiveTab('categorias') }}
                                        >
                                            <PlusOutlined /> Gestionar categorías
                                        </div>
                                    </>
                                )}
                            />
                        </Form.Item>
                    </div>

                    {/* Nombre */}
                    <Form.Item name="nombre" label="Nombre del producto" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Ej: Coca Cola 350ml" style={{ borderRadius: 14 }} />
                    </Form.Item>

                    {/* Descripción */}
                    <Form.Item name="descripcion" label="Descripción (opcional)">
                        <Input.TextArea rows={2} placeholder="Descripción del producto" style={{ borderRadius: 14 }} />
                    </Form.Item>

                    {/* Proveedor */}
                    <Form.Item name="proveedorId" label="Proveedor">
                        <Select
                            placeholder="Selecciona el proveedor que lo vendió"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={proveedores.filter(p => p.activo).map(p => ({
                                value: p.proveedorId,
                                label: `${p.nombre} · NIT: ${p.nit}`
                            }))}
                            popupRender={(menu) => (
                                <>
                                    {menu}
                                    <Divider style={{ margin: '6px 0' }} />
                                    <Button type="text" block icon={<PlusOutlined />} onClick={() => setModalProveedor(true)} style={{ textAlign: 'left', color: colors.primary }}>
                                        Crear nuevo proveedor
                                    </Button>
                                </>
                            )}
                        />
                    </Form.Item>

                    {/* Tipo de IVA */}
                    <Form.Item
                        name="tipoIva"
                        label="Tipo de IVA"
                        rules={[{ required: true, message: 'Requerido' }]}
                        tooltip="Determina cuánto IVA se cobra al vender este producto y cómo aparece en la factura electrónica"
                    >
                        <Select
                            options={Object.entries(TIPO_IVA_LABEL).map(([value, label]) => ({ value, label }))}
                        />
                    </Form.Item>

                    {/* Precios y ganancia */}
                    <div style={{
                        background: colors.pageBg, border: `1px solid ${colors.border}`,
                        borderRadius: 16, padding: '14px 16px', marginBottom: 16
                    }}>
                        <div style={{ fontWeight: 600, color: colors.textSecondary, marginBottom: 12, fontSize: 13 }}>
                            Precios y rentabilidad
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Form.Item name="precioCompra" label="Precio de compra" style={{ marginBottom: 0 }} rules={[{ required: true, message: 'Requerido' }]}>
                                <InputNumber
                                    placeholder="0"
                                    style={{ width: '100%', borderRadius: 14 }}
                                    min={0}
                                    onChange={v => setPrecioCompra(Number(v) || 0)}
                                />
                            </Form.Item>
                            <Form.Item
                                name="precioVenta"
                                label="Precio de venta"
                                tooltip="Precio final al público, con IVA incluido — el que va en la vitrina. El sistema desglosa la base y el IVA hacia adentro para la contabilidad y la factura electrónica."
                                style={{ marginBottom: 0 }}
                                rules={[{ required: true, message: 'Requerido' }]}
                            >
                                <InputNumber
                                    placeholder="0"
                                    style={{ width: '100%', borderRadius: 14 }}
                                    min={0}
                                    onChange={v => setPrecioVenta(Number(v) || 0)}
                                />
                            </Form.Item>
                        </div>

                        {(precioCompra > 0 || precioVenta > 0) && (
                            <div style={{
                                marginTop: 12, padding: '10px 14px',
                                background: ganancia.pesos >= 0 ? '#f6ffed' : '#fff2f0',
                                border: `1px solid ${ganancia.pesos >= 0 ? '#b7eb8f' : '#ffccc7'}`,
                                borderRadius: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <span style={{ fontSize: 13, color: colors.textSecondary }}>
                                    Ganancia por unidad:
                                </span>
                                <Space size={12}>
                                    <span style={{
                                        fontWeight: 700, fontSize: 15,
                                        color: ganancia.pesos >= 0 ? '#52c41a' : colors.primary
                                    }}>
                                        {ganancia.pesos >= 0 ? '+' : ''}{ganancia.pesos >= 0
                                            ? `$${ganancia.pesos.toLocaleString('es-CO')}`
                                            : `-$${Math.abs(ganancia.pesos).toLocaleString('es-CO')}`
                                        }
                                    </span>
                                    <Tag
                                        color={ganancia.porcentaje >= 20 ? 'green' : ganancia.porcentaje >= 0 ? 'orange' : 'red'}
                                        style={{ fontWeight: 700, fontSize: 13 }}
                                    >
                                        {ganancia.porcentaje >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                        {' '}{Math.abs(ganancia.porcentaje).toFixed(1)}%
                                    </Tag>
                                </Space>
                            </div>
                        )}
                    </div>

                    {/* Stock + Unidad */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <Form.Item name="stock" label="Stock actual" rules={[{ required: true, message: 'Requerido' }]}>
                            <InputNumber placeholder="0" style={{ width: '100%', borderRadius: 14 }} min={0} />
                        </Form.Item>
                        <Form.Item name="stockMinimo" label="Stock mínimo" rules={[{ required: true, message: 'Requerido' }]}>
                            <InputNumber placeholder="5" style={{ width: '100%', borderRadius: 14 }} min={0} />
                        </Form.Item>
                        <Form.Item name="unidad" label="Unidad" rules={[{ required: true, message: 'Requerido' }]}>
                            <Select placeholder="Unidad">
                                {UNIDADES.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}
                            </Select>
                        </Form.Item>
                    </div>

                    {/* Estado */}
                    <Form.Item name="activo" label="Estado" initialValue={true}>
                        <Select>
                            <Select.Option value={true}>Activo</Select.Option>
                            <Select.Option value={false}>Inactivo</Select.Option>
                        </Select>
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                        <Button onClick={() => { setModalVisible(false); form.resetFields() }}>
                            Cancelar
                        </Button>
                        <Button
                            type="primary" htmlType="submit" loading={loadingModal}
                            style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                        >
                            {editando ? 'Guardar cambios' : 'Crear producto'}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ── Modal importar catálogo ── */}
            <Modal
                title={
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        <FileExcelOutlined style={{ marginRight: 8 }} />
                        Importar catálogo desde Excel
                    </span>
                }
                open={modalCatalogoVisible}
                onCancel={cerrarModalCatalogo}
                footer={null}
                width={520}
                destroyOnHidden
            >
                <Alert
                    type="info"
                    showIcon
                    message="Columnas en este orden (la primera fila es el encabezado)"
                    description="sku · nombre · descripcion · categoria · proveedor · precioCompra · precioVenta · stockMinimo · unidad · tipoIva"
                    style={{ marginBottom: 12, borderRadius: 14 }}
                />
                <p style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 16 }}>
                    Categoría y proveedor se buscan por nombre (si no existen, el producto queda sin
                    asignar). No incluyas cantidades — el stock se carga aparte con "Saldo inicial".
                    Si el SKU ya existe, se actualiza su catálogo; el stock nunca se toca acá.
                </p>

                <Upload
                    accept=".xlsx,.xls"
                    maxCount={1}
                    beforeUpload={(file) => { setArchivoCatalogo(file); setResultadoCatalogo(null); return false }}
                    onRemove={() => setArchivoCatalogo(undefined)}
                >
                    <Button icon={<UploadOutlined />} style={{ borderRadius: 14 }}>Seleccionar archivo</Button>
                </Upload>

                {resultadoCatalogo && (
                    <div style={{ marginTop: 16 }}>
                        <Alert
                            type={resultadoCatalogo.errores.length > 0 ? 'warning' : 'success'}
                            showIcon
                            message={`${resultadoCatalogo.creados} creados, ${resultadoCatalogo.actualizados} actualizados`}
                            description={resultadoCatalogo.errores.length > 0
                                ? `${resultadoCatalogo.errores.length} fila(s) con error` : undefined}
                            style={{ borderRadius: 14 }}
                        />
                        {resultadoCatalogo.errores.length > 0 && (
                            <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 8, fontSize: 12 }}>
                                {resultadoCatalogo.errores.map((e, i) => (
                                    <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${colors.border}`, color: colors.primary }}>
                                        Fila {e.fila}{e.sku ? ` (${e.sku})` : ''}: {e.motivo}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                    <Button onClick={cerrarModalCatalogo}>Cerrar</Button>
                    <Button
                        type="primary" loading={importandoCatalogo} onClick={importarCatalogo}
                        style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                    >
                        Importar
                    </Button>
                </div>
            </Modal>

            {/* ── Modal saldo inicial de inventario ── */}
            <Modal
                title={
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        <BankOutlined style={{ marginRight: 8 }} />
                        Saldo inicial de inventario
                    </span>
                }
                open={modalSaldoVisible}
                onCancel={cerrarModalSaldo}
                footer={null}
                width={520}
                destroyOnHidden
            >
                <Alert
                    type="warning"
                    showIcon
                    message="Esto es de una sola vez por empresa"
                    description={'Genera un asiento contable único (Debe Inventario, Haber la cuenta que indiques abajo). ' +
                        'Si ya cargaste el saldo inicial antes, el sistema lo rechaza — para corregirlo hay que ' +
                        'hacer un ajuste manual en Contabilidad, no reintentar esta carga.'}
                    style={{ marginBottom: 12, borderRadius: 14 }}
                />
                <p style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 16 }}>
                    Columnas: sku · cantidad · costoUnitario. Los SKU deben existir ya en el catálogo
                    (importalo primero si hace falta).
                </p>

                <Form form={formSaldo} layout="vertical" onFinish={cargarSaldoInicial}>
                    <Form.Item
                        name="cuentaContrapartida"
                        label="Cuenta contrapartida (código del PUC)"
                        rules={[{ required: true, message: 'Requerido' }]}
                        extra="La que definas con tu contador — no la adivina el sistema."
                    >
                        <Input placeholder="Ej: 319595" style={{ borderRadius: 14 }} />
                    </Form.Item>
                    <Form.Item name="fechaCorte" label="Fecha de corte (opcional, hoy por defecto)">
                        <DatePicker style={{ width: '100%', borderRadius: 14 }} format="YYYY-MM-DD" />
                    </Form.Item>

                    <Upload
                        accept=".xlsx,.xls"
                        maxCount={1}
                        beforeUpload={(file) => { setArchivoSaldo(file); setResultadoSaldo(null); return false }}
                        onRemove={() => setArchivoSaldo(undefined)}
                    >
                        <Button icon={<UploadOutlined />} style={{ borderRadius: 14 }}>Seleccionar archivo</Button>
                    </Upload>

                    {resultadoSaldo && (
                        <div style={{ marginTop: 16 }}>
                            <Alert
                                type={resultadoSaldo.numeroAsiento ? 'success' : 'warning'}
                                showIcon
                                message={resultadoSaldo.numeroAsiento
                                    ? `${resultadoSaldo.productosActualizados} productos actualizados — asiento ${resultadoSaldo.numeroAsiento} por $${resultadoSaldo.valorTotal.toLocaleString('es-CO')}`
                                    : 'No se generó ningún asiento (revisa los errores abajo)'}
                                description={resultadoSaldo.errores.length > 0
                                    ? `${resultadoSaldo.errores.length} fila(s) con error` : undefined}
                                style={{ borderRadius: 14 }}
                            />
                            {resultadoSaldo.errores.length > 0 && (
                                <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 8, fontSize: 12 }}>
                                    {resultadoSaldo.errores.map((e, i) => (
                                        <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${colors.border}`, color: colors.primary }}>
                                            Fila {e.fila}{e.sku ? ` (${e.sku})` : ''}: {e.motivo}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                        <Button onClick={cerrarModalSaldo}>Cerrar</Button>
                        <Button
                            type="primary" htmlType="submit" loading={cargandoSaldo}
                            style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                        >
                            Cargar saldo inicial
                        </Button>
                    </div>
                </Form>
            </Modal>
            <CrearProveedorModal
                open={modalProveedor}
                onClose={() => setModalProveedor(false)}
                onCreado={(p) => { setProveedores(prev => [...prev, p]); form.setFieldValue('proveedorId', p.proveedorId) }}
            />
        </div>
    )
}
