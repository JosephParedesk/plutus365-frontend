import { useState, useEffect, useMemo } from 'react'
import { Card, DatePicker, Spin, Empty, Table, Tag, Button, Input, Tooltip, Alert } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    BarChartOutlined, ArrowLeftOutlined, DownloadOutlined, SearchOutlined,
    LockOutlined, RightOutlined, FundOutlined, ShoppingOutlined, ShopOutlined, InboxOutlined, TeamOutlined, BankOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { colors } from '../../shared/theme/colors'
import { empresaService, type Empresa } from '../../shared/services/empresaService'
import { exportarExcel } from '../../shared/utils/exportarExcel'
import { ventaService, type Venta, cajaService, type CajaSesion, cotizacionService, type Cotizacion, recurrenteService, type FacturaRecurrente, PERIODICIDAD_LABEL } from '../../shared/services/ventaService'
import { compraService, type Compra, TIPOS_FUENTE } from '../../shared/services/compraService'
import { productoService, type Producto, movimientoService, type MovimientoInventario, TIPO_MOVIMIENTO_LABEL } from '../../shared/services/inventarioService'
import { nominaService, type Nomina, MESES, acumuladoInicialService, type AcumuladoInicial } from '../../shared/services/nominaService'
import { CATALOGO, type ReporteDef, type GrupoReportes } from './reportesCatalogo'

