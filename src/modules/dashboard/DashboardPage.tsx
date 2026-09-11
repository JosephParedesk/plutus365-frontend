import { useState, useEffect, useMemo } from 'react'
import { Card, Button, Spin, Tooltip, Segmented, Empty, Modal, Checkbox } from 'antd'
import {
    InboxOutlined, WarningOutlined,
    ArrowUpOutlined, ArrowDownOutlined, FileTextOutlined, TeamOutlined, ShoppingCartOutlined,
    AppstoreOutlined, BarChartOutlined, CloudUploadOutlined, RightOutlined, SettingOutlined
} from '@ant-design/icons'
import {
    AreaChart, Area, BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell, LabelList,
    XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../shared/store/authStore'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'
import { colors } from '../../shared/theme/colors'
import { ventaService, type Venta } from '../../shared/services/ventaService'
import { clienteService } from '../../shared/services/clienteService'
import { productoService, type Producto, TIPO_IVA_LABEL } from '../../shared/services/inventarioService'
import { compraService, type Compra, TIPO_TRANSACCION_LABEL } from '../../shared/services/compraService'
import { empresaService, type Empresa } from '../../shared/services/empresaService'
import { proximosVencimientosDian } from '../../shared/utils/calendarioTributarioDian2026'

const formatoCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
})
const formatoCompacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })
const fmtCompactoCOP = (v: number) => `$${formatoCompacto.format(v)}`

const fmtFecha = (d: Date) => d.toISOString().split('T')[0]
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const METODO_PAGO_LABEL: Record<string, string> = {
    EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', MIXTO: 'Mixto',
}
// Mismo orden que las tarjetas de KPI (Ventas=verde, Clientes=violeta, Productos=ámbar,
// Stock=coral) — reutiliza el vocabulario de categorización ya establecido en vez de
// inventar una paleta nueva para el donut.
const METODO_PAGO_COLOR: Record<string, string> = {
    EFECTIVO: colors.primary, TARJETA: colors.purple, TRANSFERENCIA: colors.orange, MIXTO: colors.red,
}

// Catálogo de gráficas disponibles para "Personalizar" — las 5 originales quedan
// visibles por defecto (no cambia el dashboard de quien nunca toca el botón), las
// nuevas son opt-in. El orden acá es el orden en que se dibujan cuando están activas
// (sin drag&drop todavía — ponytail: si hace falta reordenar, el upgrade es dnd-kit).
interface WidgetMeta { id: string; titulo: string; defaultVisible: boolean }
const CATALOGO_WIDGETS: WidgetMeta[] = [
    { id: 'tendencia', titulo: 'Tendencia de ventas', defaultVisible: true },
    { id: 'flujo_caja', titulo: 'Flujo de caja', defaultVisible: true },
    { id: 'impuestos', titulo: 'Impuestos próximos', defaultVisible: true },
    { id: 'metodo_pago', titulo: 'Ventas por método de pago', defaultVisible: true },
    { id: 'top_productos', titulo: 'Top productos', defaultVisible: true },
    { id: 'iva_recaudado', titulo: 'IVA recaudado por tarifa', defaultVisible: false },
    { id: 'ventas_categoria', titulo: 'Ventas por categoría', defaultVisible: false },
    { id: 'top_clientes', titulo: 'Top clientes', defaultVisible: false },
    { id: 'compras_proveedor', titulo: 'Compras por proveedor', defaultVisible: false },
    { id: 'documentos_compra', titulo: 'Documentos de compra por tipo', defaultVisible: false },
    { id: 'comparativo_mes', titulo: 'Ventas: este mes vs. mes anterior', defaultVisible: false },
    { id: 'inventario_categoria', titulo: 'Valor de inventario por categoría', defaultVisible: false },
    { id: 'stock_critico', titulo: 'Stock crítico', defaultVisible: false },
]

function saludo() {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
}

// Tooltip compartido por las 4 gráficas: valor en negrita (lo que el usuario busca),
// etiqueta en texto secundario, línea de color como llave en vez de una caja rellena.
function GraficaTooltip({ active, payload, label, formatter }: any) {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: colors.cardBg, borderRadius: 16,
            padding: '10px 12px', boxShadow: '0 4px 10px rgba(0,0,0,.04), 0 20px 45px rgba(0,0,0,.10)', minWidth: 160,
        }}>
            {label !== undefined && (
                <div style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 6 }}>{label}</div>
            )}
            {payload.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: i ? 4 : 0 }}>
                    <span style={{ width: 9, height: 2, borderRadius: 1, background: p.color, flexShrink: 0 }} />
                    <span style={{ color: colors.textSecondary, flex: 1 }}>{p.name}</span>
                    <span style={{ fontWeight: 700, color: colors.heading }}>
                        {formatter ? formatter(p.value) : p.value}
                    </span>
                </div>
            ))}
        </div>
    )
}

// Título de tarjeta de gráfica — mismo estilo en las 5 tarjetas nuevas y viejas.
function TituloGrafica({ children }: { children: React.ReactNode }) {
    return <span style={{ fontWeight: 600, color: colors.heading, fontSize: 14 }}>{children}</span>
}