const { RangePicker } = DatePicker

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const num = (v: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(v)

const ICONO_GRUPO: Record<string, React.ReactNode> = {
    'estados-financieros': <FundOutlined />,
    ventas: <ShoppingOutlined />,
    compras: <ShopOutlined />,
    inventarios: <InboxOutlined />,
    nomina: <TeamOutlined />,
    tributaria: <BankOutlined />,
}
const COLOR_GRUPO: Record<string, { color: string; bg: string }> = {
    'estados-financieros': { color: colors.purple, bg: colors.purpleLight },
    ventas: { color: colors.primary, bg: colors.primaryLight },
    compras: { color: colors.orange, bg: colors.orangeLight },
    inventarios: { color: '#3B82F6', bg: '#EEF4FF' },
    nomina: { color: colors.red, bg: colors.redLight },
    tributaria: { color: '#0EA5A5', bg: '#E8FBFA' },
}

interface Fila { [k: string]: any }

export default function ReportesPage() {
    const navigate = useNavigate()
    const [seleccionado, setSeleccionado] = useState<ReporteDef | null>(null)
    const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
    const [busqueda, setBusqueda] = useState('')

    const [ventas, setVentas] = useState<Venta[]>([])
    const [compras, setCompras] = useState<Compra[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [cajas, setCajas] = useState<CajaSesion[]>([])
    const [nominas, setNominas] = useState<Nomina[]>([])
    const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([])
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
    const [recurrentes, setRecurrentes] = useState<FacturaRecurrente[]>([])
    const [acumIniciales, setAcumIniciales] = useState<AcumuladoInicial[]>([])
    const [loading, setLoading] = useState(false)
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    useEffect(() => { empresaService.obtener().then(({ data }) => setEmpresa(data)).catch(() => {}) }, [])

    const necesitaDatos = !!seleccionado && seleccionado.estado === 'DISPONIBLE' && !seleccionado.ruta

    useEffect(() => {
        if (!necesitaDatos) return
        setLoading(true)
        const fechaInicio = rango[0].format('YYYY-MM-DD')
        const fechaFin = rango[1].format('YYYY-MM-DD')
        Promise.allSettled([
            ventaService.filtrar({ fechaInicio, fechaFin }),
            compraService.filtrar({ fechaInicio, fechaFin }),
            productoService.listar(),
            cajaService.historial(),
            nominaService.listar(),
            movimientoService.porRango(fechaInicio, fechaFin),
            cotizacionService.filtrar(fechaInicio, fechaFin),
            recurrenteService.listar(),
            acumuladoInicialService.listar(dayjs(fechaFin).year()),
        ]).then(([rv, rc, rp, rk, rn, rm, rq, rr, ra]) => {
            setVentas(rv.status === 'fulfilled' ? rv.value.data.filter(v => v.estado === 'REGISTRADA') : [])
            setCompras(rc.status === 'fulfilled' ? rc.value.data : [])
            setProductos(rp.status === 'fulfilled' ? rp.value.data : [])
            setCajas(rk.status === 'fulfilled' ? rk.value.data : [])
            setNominas(rn.status === 'fulfilled' ? rn.value.data : [])
            setMovimientos(rm.status === 'fulfilled' ? rm.value.data : [])
            setCotizaciones(rq.status === 'fulfilled' ? rq.value.data : [])
            setRecurrentes(rr.status === 'fulfilled' ? rr.value.data : [])
            setAcumIniciales(ra.status === 'fulfilled' ? ra.value.data : [])
        }).finally(() => setLoading(false))
    }, [seleccionado, rango, necesitaDatos])

    // Compras que cuentan como gasto real (excluye recibos de pago y órdenes)
    const comprasFuente = useMemo(
        () => compras.filter(c => TIPOS_FUENTE.includes(c.tipoTransaccion) && c.estado !== 'ANULADA'),
        [compras]
    )

    const { columnas, filas, nota } = useMemo((): { columnas: any[]; filas: Fila[]; nota?: string } => {
        if (!seleccionado) return { columnas: [], filas: [] }
        const id = seleccionado.id

        const agrupar = <T,>(items: T[], clave: (i: T) => string, valor: (i: T) => number) => {
            const mapa = new Map<string, { n: number; total: number }>()
            items.forEach(i => {
                const k = clave(i) || 'Sin especificar'
                const a = mapa.get(k) || { n: 0, total: 0 }
                a.n += 1
                a.total += valor(i)
                mapa.set(k, a)
            })
            return Array.from(mapa.entries())
                .map(([nombre, v]) => ({ nombre, cantidad: v.n, total: v.total }))
                .sort((a, b) => b.total - a.total)
        }

        const colTotal = { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => cop.format(v) }

        switch (id) {
            case 'ventas-cliente':
                return {
                    columnas: [{ title: 'Cliente', dataIndex: 'nombre' }, { title: '# Ventas', dataIndex: 'cantidad', width: 100 }, colTotal],
                    filas: agrupar(ventas, v => v.clienteNombre || 'Consumidor final', v => v.total),
                }
            case 'ventas-vendedor':
                return {
                    columnas: [{ title: 'Vendedor', dataIndex: 'nombre' }, { title: '# Ventas', dataIndex: 'cantidad', width: 100 }, colTotal],
                    filas: agrupar(ventas, v => v.creadoPor || 'Sin identificar', v => v.total),
                    nota: 'El "vendedor" es el usuario que registró la venta en el sistema (campo Creado por).',
                }
            case 'ventas-producto':
            case 'ventas-comp-producto': {
                const mapa = new Map<string, { nombre: string; unidades: number; total: number }>()
                ventas.forEach(v => v.items?.forEach(it => {
                    const a = mapa.get(it.sku) || { nombre: it.nombreProducto, unidades: 0, total: 0 }
                    a.unidades += it.cantidad
                    a.total += it.valorTotal || it.cantidad * it.precioUnitario
                    mapa.set(it.sku, a)
                }))
                return {
                    columnas: [
                        { title: 'Producto', dataIndex: 'nombre' },
                        { title: 'Unidades', dataIndex: 'unidades', width: 110, render: (v: number) => num(v) },
                        colTotal,
                    ],
                    filas: Array.from(mapa.values()).sort((a, b) => b.total - a.total),
                }
            }
            case 'ventas-cliente-producto':
            case 'ventas-vendedor-producto': {
                const porVendedor = id === 'ventas-vendedor-producto'
                const mapa = new Map<string, { eje: string; producto: string; unidades: number; total: number }>()
                ventas.forEach(v => {
                    const eje = porVendedor ? (v.creadoPor || 'Sin identificar') : (v.clienteNombre || 'Consumidor final')
                    v.items?.forEach(it => {
                        const k = `${eje}||${it.sku}`
                        const a = mapa.get(k) || { eje, producto: it.nombreProducto, unidades: 0, total: 0 }
                        a.unidades += it.cantidad
                        a.total += it.valorTotal || it.cantidad * it.precioUnitario
                        mapa.set(k, a)
                    })
                })
                return {
                    columnas: [
                        { title: porVendedor ? 'Vendedor' : 'Cliente', dataIndex: 'eje' },
                        { title: 'Producto', dataIndex: 'producto' },
                        { title: 'Unidades', dataIndex: 'unidades', width: 110, render: (v: number) => num(v) },
                        colTotal,
                    ],
                    filas: Array.from(mapa.values()).sort((a, b) => a.eje.localeCompare(b.eje) || b.total - a.total),
                }
            }
            case 'ventas-comp-vendedor':
                return {
                    columnas: [
                        { title: 'Vendedor', dataIndex: 'nombre' },
                        { title: '# Ventas', dataIndex: 'cantidad', width: 100 },
                        colTotal,
                        {
                            title: 'Ticket promedio', dataIndex: 'promedio', align: 'right' as const,
                            render: (_: any, r: any) => cop.format(r.cantidad ? r.total / r.cantidad : 0)
                        },
                    ],
                    filas: agrupar(ventas, v => v.creadoPor || 'Sin identificar', v => v.total),
                }
            case 'ventas-mes':
            case 'compras-mes': {
                const esVenta = id === 'ventas-mes'
                const fuente: any[] = esVenta ? ventas : comprasFuente
                const mapa = new Map<string, { n: number; total: number }>()
                fuente.forEach(x => {
                    const fecha = esVenta ? x.fecha : x.fechaElaboracion
                    if (!fecha) return
                    const mes = dayjs(fecha).format('YYYY-MM')
                    const a = mapa.get(mes) || { n: 0, total: 0 }
                    a.n += 1
                    a.total += esVenta ? x.total : (x.totalPagar || 0)
                    mapa.set(mes, a)
                })
                return {
                    columnas: [
                        { title: 'Mes', dataIndex: 'nombre', render: (v: string) => dayjs(v + '-01').format('MMMM YYYY') },
                        { title: '# Documentos', dataIndex: 'cantidad', width: 130 },
                        colTotal,
                    ],
                    filas: Array.from(mapa.entries())
                        .map(([nombre, v]) => ({ nombre, cantidad: v.n, total: v.total }))
                        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
                }
            }
            case 'movimiento-ventas':
                return {
                    columnas: [
                        { title: 'Número', dataIndex: 'numero' },
                        { title: 'Fecha', dataIndex: 'fecha' },
                        { title: 'Cliente', dataIndex: 'cliente' },
                        { title: 'Vendedor', dataIndex: 'vendedor' },
                        { title: 'Subtotal', dataIndex: 'subtotal', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'IVA', dataIndex: 'iva', align: 'right' as const, render: (v: number) => cop.format(v) },
                        colTotal,
                    ],
                    filas: ventas.map(v => ({
                        numero: v.numeroVenta,
                        fecha: v.fecha ? dayjs(v.fecha).format('DD/MM/YYYY') : '',
                        cliente: v.clienteNombre || 'Consumidor final',
                        vendedor: v.creadoPor || '',
                        subtotal: v.subtotal,
                        iva: v.totalIva || 0,
                        total: v.total,
                    })),
                }
            case 'recibos-caja':
                return {
                    columnas: [
                        { title: 'Apertura', dataIndex: 'apertura' },
                        { title: 'Cierre', dataIndex: 'cierre' },
                        { title: 'Responsable', dataIndex: 'responsable' },
                        { title: 'Base', dataIndex: 'base', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Ventas efectivo', dataIndex: 'efectivo', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Esperado', dataIndex: 'esperado', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Contado', dataIndex: 'contado', align: 'right' as const, render: (v: number) => cop.format(v) },
                        {
                            title: 'Diferencia', dataIndex: 'diferencia', align: 'right' as const,
                            render: (v: number) => v === 0
                                ? <Tag color="green">Cuadra</Tag>
                                : <Tag color={v > 0 ? 'blue' : 'red'}>{cop.format(v)}</Tag>
                        },
                    ],
                    filas: cajas.map(c => ({
                        apertura: dayjs(c.fechaApertura).format('DD/MM/YYYY HH:mm'),
                        cierre: c.fechaCierre ? dayjs(c.fechaCierre).format('DD/MM/YYYY HH:mm') : 'Abierta',
                        responsable: c.usuarioCierre || c.usuarioApertura || '',
                        base: c.montoApertura,
                        efectivo: c.totalVentasEfectivo || 0,
                        esperado: c.montoCierreCalculado || 0,
                        contado: c.montoCierreDeclarado || 0,
                        diferencia: c.diferencia || 0,
                    })),
                    nota: 'Muestra todos los turnos de caja registrados, sin filtrar por el rango de fechas de arriba.',
                }

            case 'compras-proveedor':
                return {
                    columnas: [{ title: 'Proveedor', dataIndex: 'nombre' }, { title: '# Compras', dataIndex: 'cantidad', width: 110 }, colTotal],
                    filas: agrupar(comprasFuente, c => c.proveedorNombre || `Proveedor #${c.proveedorId}`, c => c.totalPagar || 0),
                }
            case 'compras-comprador':
                return {
                    columnas: [{ title: 'Comprador', dataIndex: 'nombre' }, { title: '# Compras', dataIndex: 'cantidad', width: 110 }, colTotal],
                    filas: agrupar(comprasFuente, c => c.creadoPor || 'Sin identificar', c => c.totalPagar || 0),
                }
            case 'compras-producto':
            case 'compras-comp-producto': {
                const mapa = new Map<string, { nombre: string; unidades: number; total: number }>()
                comprasFuente.forEach(c => c.items?.forEach(it => {
                    const k = it.productoSku || it.descripcion
                    const a = mapa.get(k) || { nombre: it.descripcion, unidades: 0, total: 0 }
                    a.unidades += it.cantidad || 0
                    a.total += it.valorTotal || 0
                    mapa.set(k, a)
                }))
                return {
                    columnas: [
                        { title: 'Producto / concepto', dataIndex: 'nombre' },
                        { title: 'Unidades', dataIndex: 'unidades', width: 110, render: (v: number) => num(v) },
                        colTotal,
                    ],
                    filas: Array.from(mapa.values()).sort((a, b) => b.total - a.total),
                }
            }
            case 'compras-proveedor-producto': {
                const mapa = new Map<string, { eje: string; producto: string; unidades: number; total: number }>()
                comprasFuente.forEach(c => {
                    const eje = c.proveedorNombre || `Proveedor #${c.proveedorId}`
                    c.items?.forEach(it => {
                        const k = `${eje}||${it.productoSku || it.descripcion}`
                        const a = mapa.get(k) || { eje, producto: it.descripcion, unidades: 0, total: 0 }
                        a.unidades += it.cantidad || 0
                        a.total += it.valorTotal || 0
                        mapa.set(k, a)
                    })
                })
                return {
                    columnas: [
                        { title: 'Proveedor', dataIndex: 'eje' },
                        { title: 'Producto', dataIndex: 'producto' },
                        { title: 'Unidades', dataIndex: 'unidades', width: 110, render: (v: number) => num(v) },
                        colTotal,
                    ],
                    filas: Array.from(mapa.values()).sort((a, b) => a.eje.localeCompare(b.eje) || b.total - a.total),
                }
            }
            case 'movimiento-compras':
                return {
                    columnas: [
                        { title: 'Comprobante', dataIndex: 'numero' },
                        { title: 'Tipo', dataIndex: 'tipo' },
                        { title: 'Fecha', dataIndex: 'fecha' },
                        { title: 'Proveedor', dataIndex: 'proveedor' },
                        { title: 'Factura prov.', dataIndex: 'factura' },
                        { title: 'IVA', dataIndex: 'iva', align: 'right' as const, render: (v: number) => cop.format(v) },
                        colTotal,
                    ],
                    filas: comprasFuente.map(c => ({
                        numero: c.numeroComprobante || '',
                        tipo: c.tipoTransaccion,
                        fecha: c.fechaElaboracion ? dayjs(c.fechaElaboracion).format('DD/MM/YYYY') : '',
                        proveedor: c.proveedorNombre || '',
                        factura: c.facturaProveedor || '',
                        iva: c.totalIva || 0,
                        total: c.totalPagar || 0,
                    })),
                }
            case 'notas-compra':
                return {
                    columnas: [
                        { title: 'Comprobante', dataIndex: 'numero' },
                        { title: 'Tipo', dataIndex: 'tipo' },
                        { title: 'Fecha', dataIndex: 'fecha' },
                        { title: 'Proveedor', dataIndex: 'proveedor' },
                        colTotal,
                    ],
                    filas: compras
                        .filter(c => ['NOTA_DEBITO', 'AJUSTE_CARTERA'].includes(c.tipoTransaccion) && c.estado !== 'ANULADA')
                        .map(c => ({
                            numero: c.numeroComprobante || '',
                            tipo: c.tipoTransaccion,
                            fecha: c.fechaElaboracion ? dayjs(c.fechaElaboracion).format('DD/MM/YYYY') : '',
                            proveedor: c.proveedorNombre || '',
                            total: c.totalPagar || 0,
                        })),
                }
            case 'cartera-proveedores':
                return {
                    columnas: [
                        { title: 'Comprobante', dataIndex: 'numero' },
                        { title: 'Proveedor', dataIndex: 'proveedor' },
                        { title: 'Fecha', dataIndex: 'fecha' },
                        { title: 'Vence', dataIndex: 'vence' },
                        { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: (v: number) => cop.format(v) },
                        {
                            title: 'Total', dataIndex: 'total', align: 'right' as const,
                            render: (v: number) => <strong style={{ color: colors.red }}>{cop.format(v)}</strong>
                        },
                    ],
                    filas: compras
                        .filter(c => (c.saldoPendiente || 0) > 0 && c.estado !== 'ANULADA')
                        .map(c => ({
                            numero: c.numeroComprobante || '',
                            proveedor: c.proveedorNombre || '',
                            fecha: c.fechaElaboracion ? dayjs(c.fechaElaboracion).format('DD/MM/YYYY') : '',
                            vence: c.fechaVencimientoCredito ? dayjs(c.fechaVencimientoCredito).format('DD/MM/YYYY') : '',
                            valor: c.totalPagar || 0,
                            total: c.saldoPendiente || 0,
                        })),
                    nota: 'La última columna es el saldo que aún le debes al proveedor. Muestra todas las compras con saldo, sin filtrar por fechas.',
                }
            case 'ordenes-compra':
                return {
                    columnas: [
                        { title: 'Comprobante', dataIndex: 'numero' },
                        { title: 'Fecha', dataIndex: 'fecha' },
                        { title: 'Proveedor', dataIndex: 'proveedor' },
                        { title: 'Estado', dataIndex: 'estado', render: (v: string) => <Tag>{v}</Tag> },
                        colTotal,
                    ],
                    filas: compras
                        .filter(c => c.tipoTransaccion === 'ORDEN_COMPRA')
                        .map(c => ({
                            numero: c.numeroComprobante || '',
                            fecha: c.fechaElaboracion ? dayjs(c.fechaElaboracion).format('DD/MM/YYYY') : '',
                            proveedor: c.proveedorNombre || '',
                            estado: c.estado || '',
                            total: c.totalPagar || 0,
                        })),
                }

            case 'saldos-inventario':
            case 'saldos-producto':
                return {
                    columnas: [
                        { title: 'SKU', dataIndex: 'sku', width: 130 },
                        { title: 'Producto', dataIndex: 'nombre' },
                        { title: 'Categoría', dataIndex: 'categoria' },
                        { title: 'Existencias', dataIndex: 'stock', align: 'right' as const, render: (v: number) => num(v) },
                        { title: 'Unidad', dataIndex: 'unidad', width: 90 },
                        { title: 'Costo unit.', dataIndex: 'costo', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                    ],
                    filas: productos
                        .map(p => ({
                            sku: p.sku, nombre: p.nombre, categoria: p.categoriaNombre || '',
                            stock: p.stock, unidad: p.unidad, costo: p.precioCompra,
                            total: p.stock * p.precioCompra,
                        }))
                        .sort((a, b) => b.total - a.total),
                    nota: 'Valorizado al costo de compra más reciente de cada producto.',
                }
            case 'listado-productos':
                return {
                    columnas: [
                        { title: 'SKU', dataIndex: 'sku', width: 130 },
                        { title: 'Producto', dataIndex: 'nombre' },
                        { title: 'Categoría', dataIndex: 'categoria' },
                        { title: 'Proveedor', dataIndex: 'proveedor' },
                        { title: 'Costo', dataIndex: 'costo', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Precio venta', dataIndex: 'venta', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Estado', dataIndex: 'estado', render: (v: string) => <Tag color={v === 'Activo' ? 'green' : 'default'}>{v}</Tag> },
                    ],
                    filas: productos.map(p => ({
                        sku: p.sku, nombre: p.nombre,
                        categoria: p.categoriaNombre || '', proveedor: p.proveedorNombre || '',
                        costo: p.precioCompra, venta: p.precioVenta,
                        estado: p.activo ? 'Activo' : 'Inactivo',
                    })),
                }
            case 'stock-bajo':
                return {
                    columnas: [
                        { title: 'SKU', dataIndex: 'sku', width: 130 },
                        { title: 'Producto', dataIndex: 'nombre' },
                        { title: 'Existencias', dataIndex: 'stock', align: 'right' as const, render: (v: number) => num(v) },
                        { title: 'Stock mínimo', dataIndex: 'minimo', align: 'right' as const },
                        {
                            title: 'Situación', dataIndex: 'situacion',
                            render: (v: string) => <Tag color={v === 'Agotado' ? 'red' : 'orange'}>{v}</Tag>
                        },
                    ],
                    filas: productos
                        .filter(p => p.stock <= p.stockMinimo)
                        .map(p => ({
                            sku: p.sku, nombre: p.nombre, stock: p.stock, minimo: p.stockMinimo,
                            situacion: p.stock <= 0 ? 'Agotado' : 'Stock bajo',
                        }))
                        .sort((a, b) => a.stock - b.stock),
                }
            // ── NÓMINA ──
            // Se trabaja sobre las nóminas liquidadas o pagadas del rango de fechas
            // (se ignoran las anuladas y los borradores).
            case 'nom-consolidado':
            case 'nom-detallada-concepto':
            case 'nom-seguridad-social':
            case 'nom-parafiscales':
            case 'nom-arl':
            case 'nom-provisiones':
            case 'nom-prima':
            case 'nom-acumulados-general':
            case 'nom-acumulados-detalle':
            case 'nom-pagos-empresa':
            case 'nom-periodos': {
                const validas = nominas.filter(n => {
                    if (n.estado === 'ANULADA' || n.estado === 'BORRADOR') return false
                    const fin = dayjs(n.fechaFin)
                    return !fin.isBefore(rango[0], 'day') && !fin.isAfter(rango[1], 'day')
                })

                if (id === 'nom-periodos') {
                    return {
                        columnas: [
                            { title: 'Número', dataIndex: 'numero' },
                            { title: 'Período', dataIndex: 'periodo' },
                            { title: 'Empleados', dataIndex: 'empleados', align: 'right' as const },
                            { title: 'Devengado', dataIndex: 'devengado', align: 'right' as const, render: (v: number) => cop.format(v) },
                            { title: 'Deducciones', dataIndex: 'deducciones', align: 'right' as const, render: (v: number) => cop.format(v) },
                            { title: 'Neto pagado', dataIndex: 'neto', align: 'right' as const, render: (v: number) => cop.format(v) },
                            { title: 'Estado', dataIndex: 'estado', render: (v: string) => <Tag>{v}</Tag> },
                            { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                        ],
                        filas: validas.map(n => ({
                            numero: n.numero,
                            periodo: `${MESES[n.mes - 1]} ${n.anio}`,
                            empleados: n.detalles?.length || 0,
                            devengado: n.totalDevengado,
                            deducciones: n.totalDeducciones,
                            neto: n.totalNeto,
                            estado: n.estado,
                            total: n.costoTotalEmpresa,
                        })),
                        nota: 'La columna Total es el costo real para la empresa: neto + aportes patronales + provisiones.',
                    }
                }

                // Acumulado por empleado a lo largo de todos los períodos del rango
                const porEmpleado = new Map<string, any>()
                validas.forEach(n => n.detalles?.forEach(d => {
                    const k = String(d.empleadoId)
                    const a = porEmpleado.get(k) || {
                        documento: d.numeroDocumento, empleado: d.nombreEmpleado, cargo: d.cargo || '',
                        periodos: 0, dias: 0,
                        sueldo: 0, auxilio: 0, extras: 0, comisiones: 0, bonificaciones: 0, devengado: 0, ibc: 0,
                        salud: 0, pension: 0, fsp: 0, retefuente: 0, prestamos: 0, deducciones: 0, neto: 0,
                        saludEmp: 0, pensionEmp: 0, arl: 0, sena: 0, icbf: 0, caja: 0, aportes: 0,
                        cesantias: 0, intCesantias: 0, prima: 0, vacaciones: 0, provisiones: 0, costo: 0,
                        exonerado: d.exonerado,
                    }
                    a.periodos += 1
                    a.dias += d.diasTrabajados || 0
                    a.sueldo += d.sueldo || 0
                    a.auxilio += d.auxilioTransporte || 0
                    a.extras += (d.horasExtra || []).reduce((s, i) => s + (i.valor || 0), 0)
                    a.comisiones += d.comisiones || 0
                    a.bonificaciones += d.bonificaciones || 0
                    a.devengado += d.totalDevengado || 0
                    a.ibc += d.ibc || 0
                    a.salud += d.saludEmpleado || 0
                    a.pension += d.pensionEmpleado || 0
                    a.fsp += d.fondoSolidaridad || 0
                    a.retefuente += d.retencionFuente || 0
                    a.prestamos += d.prestamos || 0
                    a.deducciones += d.totalDeducciones || 0
                    a.neto += d.netoPagar || 0
                    a.saludEmp += d.saludEmpleador || 0
                    a.pensionEmp += d.pensionEmpleador || 0
                    a.arl += d.arl || 0
                    a.sena += d.sena || 0
                    a.icbf += d.icbf || 0
                    a.caja += d.cajaCompensacion || 0
                    a.aportes += d.totalAportesEmpleador || 0
                    a.cesantias += d.provCesantias || 0
                    a.intCesantias += d.provInteresesCesantias || 0
                    a.prima += d.provPrima || 0
                    a.vacaciones += d.provVacaciones || 0
                    a.provisiones += d.totalProvisiones || 0
                    a.costo += d.costoTotal || 0
                    porEmpleado.set(k, a)
                }))
                const acum = Array.from(porEmpleado.values()).sort((a, b) => a.empleado.localeCompare(b.empleado))

                const colEmpleado = [
                    { title: 'Documento', dataIndex: 'documento', width: 120 },
                    { title: 'Empleado', dataIndex: 'empleado' },
                ]

                switch (id) {
                    case 'nom-consolidado':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'Devengado', dataIndex: 'devengado', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Deducciones', dataIndex: 'deducciones', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong style={{ color: colors.primary }}>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, total: a.neto })),
                            nota: 'La columna Total es el neto pagado al empleado (devengado menos deducciones).',
                        }
                    case 'nom-detallada-concepto':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'Días', dataIndex: 'dias', align: 'right' as const },
                                { title: 'Sueldo', dataIndex: 'sueldo', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Aux. transporte', dataIndex: 'auxilio', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Extras y recargos', dataIndex: 'extras', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Comisiones', dataIndex: 'comisiones', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Bonificaciones', dataIndex: 'bonificaciones', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Salud', dataIndex: 'salud', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Pensión', dataIndex: 'pension', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'FSP', dataIndex: 'fsp', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Retefuente', dataIndex: 'retefuente', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, total: a.neto })),
                        }
                    case 'nom-seguridad-social':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'IBC acumulado', dataIndex: 'ibc', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Salud empleado 4%', dataIndex: 'salud', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Salud empresa 8,5%', dataIndex: 'saludEmp', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Pensión empleado 4%', dataIndex: 'pension', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Pensión empresa 12%', dataIndex: 'pensionEmp', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'FSP', dataIndex: 'fsp', align: 'right' as const, render: (v: number) => cop.format(v) },
                                {
                                    title: 'Exonerado', dataIndex: 'exonerado', width: 100,
                                    render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Sí' : 'No'}</Tag>
                                },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, total: a.salud + a.saludEmp + a.pension + a.pensionEmp + a.fsp })),
                            nota: 'Exonerado = Ley 1607/2012: por empleados que ganan menos de 10 SMMLV la empresa no aporta salud 8,5%, SENA ni ICBF.',
                        }
                    case 'nom-parafiscales':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'IBC acumulado', dataIndex: 'ibc', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'SENA 2%', dataIndex: 'sena', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'ICBF 3%', dataIndex: 'icbf', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Caja compensación 4%', dataIndex: 'caja', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, total: a.sena + a.icbf + a.caja })),
                            nota: 'La caja de compensación (4%) se paga siempre; SENA e ICBF se exoneran bajo 10 SMMLV.',
                        }
                    case 'nom-arl':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'Cargo', dataIndex: 'cargo' },
                                { title: 'IBC acumulado', dataIndex: 'ibc', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, total: a.arl })),
                            nota: 'La tarifa depende del nivel de riesgo I a V configurado en la ficha de cada empleado (Decreto 1772/1994).',
                        }
                    case 'nom-provisiones':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'Cesantías 8,33%', dataIndex: 'cesantias', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Int. cesantías 12%', dataIndex: 'intCesantias', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Prima 8,33%', dataIndex: 'prima', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Vacaciones 4,17%', dataIndex: 'vacaciones', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, total: a.provisiones })),
                        }
                    case 'nom-prima':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'Períodos', dataIndex: 'periodos', align: 'right' as const, width: 90 },
                                { title: 'Días acumulados', dataIndex: 'dias', align: 'right' as const },
                                { title: 'Base (sueldo + auxilio)', dataIndex: 'base', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong style={{ color: colors.primary }}>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, base: a.sueldo + a.auxilio, total: a.prima })),
                            nota: 'Prima causada en el rango seleccionado. Recuerda que legalmente se paga en dos contados: máximo 30 de junio y 20 de diciembre. La base sí incluye el auxilio de transporte.',
                        }
                    case 'nom-acumulados-general':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'Períodos', dataIndex: 'periodos', align: 'right' as const, width: 90 },
                                { title: 'Devengado', dataIndex: 'devengado', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Deducciones', dataIndex: 'deducciones', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Neto', dataIndex: 'neto', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Aportes empresa', dataIndex: 'aportes', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Provisiones', dataIndex: 'provisiones', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong style={{ color: colors.orange }}>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, total: a.costo })),
                            nota: 'La columna Total es el costo real de cada empleado para la empresa.',
                        }
                    case 'nom-acumulados-detalle':
                        return {
                            columnas: [
                                ...colEmpleado,
                                { title: 'Sueldo', dataIndex: 'sueldo', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Auxilio', dataIndex: 'auxilio', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Extras', dataIndex: 'extras', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Salud', dataIndex: 'salud', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Pensión', dataIndex: 'pension', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Retefuente', dataIndex: 'retefuente', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Cesantías', dataIndex: 'cesantias', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Prima', dataIndex: 'prima', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Vacaciones', dataIndex: 'vacaciones', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'ARL', dataIndex: 'arl', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                            ],
                            filas: acum.map(a => ({ ...a, total: a.costo })),
                        }
                    default: { // nom-pagos-empresa
                        const t = acum.reduce((s, a) => ({
                            neto: s.neto + a.neto, salud: s.salud + a.saludEmp, pension: s.pension + a.pensionEmp,
                            arl: s.arl + a.arl, sena: s.sena + a.sena, icbf: s.icbf + a.icbf, caja: s.caja + a.caja,
                            cesantias: s.cesantias + a.cesantias, intCes: s.intCes + a.intCesantias,
                            prima: s.prima + a.prima, vac: s.vac + a.vacaciones,
                            retefuente: s.retefuente + a.retefuente,
                            saludEmpleado: s.saludEmpleado + a.salud, pensionEmpleado: s.pensionEmpleado + a.pension,
                        }), {
                            neto: 0, salud: 0, pension: 0, arl: 0, sena: 0, icbf: 0, caja: 0,
                            cesantias: 0, intCes: 0, prima: 0, vac: 0, retefuente: 0, saludEmpleado: 0, pensionEmpleado: 0,
                        })
                        return {
                            columnas: [
                                { title: 'Concepto', dataIndex: 'concepto' },
                                { title: 'Destinatario', dataIndex: 'destino' },
                                { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => cop.format(v) },
                            ],
                            filas: [
                                { concepto: 'Neto pagado a empleados', destino: 'Empleados', total: t.neto },
                                { concepto: 'Aportes salud (empleado + empresa)', destino: 'EPS', total: t.saludEmpleado + t.salud },
                                { concepto: 'Aportes pensión (empleado + empresa)', destino: 'Fondo de pensiones', total: t.pensionEmpleado + t.pension },
                                { concepto: 'Aportes ARL', destino: 'ARL', total: t.arl },
                                { concepto: 'Aporte SENA', destino: 'SENA', total: t.sena },
                                { concepto: 'Aporte ICBF', destino: 'ICBF', total: t.icbf },
                                { concepto: 'Caja de compensación', destino: 'Caja de compensación', total: t.caja },
                                { concepto: 'Retención en la fuente', destino: 'DIAN', total: t.retefuente },
                                { concepto: 'Provisión cesantías', destino: 'Fondo de cesantías', total: t.cesantias },
                                { concepto: 'Provisión intereses cesantías', destino: 'Empleados', total: t.intCes },
                                { concepto: 'Provisión prima', destino: 'Empleados', total: t.prima },
                                { concepto: 'Provisión vacaciones', destino: 'Empleados', total: t.vac },
                            ].filter(f => f.total > 0),
                            nota: 'Resumen de a quién le debe pagar la empresa por la nómina del período. Las provisiones son causaciones, no necesariamente desembolsos del mes.',
                        }
                    }
                }
            }

            case 'ventas-centro-costo':
                return {
                    columnas: [{ title: 'Centro de costo', dataIndex: 'nombre' }, { title: '# Ventas', dataIndex: 'cantidad', width: 100 }, colTotal],
                    filas: agrupar(ventas, v => v.centroCostoNombre || 'Sin centro de costo', v => v.total),
                    nota: 'Las ventas registradas antes de crear tus centros de costo aparecen agrupadas como "Sin centro de costo".',
                }
            case 'compras-centro-costo':
                return {
                    columnas: [{ title: 'Centro de costo', dataIndex: 'nombre' }, { title: '# Compras', dataIndex: 'cantidad', width: 110 }, colTotal],
                    filas: agrupar(comprasFuente, c => c.centroCostoNombre || 'Sin centro de costo', c => c.totalPagar || 0),
                }
            case 'obsequios': {
                const obsequios = ventas.filter(v => v.esObsequio)
                return {
                    columnas: [
                        { title: 'Número', dataIndex: 'numero' },
                        { title: 'Fecha', dataIndex: 'fecha' },
                        { title: 'Cliente', dataIndex: 'cliente' },
                        { title: 'Entregado por', dataIndex: 'vendedor' },
                        { title: 'Centro de costo', dataIndex: 'centro' },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => cop.format(v) },
                    ],
                    filas: obsequios.map(v => ({
                        numero: v.numeroVenta,
                        fecha: v.fecha ? dayjs(v.fecha).format('DD/MM/YYYY') : '',
                        cliente: v.clienteNombre || 'Consumidor final',
                        vendedor: v.creadoPor || '',
                        centro: v.centroCostoNombre || '',
                        total: v.total,
                    })),
                    nota: 'Salidas de mercancía entregadas sin cobro (muestras, cortesías). Contablemente son un gasto, no un ingreso — revisa con tu contador el tratamiento del IVA, que normalmente sí se causa.',
                }
            }

            case 'cotizaciones': {
                const porVendedor = new Map<string, any>()
                cotizaciones.forEach(q => {
                    const k = q.creadoPor || 'Sin identificar'
                    const a = porVendedor.get(k) || {
                        nombre: k, emitidas: 0, aprobadas: 0, convertidas: 0, rechazadas: 0,
                        valorEmitido: 0, total: 0,
                    }
                    a.emitidas += 1
                    a.valorEmitido += q.total || 0
                    if (q.estado === 'APROBADA') a.aprobadas += 1
                    if (q.estado === 'CONVERTIDA') { a.convertidas += 1; a.total += q.total || 0 }
                    if (q.estado === 'RECHAZADA') a.rechazadas += 1
                    porVendedor.set(k, a)
                })
                return {
                    columnas: [
                        { title: 'Vendedor', dataIndex: 'nombre' },
                        { title: 'Emitidas', dataIndex: 'emitidas', align: 'right' as const, width: 90 },
                        { title: 'Aprobadas', dataIndex: 'aprobadas', align: 'right' as const, width: 100 },
                        { title: 'Convertidas', dataIndex: 'convertidas', align: 'right' as const, width: 110 },
                        { title: 'Rechazadas', dataIndex: 'rechazadas', align: 'right' as const, width: 110 },
                        {
                            title: 'Efectividad', dataIndex: 'efectividad', align: 'right' as const, width: 110,
                            render: (_: any, r: any) => r.emitidas
                                ? <Tag color={r.convertidas / r.emitidas >= 0.5 ? 'green' : 'orange'}>
                                    {Math.round((r.convertidas / r.emitidas) * 100)}%
                                </Tag>
                                : '—'
                        },
                        { title: 'Valor cotizado', dataIndex: 'valorEmitido', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong style={{ color: colors.primary }}>{cop.format(v)}</strong> },
                    ],
                    filas: Array.from(porVendedor.values()).sort((a, b) => b.total - a.total),
                    nota: 'La columna Total es el valor efectivamente convertido en venta. Efectividad = cotizaciones convertidas / cotizaciones emitidas.',
                }
            }

            case 'recurrentes':
                return {
                    columnas: [
                        { title: 'Nombre', dataIndex: 'nombre' },
                        { title: 'Cliente', dataIndex: 'cliente' },
                        { title: 'Periodicidad', dataIndex: 'periodicidad' },
                        { title: 'Próxima', dataIndex: 'proxima' },
                        { title: 'Última', dataIndex: 'ultima' },
                        { title: 'Veces', dataIndex: 'veces', align: 'right' as const, width: 80 },
                        {
                            title: 'Estado', dataIndex: 'estado',
                            render: (v: string) => <Tag color={v === 'Activa' ? 'green' : v === 'Pendiente' ? 'orange' : 'default'}>{v}</Tag>
                        },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                    ],
                    filas: recurrentes.map(r => {
                        const pendiente = r.activa && r.proximaGeneracion
                            && !dayjs(r.proximaGeneracion).isAfter(dayjs(), 'day')
                        return {
                            nombre: r.nombre,
                            cliente: r.clienteNombre || 'Sin cliente',
                            periodicidad: PERIODICIDAD_LABEL[r.periodicidad] || r.periodicidad,
                            proxima: r.proximaGeneracion ? dayjs(r.proximaGeneracion).format('DD/MM/YYYY') : '—',
                            ultima: r.ultimaGeneracion ? dayjs(r.ultimaGeneracion).format('DD/MM/YYYY') : 'Nunca',
                            veces: r.vecesGeneradas || 0,
                            estado: !r.activa ? 'Pausada' : pendiente ? 'Pendiente' : 'Activa',
                            total: (r.total || 0) * (r.vecesGeneradas || 0),
                        }
                    }),
                    nota: 'La columna Total es lo facturado históricamente por cada recurrencia (valor × veces generadas). "Pendiente" = ya cumplió su fecha y espera que la generes.',
                }

            case 'nom-acumulados-iniciales':
                return {
                    columnas: [
                        { title: 'Empleado', dataIndex: 'empleado' },
                        { title: 'Corte', dataIndex: 'corte' },
                        { title: 'Cesantías', dataIndex: 'cesantias', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Int. cesantías', dataIndex: 'intereses', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Prima', dataIndex: 'prima', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Vacaciones', dataIndex: 'vacaciones', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Días vac.', dataIndex: 'diasVac', align: 'right' as const, width: 90 },
                        { title: 'Sueldo año', dataIndex: 'sueldo', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                    ],
                    filas: acumIniciales.map(a => ({
                        empleado: a.nombreEmpleado || '',
                        corte: a.fechaCorte ? dayjs(a.fechaCorte).format('DD/MM/YYYY') : '—',
                        cesantias: a.cesantiasAcumuladas || 0,
                        intereses: a.interesesCesantiasAcumulados || 0,
                        prima: a.primaAcumulada || 0,
                        vacaciones: a.vacacionesAcumuladas || 0,
                        diasVac: a.diasVacacionesPendientes || 0,
                        sueldo: a.sueldoAcumulado || 0,
                        total: (a.cesantiasAcumuladas || 0) + (a.interesesCesantiasAcumulados || 0)
                            + (a.primaAcumulada || 0) + (a.vacacionesAcumuladas || 0),
                    })),
                    nota: 'Saldos traídos de tu sistema anterior. La columna Total es el pasivo prestacional acumulado (cesantías + intereses + prima + vacaciones). Corresponde al año del final del rango de fechas.',
                }

            // ── TRIBUTARIA ──
            case 'trib-iva': {
                // IVA generado en ventas menos IVA descontable en compras = saldo del período.
                const ivaGenerado = ventas.reduce((s, v) => s + (v.totalIva || 0), 0)
                const baseVentas = ventas.reduce((s, v) => s + (v.subtotal || 0) - (v.descuentoTotal || 0), 0)
                const ivaDescontable = comprasFuente.reduce((s, c) => s + (c.totalIva || 0), 0)
                const baseCompras = comprasFuente.reduce((s, c) => s + ((c.totalPagar || 0) - (c.totalIva || 0)), 0)
                const saldo = ivaGenerado - ivaDescontable
                return {
                    columnas: [
                        { title: 'Concepto', dataIndex: 'concepto' },
                        { title: 'Base gravable', dataIndex: 'base', align: 'right' as const, render: (v: number) => v ? cop.format(v) : '' },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                    ],
                    filas: [
                        { concepto: 'IVA generado (ventas del período)', base: baseVentas, total: ivaGenerado },
                        { concepto: 'IVA descontable (compras del período)', base: baseCompras, total: -ivaDescontable },
                        {
                            concepto: saldo >= 0 ? 'Saldo a pagar a la DIAN' : 'Saldo a favor',
                            base: 0, total: Math.abs(saldo),
                        },
                    ],
                    nota: 'Cifras contables del período seleccionado, no una declaración. El IVA se declara bimestral o cuatrimestralmente según tus ingresos del año anterior — verifica tu periodicidad y el calendario tributario con tu contador antes de presentar.',
                }
            }

            case 'trib-retenciones': {
                // Las retenciones practicadas viven en los ítems de compra (impuestoRetencion).
                const mapa = new Map<string, { concepto: string; base: number; total: number }>()
                comprasFuente.forEach(c => {
                    const retDoc = c.totalRetencion || 0
                    if (retDoc <= 0) return
                    const etiqueta = c.items?.find(i => i.impuestoRetencion && i.impuestoRetencion !== 'Sin retención')?.impuestoRetencion
                        || 'Retención practicada'
                    const a = mapa.get(etiqueta) || { concepto: etiqueta, base: 0, total: 0 }
                    a.base += (c.totalPagar || 0) - (c.totalIva || 0)
                    a.total += retDoc
                    mapa.set(etiqueta, a)
                })
                return {
                    columnas: [
                        { title: 'Concepto de retención', dataIndex: 'concepto' },
                        { title: 'Base', dataIndex: 'base', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                    ],
                    filas: Array.from(mapa.values()).sort((a, b) => b.total - a.total),
                    nota: 'Retenciones que TÚ practicaste a tus proveedores y debes consignarle a la DIAN. Solo aparecen si marcaste el concepto de retención en los ítems de la compra.',
                }
            }

            case 'libro-ventas':
                return {
                    columnas: [
                        { title: 'Fecha', dataIndex: 'fecha', width: 105 },
                        { title: 'Documento', dataIndex: 'documento' },
                        { title: 'Cliente', dataIndex: 'cliente' },
                        { title: 'Identificación', dataIndex: 'nit' },
                        { title: 'Base gravable', dataIndex: 'base', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'IVA', dataIndex: 'iva', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                    ],
                    filas: ventas
                        .slice()
                        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
                        .map(v => ({
                            fecha: v.fecha ? dayjs(v.fecha).format('DD/MM/YYYY') : '',
                            documento: v.numeroVenta,
                            cliente: v.clienteNombre || 'Consumidor final',
                            nit: '',
                            base: (v.subtotal || 0) - (v.descuentoTotal || 0),
                            iva: v.totalIva || 0,
                            total: v.total,
                        })),
                    nota: 'Registro cronológico de las ventas del período. La columna de identificación queda vacía porque la venta guarda el nombre del cliente pero no su documento; para el libro formal, cruza con el módulo de Clientes.',
                }

            case 'libro-compras':
                return {
                    columnas: [
                        { title: 'Fecha', dataIndex: 'fecha', width: 105 },
                        { title: 'Comprobante', dataIndex: 'documento' },
                        { title: 'Factura proveedor', dataIndex: 'facturaProv' },
                        { title: 'Proveedor', dataIndex: 'proveedor' },
                        { title: 'Base gravable', dataIndex: 'base', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'IVA', dataIndex: 'iva', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Retención', dataIndex: 'retencion', align: 'right' as const, render: (v: number) => cop.format(v) },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                    ],
                    filas: comprasFuente
                        .slice()
                        .sort((a, b) => (a.fechaElaboracion || '').localeCompare(b.fechaElaboracion || ''))
                        .map(c => ({
                            fecha: c.fechaElaboracion ? dayjs(c.fechaElaboracion).format('DD/MM/YYYY') : '',
                            documento: c.numeroComprobante || '',
                            facturaProv: c.facturaProveedor || '',
                            proveedor: c.proveedorNombre || '',
                            base: (c.totalPagar || 0) - (c.totalIva || 0),
                            iva: c.totalIva || 0,
                            retencion: c.totalRetencion || 0,
                            total: c.totalPagar || 0,
                        })),
                    nota: 'Registro cronológico de las compras y gastos del período, con el número de factura del proveedor para soportar el IVA descontable.',
                }

            case 'trib-renta-base': {
                const ingresos = ventas.reduce((s, v) => s + ((v.subtotal || 0) - (v.descuentoTotal || 0)), 0)
                const costosGastos = comprasFuente.reduce((s, c) => s + ((c.totalPagar || 0) - (c.totalIva || 0)), 0)
                const utilidad = ingresos - costosGastos
                return {
                    columnas: [
                        { title: 'Concepto', dataIndex: 'concepto' },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
                    ],
                    filas: [
                        { concepto: 'Ingresos por ventas (sin IVA)', total: ingresos },
                        { concepto: 'Costos y gastos (sin IVA)', total: -costosGastos },
                        { concepto: utilidad >= 0 ? 'Utilidad contable antes de impuestos' : 'Pérdida contable', total: Math.abs(utilidad) },
                    ],
                    nota: 'Esto es la BASE CONTABLE, no el impuesto de renta. La renta fiscal exige depurar gastos no deducibles, renta presuntiva, descuentos y anticipos — entrégale este reporte a tu contador, no lo uses para declarar directamente.',
                }
            }

            case 'kardex':
                return {
                    columnas: [
                        { title: 'Fecha', dataIndex: 'fecha', width: 145 },
                        { title: 'SKU', dataIndex: 'sku', width: 120 },
                        { title: 'Producto', dataIndex: 'producto' },
                        {
                            title: 'Tipo', dataIndex: 'tipo',
                            render: (v: string) => <Tag color={v.startsWith('ENTRADA') || v === 'AJUSTE_ENTRADA' ? 'green' : 'red'}>
                                {TIPO_MOVIMIENTO_LABEL[v] || v}
                            </Tag>
                        },
                        { title: 'Documento', dataIndex: 'documento' },
                        { title: 'Cantidad', dataIndex: 'cantidad', align: 'right' as const, render: (v: number) => num(v) },
                        { title: 'Saldo antes', dataIndex: 'saldoAnterior', align: 'right' as const, render: (v: number) => num(v) },
                        { title: 'Saldo después', dataIndex: 'saldoNuevo', align: 'right' as const, render: (v: number) => <strong>{num(v)}</strong> },
                        { title: 'Costo unit.', dataIndex: 'costo', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                    ],
                    filas: movimientos.map(m => ({
                        fecha: dayjs(m.fecha).format('DD/MM/YYYY HH:mm'),
                        sku: m.sku,
                        producto: m.nombreProducto,
                        tipo: m.tipo,
                        documento: m.documentoOrigen || '',
                        cantidad: m.cantidad,
                        saldoAnterior: m.saldoAnterior,
                        saldoNuevo: m.saldoNuevo,
                        costo: m.costoUnitario || 0,
                        total: m.valorMovimiento || 0,
                    })),
                    nota: 'El Kárdex solo registra movimientos ocurridos DESPUÉS de activar esta función. Lo anterior no se puede reconstruir porque no quedó guardado.',
                }

            default:
                return { columnas: [], filas: [] }
        }
    }, [seleccionado, ventas, comprasFuente, compras, productos, cajas, nominas, movimientos, cotizaciones, recurrentes, acumIniciales])

    const descargarExcel = async () => {
        if (!seleccionado || filas.length === 0) return
        await exportarExcel({
            archivo: `${seleccionado.id}-${dayjs().format('YYYY-MM-DD')}`,
            hoja: 'Reporte',
            titulo: `${seleccionado.nombre} — ${rango[0].format('DD/MM/YYYY')} a ${rango[1].format('DD/MM/YYYY')}`,
            empresa,
            filas: filas as unknown as Record<string, any>[],
            // Los ~50 reportes del catálogo definen sus columnas como AntD Table
            // (title/dataIndex) — se reusan tal cual, solo se detecta cuáles son
            // numéricas (para alinearlas a la derecha con separador de miles) en
            // vez de marcar "moneda" a mano en cada uno de los ~50 reportes.
            columnas: columnas.map((c: any) => ({
                header: c.title, key: c.dataIndex, width: 20,
                moneda: typeof (filas[0] as any)?.[c.dataIndex] === 'number',
            })),
        })
    }

    // ── Catálogo ────────────────────────────────────────────────────────────
    if (!seleccionado) {
        const gruposFiltrados: GrupoReportes[] = CATALOGO
            .map(g => ({
                ...g,
                reportes: g.reportes.filter(r => !busqueda || r.nombre.toLowerCase().includes(busqueda.toLowerCase()))
            }))
            .filter(g => g.reportes.length > 0)

        return (
            <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                    <BarChartOutlined style={{ marginRight: 8 }} />
                    Reportes
                </h2>
                <p style={{ color: colors.textSecondary, margin: '4px 0 16px', fontSize: 13 }}>
                    Selecciona un reporte del catálogo. Los que tienen candado necesitan datos que el sistema aún no captura — pasa el cursor para ver qué falta.
                </p>

                <Input
                    placeholder="Buscar reporte por nombre..."
                    prefix={<SearchOutlined style={{ color: colors.textMuted }} />}
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    allowClear
                    size="large"
                    style={{ marginBottom: 20, maxWidth: 420, borderRadius: 14 }}
                />

                {gruposFiltrados.length === 0 && <Empty description="Ningún reporte coincide con la búsqueda" />}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
                    {gruposFiltrados.map(grupo => {
                        const estilo = COLOR_GRUPO[grupo.id] || { color: colors.primary, bg: colors.primaryLight }
                        return (
                            <Card key={grupo.id} style={{ borderRadius: 22 }} styles={{ body: { padding: 18 } }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                    <div style={{
                                        width: 38, height: 38, borderRadius: 16, background: estilo.bg, color: estilo.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                                    }}>
                                        {ICONO_GRUPO[grupo.id]}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: colors.heading, fontSize: 15 }}>{grupo.nombre}</div>
                                        <div style={{ fontSize: 11.5, color: colors.textMuted }}>{grupo.descripcion}</div>
                                    </div>
                                </div>

                                {grupo.reportes.map(rep => {
                                    const bloqueado = rep.estado === 'REQUIERE_DATOS'
                                    const fila = (
                                        <div
                                            onClick={() => {
                                                if (bloqueado) return
                                                if (rep.ruta) navigate(rep.ruta)
                                                else setSeleccionado(rep)
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '8px 10px', borderRadius: 14, marginBottom: 2,
                                                cursor: bloqueado ? 'not-allowed' : 'pointer',
                                                color: bloqueado ? colors.textMuted : colors.heading, fontSize: 13,
                                            }}
                                            onMouseEnter={e => { if (!bloqueado) e.currentTarget.style.background = colors.pageBg }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                        >
                                            <span>{rep.nombre}</span>
                                            {bloqueado
                                                ? <LockOutlined style={{ fontSize: 11, flexShrink: 0, marginLeft: 8 }} />
                                                : <RightOutlined style={{ fontSize: 10, color: colors.textMuted, flexShrink: 0, marginLeft: 8 }} />}
                                        </div>
                                    )
                                    return bloqueado
                                        ? <Tooltip key={rep.id} title={rep.faltante} placement="left">{fila}</Tooltip>
                                        : <div key={rep.id}>{fila}</div>
                                })}
                            </Card>
                        )
                    })}
                </div>
            </div>
        )
    }

    // ── Reporte seleccionado ────────────────────────────────────────────────
    const totalGeneral = filas.reduce((s, f) => s + (Number(f.total) || 0), 0)

    return (
        <div>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => setSeleccionado(null)} style={{ paddingLeft: 0, marginBottom: 8 }}>
                Volver al catálogo
            </Button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.heading, margin: 0 }}>{seleccionado.nombre}</h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <RangePicker
                        value={rango}
                        onChange={v => v && v[0] && v[1] && setRango([v[0], v[1]])}
                        format="DD/MM/YYYY"
                        allowClear={false}
                    />
                    <Button icon={<DownloadOutlined />} onClick={descargarExcel} disabled={filas.length === 0}>
                        Descargar Excel
                    </Button>
                </div>
            </div>

            {nota && <Alert type="info" showIcon message={nota} style={{ marginBottom: 14 }} />}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 70 }}><Spin size="large" /></div>
            ) : (
                <Card style={{ borderRadius: 22 }} styles={{ body: { padding: 12 } }}>
                    <TablaOrdenable
                        dataSource={filas}
                        columns={columnas}
                        rowKey={(_, i) => String(i)}
                        size="small"
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} registros` }}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: <Empty description="No hay datos en este período" /> }}
                        summary={() => totalGeneral > 0 ? (
                            <Table.Summary fixed>
                                <Table.Summary.Row style={{ fontWeight: 700, background: colors.pageBg }}>
                                    <Table.Summary.Cell index={0} colSpan={Math.max(columnas.length - 1, 1)}>
                                        Total general
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={columnas.length - 1} align="right">
                                        {cop.format(totalGeneral)}
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        ) : null}
                    />
                </Card>
            )}
        </div>
    )
}