// Barra horizontal reutilizable — el patrón que ya usaba "Top productos", ahora
// compartido por todas las gráficas de ranking (categorías, clientes, proveedores...).
function GraficaBarraHorizontal({
    datos, color = colors.accentBg, formatter = fmtCompactoCOP, anim,
}: {
    datos: { nombre: string; valor: number }[]
    color?: string
    formatter?: (v: number) => string
    anim: boolean
}) {
    return (
        <ResponsiveContainer width="100%" height={Math.max(160, datos.length * 34)}>
            <BarChart data={datos} layout="vertical" margin={{ left: 4, right: 36 }}>
                <XAxis type="number" hide />
                <YAxis
                    type="category"
                    dataKey="nombre"
                    tick={{ fontSize: 11.5, fill: colors.textSecondary }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                    tickFormatter={(v: string) => v.length > 16 ? `${v.slice(0, 15)}…` : v}
                />
                <ChartTooltip content={<GraficaTooltip formatter={formatter} />} cursor={{ fill: colors.pageBg }} />
                <Bar dataKey="valor" name="Valor" fill={color} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={anim}>
                    <LabelList
                        dataKey="valor"
                        position="right"
                        formatter={formatter}
                        style={{ fill: colors.heading, fontSize: 11, fontWeight: 600 }}
                    />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

export default function DashboardPage() {
    const navigate = useNavigate()
    const { usuario } = useAuthStore()
    const prefersReducedMotion = useReducedMotion()
    const [cargando, setCargando] = useState(true)
    const [rangoTendencia, setRangoTendencia] = useState<7 | 30>(7)

    const [ventasRango, setVentasRango] = useState<Venta[]>([])
    const [comprasRango, setComprasRango] = useState<Compra[]>([])
    const [totalClientes, setTotalClientes] = useState(0)
    const [productos, setProductos] = useState<Producto[]>([])
    const [stockBajo, setStockBajo] = useState<Producto[]>([])
    const [empresa, setEmpresa] = useState<Empresa | null>(null)

    // ─── Personalizar dashboard — qué gráficas se muestran, por usuario ────────
    // localStorage y no el backend: es una preferencia visual personal, no un dato
    // de negocio que otro usuario de la empresa necesite ver igual.
    const claveWidgets = `dashboard-widgets-${usuario?.cedula || 'default'}`
    const [visibleIds, setVisibleIds] = useState<string[]>(() => {
        try {
            const guardado = localStorage.getItem(claveWidgets)
            if (guardado) return JSON.parse(guardado)
        } catch { /* localStorage corrupto o deshabilitado — usa los valores por defecto */ }
        return CATALOGO_WIDGETS.filter(w => w.defaultVisible).map(w => w.id)
    })
    const [modalPersonalizarVisible, setModalPersonalizarVisible] = useState(false)

    const alternarWidget = (id: string, visible: boolean) => {
        setVisibleIds(prev => {
            const next = visible ? [...prev, id] : prev.filter(x => x !== id)
            localStorage.setItem(claveWidgets, JSON.stringify(next))
            return next
        })
    }

    useEffect(() => {
        const hoy = new Date()
        const hace6Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)

        // ponytail: trae 6 meses de ventas/compras crudas y agrega todo en el cliente
        // (igual que ya hacía este dashboard con los 7 días) — funciona bien para el
        // volumen típico de una PYME. Si un cliente de alto volumen nota el dashboard
        // lento, el upgrade es un endpoint de agregación mensual en venta-service y
        // compra-service en vez de traer las filas completas.
        Promise.allSettled([
            ventaService.filtrar({ fechaInicio: fmtFecha(hace6Meses), fechaFin: fmtFecha(hoy) }),
            compraService.filtrar({ fechaInicio: fmtFecha(hace6Meses), fechaFin: fmtFecha(hoy) }),
            clienteService.listar(),
            productoService.listar(),
            productoService.listarStockBajo(),
            empresaService.obtener(),
        ]).then(([rVentas, rCompras, rClientes, rProductos, rStockBajo, rEmpresa]) => {
            if (rVentas.status === 'fulfilled') setVentasRango(rVentas.value.data)
            if (rCompras.status === 'fulfilled') setComprasRango(rCompras.value.data)
            if (rClientes.status === 'fulfilled') setTotalClientes(rClientes.value.data.length)
            if (rProductos.status === 'fulfilled') setProductos(rProductos.value.data)
            if (rStockBajo.status === 'fulfilled') setStockBajo(rStockBajo.value.data)
            // 404 si la empresa aún no configuró sus datos — se deja null, el widget lo maneja
            if (rEmpresa.status === 'fulfilled') setEmpresa(rEmpresa.value.data)
        }).finally(() => setCargando(false))
    }, [])

    // ─── Solo transacciones reales cuentan como dinero ─────────────────────────
    // El backend no excluye anuladas/borrador en listar()/filtrar() (confirmado en
    // VentaDataGatewayImpl y CompraDataGatewayImpl), así que si no se filtra acá cada
    // venta o compra anulada se sigue sumando en todos los totales del dashboard.
    const ventasValidas = useMemo(() => ventasRango.filter(v => v.estado !== 'ANULADA'), [ventasRango])
    const comprasValidas = useMemo(() => comprasRango.filter(c => c.estado === 'REGISTRADA'), [comprasRango])

    // Calendario oficial DIAN 2026 por último dígito de NIT — [[dashboard-impuestos-proximos]].
    // Solo muestra lo que la empresa configuró explícitamente en Configuración
    // (periodicidad de IVA, si es agente retenedor); si no lo configuró, no inventa nada.
    const vencimientosDian = useMemo(() => proximosVencimientosDian(empresa), [empresa])

    // ─── Agregaciones — KPIs ────────────────────────────────────────────────────
    const hoyStr = fmtFecha(new Date())
    const ventasHoy = useMemo(
        () => ventasValidas.filter(v => v.fecha?.split('T')[0] === hoyStr),
        [ventasValidas, hoyStr]
    )
    const totalVentasHoy = ventasHoy.reduce((acc, v) => acc + v.total, 0)

    const primerDiaMesStr = useMemo(() => {
        const hoy = new Date()
        return fmtFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    }, [])
    const ventasMes = useMemo(
        () => ventasValidas.filter(v => (v.fecha?.split('T')[0] || '') >= primerDiaMesStr),
        [ventasValidas, primerDiaMesStr]
    )
    const comprasMes = useMemo(
        () => comprasValidas.filter(c => (c.fechaElaboracion || '') >= primerDiaMesStr),
        [comprasValidas, primerDiaMesStr]
    )
    const totalVentasMes = ventasMes.reduce((acc, v) => acc + v.total, 0)
    const totalComprasMes = comprasMes.reduce((acc, c) => acc + (c.totalPagar || 0), 0)

    // ─── Tendencia de ventas — 7/30 días, interactiva ──────────────────────────
    const datosDiarios = useMemo(() => {
        const hoy = new Date()
        const dias = Array.from({ length: 30 }, (_, i) => {
            const d = new Date(hoy); d.setDate(hoy.getDate() - (29 - i))
            return { fecha: fmtFecha(d), diaSemana: DIAS[d.getDay()], diaMes: d.getDate(), ventas: 0 }
        })
        for (const venta of ventasValidas) {
            const fecha = venta.fecha?.split('T')[0]
            const bucket = dias.find(d => d.fecha === fecha)
            if (bucket) bucket.ventas += venta.total
        }
        return dias
    }, [ventasValidas])

    const datosTendencia = useMemo(() => {
        return datosDiarios.slice(30 - rangoTendencia).map(d => ({
            ...d,
            etiqueta: rangoTendencia === 7 ? d.diaSemana : String(d.diaMes),
        }))
    }, [datosDiarios, rangoTendencia])

    const totalTendencia = datosTendencia.reduce((acc, d) => acc + d.ventas, 0)
    const hayTendencia = datosTendencia.some(d => d.ventas > 0)

    // ─── Flujo de caja — últimos 6 meses ────────────────────────────────────────
    const datosFlujoCaja = useMemo(() => {
        const hoy = new Date()
        const meses = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
            return {
                clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                mes: MESES[d.getMonth()], ventas: 0, compras: 0,
            }
        })
        for (const venta of ventasValidas) {
            const bucket = meses.find(m => m.clave === venta.fecha?.slice(0, 7))
            if (bucket) bucket.ventas += venta.total
        }
        for (const compra of comprasValidas) {
            const bucket = meses.find(m => m.clave === compra.fechaElaboracion?.slice(0, 7))
            if (bucket) bucket.compras += (compra.totalPagar || 0)
        }
        return meses.map(m => ({ ...m, neto: m.ventas - m.compras }))
    }, [ventasValidas, comprasValidas])

    const hayFlujoCaja = datosFlujoCaja.some(m => m.ventas > 0 || m.compras > 0)

    // ─── Ventas por método de pago — este mes ──────────────────────────────────
    const datosMetodoPago = useMemo(() => {
        const acumulado = new Map<string, number>()
        for (const venta of ventasMes) {
            for (const forma of venta.formasPago || []) {
                acumulado.set(forma.metodo, (acumulado.get(forma.metodo) || 0) + forma.valor)
            }
        }
        return Array.from(acumulado.entries())
            .map(([metodo, valor]) => ({
                metodo,
                nombre: METODO_PAGO_LABEL[metodo] || metodo,
                valor,
                color: METODO_PAGO_COLOR[metodo] || colors.textMuted,
            }))
            .sort((a, b) => b.valor - a.valor)
    }, [ventasMes])

    const totalMetodoPago = datosMetodoPago.reduce((acc, d) => acc + d.valor, 0)

    // ─── Top productos — este mes ───────────────────────────────────────────────
    const datosTopProductos = useMemo(() => {
        const acumulado = new Map<string, number>()
        for (const venta of ventasMes) {
            for (const item of venta.items || []) {
                const nombre = item.nombreProducto || item.sku
                const valor = item.valorTotal ?? (item.cantidad * item.precioUnitario - (item.descuento || 0))
                acumulado.set(nombre, (acumulado.get(nombre) || 0) + valor)
            }
        }
        return Array.from(acumulado.entries())
            .map(([nombre, valor]) => ({ nombre, valor }))
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 5)
    }, [ventasMes])

    // ─── IVA recaudado por tarifa — este mes ───────────────────────────────────
    const IVA_COLOR: Record<string, string> = {
        GENERAL_19: colors.primary, REDUCIDO_5: colors.purple, EXENTO: colors.orange, EXCLUIDO: colors.red,
    }
    const datosIva = useMemo(() => {
        const acumulado = new Map<string, number>()
        for (const venta of ventasMes) {
            for (const item of venta.items || []) {
                const tipo = item.tipoIva || 'GENERAL_19'
                acumulado.set(tipo, (acumulado.get(tipo) || 0) + (item.valorIva || 0))
            }
        }
        return Array.from(acumulado.entries())
            .map(([tipo, valor]) => ({ tipo, nombre: TIPO_IVA_LABEL[tipo as keyof typeof TIPO_IVA_LABEL] || tipo, valor, color: IVA_COLOR[tipo] || colors.textMuted }))
            .filter(d => d.valor > 0)
            .sort((a, b) => b.valor - a.valor)
    }, [ventasMes])
    const totalIvaRecaudado = datosIva.reduce((acc, d) => acc + d.valor, 0)

    // ─── Ventas por categoría — este mes ───────────────────────────────────────
    const categoriaPorSku = useMemo(() => {
        const m = new Map<string, string>()
        for (const p of productos) m.set(p.sku, p.categoriaNombre || 'Sin categoría')
        return m
    }, [productos])
    const datosVentasCategoria = useMemo(() => {
        const acumulado = new Map<string, number>()
        for (const venta of ventasMes) {
            for (const item of venta.items || []) {
                const cat = categoriaPorSku.get(item.sku) || 'Sin categoría'
                const valor = item.valorTotal ?? (item.cantidad * item.precioUnitario - (item.descuento || 0))
                acumulado.set(cat, (acumulado.get(cat) || 0) + valor)
            }
        }
        return Array.from(acumulado.entries())
            .map(([nombre, valor]) => ({ nombre, valor }))
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 6)
    }, [ventasMes, categoriaPorSku])

    // ─── Top clientes — este mes ────────────────────────────────────────────────
    const datosTopClientes = useMemo(() => {
        const acumulado = new Map<string, number>()
        for (const venta of ventasMes) {
            const nombre = venta.clienteNombre || 'Consumidor final'
            acumulado.set(nombre, (acumulado.get(nombre) || 0) + venta.total)
        }
        return Array.from(acumulado.entries())
            .map(([nombre, valor]) => ({ nombre, valor }))
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 5)
    }, [ventasMes])

    // ─── Compras por proveedor — últimos 6 meses ───────────────────────────────
    const datosComprasProveedor = useMemo(() => {
        const acumulado = new Map<string, number>()
        for (const compra of comprasValidas) {
            const nombre = compra.proveedorNombre || 'Sin proveedor'
            acumulado.set(nombre, (acumulado.get(nombre) || 0) + (compra.totalPagar || 0))
        }
        return Array.from(acumulado.entries())
            .map(([nombre, valor]) => ({ nombre, valor }))
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 5)
    }, [comprasValidas])

    // ─── Documentos de compra por tipo — últimos 6 meses ───────────────────────
    const datosDocumentosCompra = useMemo(() => {
        const acumulado = new Map<string, number>()
        for (const compra of comprasValidas) {
            acumulado.set(compra.tipoTransaccion, (acumulado.get(compra.tipoTransaccion) || 0) + 1)
        }
        return Array.from(acumulado.entries())
            .map(([tipo, valor]) => ({ nombre: TIPO_TRANSACCION_LABEL[tipo as keyof typeof TIPO_TRANSACCION_LABEL] || tipo, valor }))
            .sort((a, b) => b.valor - a.valor)
    }, [comprasValidas])

    // ─── Comparativo de ventas: este mes vs. mes anterior ──────────────────────
    const primerDiaMesAnteriorStr = useMemo(() => {
        const hoy = new Date()
        return fmtFecha(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))
    }, [])
    const totalVentasMesAnterior = useMemo(() => ventasValidas
        .filter(v => {
            const f = v.fecha?.split('T')[0] || ''
            return f >= primerDiaMesAnteriorStr && f < primerDiaMesStr
        })
        .reduce((acc, v) => acc + v.total, 0),
        [ventasValidas, primerDiaMesAnteriorStr, primerDiaMesStr]
    )
    const variacionMes = totalVentasMesAnterior > 0
        ? ((totalVentasMes - totalVentasMesAnterior) / totalVentasMesAnterior) * 100
        : (totalVentasMes > 0 ? 100 : 0)

    // ─── Valor de inventario por categoría ──────────────────────────────────────
    const datosInventarioCategoria = useMemo(() => {
        const acumulado = new Map<string, number>()
        for (const p of productos) {
            if (!p.activo) continue
            const cat = p.categoriaNombre || 'Sin categoría'
            acumulado.set(cat, (acumulado.get(cat) || 0) + p.precioVenta * p.stock)
        }
        return Array.from(acumulado.entries())
            .map(([nombre, valor]) => ({ nombre, valor }))
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 6)
    }, [productos])

    // ─── Stock crítico — los más urgentes primero ───────────────────────────────
    const stockCriticoOrdenado = useMemo(() =>
        [...stockBajo].sort((a, b) => (a.stock - a.stockMinimo) - (b.stock - b.stockMinimo)).slice(0, 8),
        [stockBajo]
    )

    const kpis = [
        {
            titulo: 'Ventas hoy',
            valor: formatoCOP.format(totalVentasHoy),
            sub: `${ventasHoy.length} transacciones`,
            icon: <ShoppingCartOutlined />,
            color: colors.primary,
            bg: colors.primaryLight,
            link: false,
        },
        {
            titulo: 'Clientes registrados',
            valor: String(totalClientes),
            sub: 'En tu base de datos',
            icon: <TeamOutlined />,
            color: colors.purple,
            bg: colors.purpleLight,
            link: false,
        },
        {
            titulo: 'Productos en inventario',
            valor: String(productos.length),
            sub: 'Activos',
            icon: <InboxOutlined />,
            color: colors.orange,
            bg: colors.orangeLight,
            link: false,
        },
        {
            titulo: 'Stock bajo',
            valor: String(stockBajo.length),
            sub: stockBajo.length > 0 ? 'Revisa el inventario' : 'Todo en orden',
            icon: <WarningOutlined />,
            color: colors.red,
            bg: colors.redLight,
            link: stockBajo.length > 0,
        },
    ]

    const accionesRapidas = [
        { label: 'Nueva venta', icon: <ShoppingCartOutlined />, color: colors.primary, bg: colors.primaryLight, ruta: '/ventas' },
        { label: 'Nuevo cliente', icon: <TeamOutlined />, color: colors.purple, bg: colors.purpleLight, ruta: '/clientes' },
        { label: 'Registrar compra', icon: <FileTextOutlined />, color: colors.orange, bg: colors.orangeLight, ruta: '/compras' },
        { label: 'Ver inventario', icon: <AppstoreOutlined />, color: colors.red, bg: colors.redLight, ruta: '/inventario' },
        { label: 'Cotizaciones', icon: <FileTextOutlined />, color: colors.primary, bg: colors.primaryLight, ruta: '/ventas/cotizaciones' },
        { label: 'Ver reportes', icon: <BarChartOutlined />, color: colors.purple, bg: colors.purpleLight, ruta: '/reportes' },
    ]

    if (cargando) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>
    }

    // Un nodo por gráfica del catálogo — [[dashboard-personalizar]] filtra y ordena
    // esto por CATALOGO_WIDGETS/visibleIds antes de dibujarlo en el grid.
    const widgetNodos: Record<string, React.ReactNode> = {
        tendencia: (
            <Card
                hoverable
                title={<TituloGrafica>Tendencia de ventas</TituloGrafica>}
                extra={
                    <Segmented
                        size="small"
                        value={rangoTendencia}
                        onChange={(v) => setRangoTendencia(v as 7 | 30)}
                        options={[{ label: '7 días', value: 7 }, { label: '30 días', value: 30 }]}
                    />
                }
                style={{ borderRadius: 22 }}
            >
                <div style={{ fontSize: 22, fontWeight: 800, color: colors.heading, marginBottom: 8 }}>
                    {formatoCOP.format(totalTendencia)}
                    {hayTendencia && <ArrowUpOutlined style={{ fontSize: 13, color: colors.primary, marginLeft: 8 }} />}
                </div>
                {hayTendencia ? (
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={datosTendencia} margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="none" stroke={colors.border} vertical={false} />
                            <XAxis
                                dataKey="etiqueta"
                                tick={{ fontSize: 11, fill: colors.textMuted }}
                                axisLine={false}
                                tickLine={false}
                                interval={rangoTendencia === 30 ? 4 : 0}
                                padding={{ left: 10, right: 10 }}
                            />
                            <YAxis hide />
                            <ChartTooltip content={<GraficaTooltip formatter={formatoCOP.format} />} cursor={{ stroke: colors.border }} />
                            <Area
                                type="monotone"
                                dataKey="ventas"
                                name="Ventas"
                                stroke={colors.accent}
                                strokeWidth={2.5}
                                fill={colors.accent}
                                fillOpacity={0.15}
                                dot={rangoTendencia === 7 ? { fill: colors.accent, r: 3, strokeWidth: 2, stroke: colors.cardBg } : false}
                                activeDot={{ r: 4, strokeWidth: 2, stroke: colors.cardBg }}
                                isAnimationActive={!prefersReducedMotion}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <Empty description={`Sin ventas en los últimos ${rangoTendencia} días`} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        flujo_caja: (
            <Card
                hoverable
                title={<TituloGrafica>Flujo de caja</TituloGrafica>}
                extra={<span style={{ fontSize: 11.5, color: colors.textMuted }}>Últimos 6 meses</span>}
                style={{ borderRadius: 22 }}
            >
                {hayFlujoCaja ? (
                    <>
                        <ResponsiveContainer width="100%" height={180}>
                            <ComposedChart data={datosFlujoCaja} barGap={2}>
                                <CartesianGrid strokeDasharray="none" stroke={colors.border} vertical={false} />
                                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: colors.textMuted }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: colors.textMuted }} axisLine={false} tickLine={false} tickFormatter={fmtCompactoCOP} width={44} />
                                <ChartTooltip content={<GraficaTooltip formatter={formatoCOP.format} />} cursor={{ fill: colors.pageBg }} />
                                <Bar dataKey="ventas" name="Ventas" fill={colors.accentBg} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={!prefersReducedMotion} />
                                <Bar dataKey="compras" name="Compras" fill={colors.red} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={!prefersReducedMotion} />
                                <Line dataKey="neto" name="Neto" stroke={colors.heading} strokeWidth={2} dot={{ r: 3, fill: colors.heading, strokeWidth: 2, stroke: colors.cardBg }} isAnimationActive={!prefersReducedMotion} />
                            </ComposedChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                            {[
                                { nombre: 'Ventas', color: colors.accentBg, forma: 'rect' as const },
                                { nombre: 'Compras', color: colors.red, forma: 'rect' as const },
                                { nombre: 'Neto', color: colors.heading, forma: 'line' as const },
                            ].map((s) => (
                                <div key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: colors.textSecondary }}>
                                    {s.forma === 'rect' ? (
                                        <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                                    ) : (
                                        <span style={{ width: 10, height: 2, borderRadius: 1, background: s.color }} />
                                    )}
                                    {s.nombre}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <Empty description="Sin movimientos en los últimos 6 meses" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        impuestos: (
            <Card
                hoverable
                title={<TituloGrafica>Impuestos próximos</TituloGrafica>}
                style={{ borderRadius: 22 }}
            >
                {vencimientosDian.length > 0 ? (
                    vencimientosDian.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{
                                background: colors.orangeLight, color: colors.orange, borderRadius: 14,
                                padding: '4px 8px', fontSize: 11, fontWeight: 700, textAlign: 'center', minWidth: 44,
                            }}>
                                {item.fecha.getDate()} {MESES[item.fecha.getMonth()].toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.heading }}>{item.label}</div>
                                <div style={{ fontSize: 11, color: colors.textMuted }}>{item.detalle}</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10 }}>
                        Configura tu régimen tributario (periodicidad de IVA, agente retenedor)
                        para ver aquí tus próximos vencimientos reales, calculados con tu NIT
                        sobre el calendario oficial de la DIAN.
                    </div>
                )}
                <span
                    onClick={() => navigate('/configuracion')}
                    style={{ fontSize: 12, color: colors.primary, fontWeight: 600, cursor: 'pointer' }}
                >
                    {vencimientosDian.length > 0 ? 'Ajustar en Configuración' : 'Configurar ahora'} <RightOutlined style={{ fontSize: 10 }} />
                </span>
            </Card>
        ),

        metodo_pago: (
            <Card
                hoverable
                title={<TituloGrafica>Ventas por método de pago</TituloGrafica>}
                extra={<span style={{ fontSize: 11.5, color: colors.textMuted }}>Este mes</span>}
                style={{ borderRadius: 22 }}
            >
                {datosMetodoPago.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={datosMetodoPago}
                                        dataKey="valor"
                                        nameKey="nombre"
                                        innerRadius={48}
                                        outerRadius={70}
                                        paddingAngle={2}
                                        stroke={colors.cardBg}
                                        strokeWidth={2}
                                        isAnimationActive={!prefersReducedMotion}
                                    >
                                        {datosMetodoPago.map((d) => <Cell key={d.metodo} fill={d.color} />)}
                                    </Pie>
                                    <ChartTooltip content={<GraficaTooltip formatter={formatoCOP.format} />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                            }}>
                                <span style={{ fontSize: 15, fontWeight: 800, color: colors.heading }}>
                                    {fmtCompactoCOP(totalMetodoPago)}
                                </span>
                                <span style={{ fontSize: 10.5, color: colors.textMuted }}>Total mes</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 140 }}>
                            {datosMetodoPago.map((d) => (
                                <div key={d.metodo} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                                    <span style={{ color: colors.textSecondary, flex: 1 }}>{d.nombre}</span>
                                    <span style={{ fontWeight: 700, color: colors.heading }}>
                                        {totalMetodoPago > 0 ? `${Math.round((d.valor / totalMetodoPago) * 100)}%` : '0%'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <Empty description="Sin ventas este mes" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        top_productos: (
            <Card
                hoverable
                title={<TituloGrafica>Top productos</TituloGrafica>}
                extra={<span style={{ fontSize: 11.5, color: colors.textMuted }}>Este mes</span>}
                style={{ borderRadius: 22 }}
            >
                {datosTopProductos.length > 0 ? (
                    <GraficaBarraHorizontal datos={datosTopProductos} color={colors.accentBg} formatter={fmtCompactoCOP} anim={!prefersReducedMotion} />
                ) : (
                    <Empty description="Sin ventas este mes" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        iva_recaudado: (
            <Card
                hoverable
                title={<TituloGrafica>IVA recaudado por tarifa</TituloGrafica>}
                extra={<span style={{ fontSize: 11.5, color: colors.textMuted }}>Este mes</span>}
                style={{ borderRadius: 22 }}
            >
                {datosIva.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={datosIva}
                                        dataKey="valor"
                                        nameKey="nombre"
                                        innerRadius={48}
                                        outerRadius={70}
                                        paddingAngle={2}
                                        stroke={colors.cardBg}
                                        strokeWidth={2}
                                        isAnimationActive={!prefersReducedMotion}
                                    >
                                        {datosIva.map((d) => <Cell key={d.tipo} fill={d.color} />)}
                                    </Pie>
                                    <ChartTooltip content={<GraficaTooltip formatter={formatoCOP.format} />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                            }}>
                                <span style={{ fontSize: 15, fontWeight: 800, color: colors.heading }}>
                                    {fmtCompactoCOP(totalIvaRecaudado)}
                                </span>
                                <span style={{ fontSize: 10.5, color: colors.textMuted }}>Total mes</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 140 }}>
                            {datosIva.map((d) => (
                                <div key={d.tipo} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                                    <span style={{ color: colors.textSecondary, flex: 1 }}>{d.nombre}</span>
                                    <span style={{ fontWeight: 700, color: colors.heading }}>{formatoCOP.format(d.valor)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <Empty description="Sin IVA recaudado este mes" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        ventas_categoria: (
            <Card
                hoverable
                title={<TituloGrafica>Ventas por categoría</TituloGrafica>}
                extra={<span style={{ fontSize: 11.5, color: colors.textMuted }}>Este mes</span>}
                style={{ borderRadius: 22 }}
            >
                {datosVentasCategoria.length > 0 ? (
                    <GraficaBarraHorizontal datos={datosVentasCategoria} color={colors.accentBg} formatter={fmtCompactoCOP} anim={!prefersReducedMotion} />
                ) : (
                    <Empty description="Sin ventas este mes" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        top_clientes: (
            <Card
                hoverable
                title={<TituloGrafica>Top clientes</TituloGrafica>}
                extra={<span style={{ fontSize: 11.5, color: colors.textMuted }}>Este mes</span>}
                style={{ borderRadius: 22 }}
            >
                {datosTopClientes.length > 0 ? (
                    <GraficaBarraHorizontal datos={datosTopClientes} color={colors.purple} formatter={fmtCompactoCOP} anim={!prefersReducedMotion} />
                ) : (
                    <Empty description="Sin ventas este mes" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        compras_proveedor: (
            <Card
                hoverable
                title={<TituloGrafica>Compras por proveedor</TituloGrafica>}
                extra={<span style={{ fontSize: 11.5, color: colors.textMuted }}>Últimos 6 meses</span>}
                style={{ borderRadius: 22 }}
            >
                {datosComprasProveedor.length > 0 ? (
                    <GraficaBarraHorizontal datos={datosComprasProveedor} color={colors.red} formatter={fmtCompactoCOP} anim={!prefersReducedMotion} />
                ) : (
                    <Empty description="Sin compras en los últimos 6 meses" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        documentos_compra: (
            <Card
                hoverable
                title={<TituloGrafica>Documentos de compra por tipo</TituloGrafica>}
                extra={<span style={{ fontSize: 11.5, color: colors.textMuted }}>Últimos 6 meses</span>}
                style={{ borderRadius: 22 }}
            >
                {datosDocumentosCompra.length > 0 ? (
                    <GraficaBarraHorizontal datos={datosDocumentosCompra} color={colors.orange} formatter={(v) => String(v)} anim={!prefersReducedMotion} />
                ) : (
                    <Empty description="Sin compras en los últimos 6 meses" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        comparativo_mes: (
            <Card hoverable title={<TituloGrafica>Ventas: este mes vs. mes anterior</TituloGrafica>} style={{ borderRadius: 22 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: colors.heading, marginBottom: 8 }}>
                    {formatoCOP.format(totalVentasMes)}
                    <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 8, color: variacionMes >= 0 ? colors.primary : colors.red }}>
                        {variacionMes >= 0 ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />}
                        {' '}{Math.abs(variacionMes).toFixed(1)}%
                    </span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                        data={[
                            { nombre: 'Mes anterior', valor: totalVentasMesAnterior },
                            { nombre: 'Este mes', valor: totalVentasMes },
                        ]}
                        margin={{ top: 4, right: 12, left: 12, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="none" stroke={colors.border} vertical={false} />
                        <XAxis dataKey="nombre" tick={{ fontSize: 11.5, fill: colors.textMuted }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <ChartTooltip content={<GraficaTooltip formatter={formatoCOP.format} />} cursor={{ fill: colors.pageBg }} />
                        <Bar dataKey="valor" name="Ventas" fill={colors.accentBg} radius={[4, 4, 0, 0]} maxBarSize={60} isAnimationActive={!prefersReducedMotion} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        ),

        inventario_categoria: (
            <Card hoverable title={<TituloGrafica>Valor de inventario por categoría</TituloGrafica>} style={{ borderRadius: 22 }}>
                {datosInventarioCategoria.length > 0 ? (
                    <GraficaBarraHorizontal datos={datosInventarioCategoria} color={colors.primary} formatter={fmtCompactoCOP} anim={!prefersReducedMotion} />
                ) : (
                    <Empty description="Sin productos activos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '24px 0' }} />
                )}
            </Card>
        ),

        stock_critico: (
            <Card hoverable title={<TituloGrafica>Stock crítico</TituloGrafica>} style={{ borderRadius: 22 }}>
                {stockCriticoOrdenado.length > 0 ? (
                    stockCriticoOrdenado.map((p) => (
                        <div key={p.sku} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{
                                background: colors.redLight, color: colors.red, borderRadius: 14,
                                padding: '4px 8px', fontSize: 11, fontWeight: 700, textAlign: 'center', minWidth: 44,
                            }}>
                                {p.stock}/{p.stockMinimo}
                            </div>
                            <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.heading }}>{p.nombre}</div>
                                <div style={{ fontSize: 11, color: colors.textMuted }}>{p.unidad}</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10 }}>
                        Todo el inventario está en orden.
                    </div>
                )}
                <span
                    onClick={() => navigate('/inventario')}
                    style={{ fontSize: 12, color: colors.primary, fontWeight: 600, cursor: 'pointer' }}
                >
                    Ver inventario <RightOutlined style={{ fontSize: 10 }} />
                </span>
            </Card>
        ),
    }

    return (
        <div>
            <style>{`
                @media (max-width: 640px) {
                    .dashboard-hero-banner { flex-direction: column; align-items: stretch !important; text-align: center; }
                    .dashboard-hero-banner button { width: 100%; }
                }
            `}</style>

            {/* Importar factura de compra — atajo destacado */}
            <div
                onClick={() => navigate('/compras/nueva?importar=1')}
                className="hover-lift dashboard-hero-banner"
                style={{
                    display: 'flex', alignItems: 'center', gap: 18, cursor: 'pointer',
                    background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                    borderRadius: 22, padding: '18px 24px', marginBottom: 20,
                    boxShadow: '0 4px 14px rgba(78, 111, 58,0.25)',
                }}
            >
                <div style={{
                    width: 52, height: 52, borderRadius: 22, background: 'rgba(255,255,255,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <CloudUploadOutlined style={{ fontSize: 26, color: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 16.5 }}>
                        Introduzca aquí su archivo de compra
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3 }}>
                        Sube el XML o PDF de la factura de tu proveedor. El sistema la contabiliza y afecta el inventario automáticamente.
                    </div>
                </div>
                <Button
                    size="large"
                    style={{
                        background: '#fff', border: 'none', color: colors.primary,
                        fontWeight: 700, borderRadius: 16, flexShrink: 0,
                    }}
                >
                    Subir archivo
                </Button>
            </div>

            {/* Saludo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        {saludo()}, {usuario?.nombre?.split(' ')[0] || 'de nuevo'}
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13.5 }}>
                        Así va tu empresa hoy.
                    </p>
                </div>
                <Button
                    icon={<SettingOutlined />}
                    onClick={() => setModalPersonalizarVisible(true)}
                    style={{ borderRadius: 14, borderColor: colors.border }}
                >
                    Personalizar
                </Button>
            </div>

            {/* Acciones rápidas — al principio, es lo primero que se usa al entrar */}
            <Card
                hoverable
                title={<TituloGrafica>Acciones rápidas</TituloGrafica>}
                style={{ borderRadius: 22, marginBottom: 20 }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                    {accionesRapidas.map((accion, i) => (
                        <Tooltip key={i} title={accion.ruta ? '' : 'Próximamente'}>
                            <Button
                                onClick={() => accion.ruta && navigate(accion.ruta)}
                                disabled={!accion.ruta}
                                className="hover-lift"
                                style={{
                                    height: 64, borderRadius: 16, border: 'none',
                                    boxShadow: '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', gap: 4,
                                }}
                            >
                                <span style={{
                                    color: accion.color, background: accion.bg, borderRadius: 14,
                                    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {accion.icon}
                                </span>
                                <span style={{ fontSize: 11.5, color: colors.heading }}>{accion.label}</span>
                            </Button>
                        </Tooltip>
                    ))}
                </div>
            </Card>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                {kpis.map((kpi, i) => (
                    <Card
                        key={i}
                        hoverable
                        className="fade-in"
                        style={{ borderRadius: 22, animationDelay: `${i * 40}ms` }}
                        styles={{ body: { padding: 18 } }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ color: colors.textSecondary, margin: 0, fontSize: 12.5 }}>{kpi.titulo}</p>
                                <p style={{
                                    fontSize: 22, fontWeight: 800, color: colors.heading, margin: '4px 0',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {kpi.valor}
                                </p>
                                {kpi.link ? (
                                    <span
                                        onClick={() => navigate('/inventario')}
                                        style={{ fontSize: 12.5, color: kpi.color, fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Ver inventario <RightOutlined style={{ fontSize: 10 }} />
                                    </span>
                                ) : (
                                    <span style={{ fontSize: 12, color: colors.textMuted }}>{kpi.sub}</span>
                                )}
                            </div>
                            <div style={{
                                background: kpi.bg, color: kpi.color, borderRadius: 18,
                                width: 44, height: 44, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 20, flexShrink: 0,
                            }}>
                                {kpi.icon}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Gráficas — el catálogo completo está en CATALOGO_WIDGETS, filtrado
                y ordenado por lo que el usuario activó en "Personalizar" */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
                {CATALOGO_WIDGETS.filter(w => visibleIds.includes(w.id)).map(w => (
                    <div key={w.id}>{widgetNodos[w.id]}</div>
                ))}
            </div>

            {/* Personalizar — activa/desactiva gráficas del catálogo, se guarda por usuario */}
            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Personalizar dashboard</span>}
                open={modalPersonalizarVisible}
                onCancel={() => setModalPersonalizarVisible(false)}
                footer={
                    <Button type="primary" onClick={() => setModalPersonalizarVisible(false)} style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14 }}>
                        Listo
                    </Button>
                }
                width={440}
            >
                <p style={{ color: colors.textSecondary, fontSize: 13, marginTop: 0 }}>
                    Elige qué gráficas quieres ver en tu dashboard. Se guarda solo para tu usuario.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                    {CATALOGO_WIDGETS.map(w => (
                        <Checkbox
                            key={w.id}
                            checked={visibleIds.includes(w.id)}
                            onChange={(e) => alternarWidget(w.id, e.target.checked)}
                        >
                            {w.titulo}
                        </Checkbox>
                    ))}
                </div>
            </Modal>
        </div>
    )
}
