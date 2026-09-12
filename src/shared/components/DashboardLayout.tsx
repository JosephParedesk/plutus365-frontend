import { useState, useEffect, useMemo } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Button, ConfigProvider, Spin, AutoComplete, Input, Tooltip, Modal } from 'antd'
import {
    DashboardOutlined, ShoppingCartOutlined, InboxOutlined,
    CarOutlined, AccountBookOutlined,
    FileTextOutlined, FileDoneOutlined, UserOutlined, SettingOutlined,
    LogoutOutlined, BellOutlined, LockOutlined,
    ShopOutlined, SearchOutlined, PlusOutlined, BarChartOutlined,
    BulbOutlined, BulbFilled, CrownOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { empresaService } from '../services/empresaService'
import { compraService, type Compra } from '../services/compraService'
import { colors } from '../theme/colors'
import { puedeVer } from '../utils/permisos'
import logoPlutus from '../../assets/logo.png'

const { Header, Content } = Layout

// Barra lateral: solo iconos, siempre. El nombre de cada sección aparece
// como tooltip nativo de AntD al pasar el mouse (Menu inlineCollapsed).
const SIDEBAR_WIDTH = 72

// requierePos: true → además del plan y el rol, necesita que la empresa haya
// prendido el interruptor de POS en Configuración (apagado por defecto). Nada
// de Facturación lo lleva — es la parte que sigue funcionando con el POS apagado.
const todosLosModulos = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Inicio', planes: [1, 2, 3], modulo: null },
    { key: '/ventas', icon: <ShoppingCartOutlined />, label: 'Ventas (POS)', planes: [1, 2, 3], modulo: 'VENTAS' as const, requierePos: true },
    { key: '/inventario', icon: <InboxOutlined />, label: 'Inventario', planes: [1, 2, 3], modulo: 'INVENTARIO' as const },
    {
        key: 'documentos-venta',
        icon: <FileDoneOutlined />,
        label: 'Documentos de venta',
        planes: [1, 2, 3],
        modulo: 'VENTAS' as const,
        children: [
            { key: '/facturas/ventas', label: 'Factura de venta / Ingresos', planes: [1, 2, 3], modulo: 'VENTAS' as const },
            { key: '/facturas/recibos-caja', label: 'Recibo de caja', planes: [2, 3], modulo: 'VENTAS' as const, requierePos: true },
            { key: '/clientes', label: 'Clientes', planes: [1, 2, 3], modulo: 'CLIENTES' as const },
            { key: '/ventas/cotizaciones', label: 'Cotización', planes: [2, 3], modulo: 'VENTAS' as const },
            { key: '/facturas/remisiones', label: 'Remisión', planes: [2, 3], modulo: 'VENTAS' as const },
            { key: '/facturacion/notas-credito', label: 'Nota crédito', planes: [2, 3], modulo: 'FACTURACION' as const },
            { key: '/facturacion/notas-debito', label: 'Nota débito (DIAN)', planes: [2, 3], modulo: 'FACTURACION' as const },
            { key: '/facturas/notas-debito', label: 'Nota débito (Ventas)', planes: [2, 3], modulo: 'VENTAS' as const },
            { key: '/ventas/recurrentes', label: 'Facturación recurrente', planes: [2, 3], modulo: 'VENTAS' as const },
        ]
    },
    {
        key: 'compras',
        icon: <CarOutlined />,
        label: 'Compras',
        planes: [2, 3],
        modulo: 'COMPRAS' as const,
        children: [
            { key: '/compras', label: 'Compras y Gastos', planes: [2, 3], modulo: 'COMPRAS' as const },
            { key: '/compras/documentos-soporte', label: 'Documento soporte (DIAN)', planes: [2, 3], modulo: 'COMPRAS' as const },
            { key: '/compras/recepcion-documentos', label: 'Recepción DIAN (RADIAN)', planes: [2, 3], modulo: 'COMPRAS' as const },
            { key: '/compras/proveedores', label: 'Proveedores', planes: [2, 3], modulo: 'COMPRAS' as const },
        ]
    },
    { key: '/contabilidad', icon: <AccountBookOutlined />, label: 'Contabilidad', planes: [2, 3], modulo: 'CONTABILIDAD' as const },
    {
        key: 'facturacion-grupo',
        icon: <FileTextOutlined />,
        label: 'Facturación',
        planes: [2, 3],
        modulo: 'FACTURACION' as const,
        children: [
            { key: '/facturacion/nueva', label: 'Nueva factura', planes: [2, 3], modulo: 'FACTURACION' as const },
            { key: '/facturacion', label: 'Facturas emitidas', planes: [2, 3], modulo: 'FACTURACION' as const },
        ]
    },
    { key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes', planes: [2, 3], modulo: 'VENTAS' as const },
    { key: '/nomina', icon: <UserOutlined />, label: 'Nómina', planes: [3], modulo: 'NOMINA' as const },
]

export default function DashboardLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { usuario, logout } = useAuthStore()
    const modo = useThemeStore(s => s.modo)
    const alternarTema = useThemeStore(s => s.alternar)
    const [nombreEmpresa, setNombreEmpresa] = useState<string | null>(null)
    const [cargandoEmpresa, setCargandoEmpresa] = useState(true)
    const [posHabilitado, setPosHabilitado] = useState(false)
    const [busqueda, setBusqueda] = useState('')
    const [cuentasPorVencer, setCuentasPorVencer] = useState<Compra[]>([])
    const [recordatorioConfig, setRecordatorioConfig] = useState(false)

    const planId = usuario?.planId ?? 1

    useEffect(() => {
        empresaService.obtener()
            .then(({ data }) => {
                setNombreEmpresa(data.nombreComercial || data.razonSocial || data.nombres || null)
                setPosHabilitado(!!data.posHabilitado)
            })
            .catch((err) => {
                setNombreEmpresa(null)
                // 404 = la empresa nunca guardó su configuración (contrato documentado
                // en empresaService.ts) — ahí sí vale la pena recordárselo. Un error de
                // red o del servidor no significa "falta configurar", así que no dispara
                // el recordatorio para no confundir un problema de conexión con un pendiente.
                if (err?.response?.status === 404) setRecordatorioConfig(true)
            })
            .finally(() => setCargandoEmpresa(false))
    }, [])

    useEffect(() => {
        compraService.proximasAVencer(7)
            .then(({ data }) => setCuentasPorVencer(data))
            .catch(() => setCuentasPorVencer([]))
    }, [])

    // Acceso real = plan lo incluye Y el rol tiene al menos lectura en ese módulo
    // Y, si el ítem lo requiere, el POS está prendido en Configuración.
    // 'modulo: null' (como Dashboard) no depende del rol, solo del plan.
    const tieneAccesoCompleto = (item: { planes: number[]; modulo: any; requierePos?: boolean }) =>
        item.planes.includes(planId) && (item.modulo === null || puedeVer(usuario?.rol, item.modulo))
        && (!item.requierePos || posHabilitado)

    const menuItems = todosLosModulos.map((modulo) => {
        const tieneAcceso = tieneAccesoCompleto(modulo)

        if (modulo.children) {
            return {
                key: modulo.key,
                icon: modulo.icon,
                label: (
                    <span style={{ color: tieneAcceso ? colors.sidebarText : colors.sidebarTextMuted }}>
                        {modulo.label}
                    </span>
                ),
                disabled: !tieneAcceso,
                children: modulo.children.map((hijo) => ({
                    key: hijo.key,
                    label: (
                        <span style={{ color: tieneAcceso ? 'inherit' : colors.sidebarTextMuted }}>
                            {hijo.label}
                        </span>
                    ),
                    disabled: !tieneAccesoCompleto(hijo),
                })),
            }
        }

        return {
            key: modulo.key,
            icon: modulo.icon,
            label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: tieneAcceso ? 'inherit' : colors.sidebarTextMuted }}>{modulo.label}</span>
                    {!tieneAcceso && <LockOutlined style={{ color: colors.sidebarTextMuted, fontSize: 11 }} />}
                </div>
            ),
            disabled: !tieneAcceso,
        }
    })

    const onMenuClick = ({ key }: { key: string }) => {
        let modulo = todosLosModulos.find(m => m.key === key)

        if (!modulo) {
            for (const m of todosLosModulos) {
                if (m.children) {
                    const hijo = m.children.find((h: any) => h.key === key)
                    if (hijo) {
                        modulo = hijo as any
                        break
                    }
                }
            }
        }

        if (modulo && !tieneAccesoCompleto(modulo)) return
        navigate(key)
    }

    // ─── Búsqueda de módulos (lupa del header) ──────────────────────
    const opcionesBusqueda = useMemo(() => {
        const flat: { key: string; label: string; disabled: boolean }[] = []
        todosLosModulos.forEach((m) => {
            if (m.children) {
                m.children.forEach((h) => flat.push({ key: h.key, label: h.label, disabled: !tieneAccesoCompleto(h) }))
            } else {
                flat.push({ key: m.key, label: m.label, disabled: !tieneAccesoCompleto(m) })
            }
        })
        return flat
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planId, usuario?.rol, posHabilitado])

    const resultadosBusqueda = busqueda
        ? opcionesBusqueda.filter(o => o.label.toLowerCase().includes(busqueda.toLowerCase()))
        : []

    const irAResultado = (key: string, disabled: boolean) => {
        if (disabled) return
        navigate(key)
        setBusqueda('')
    }

    // ─── Menú combinado: empresa + sesión de usuario ────────────────
    const empresaMenu = {
        items: [
            {
                key: 'sesion',
                label: <span style={{ fontSize: 12, color: colors.textMuted }}>Sesión de <b>{usuario?.nombre || 'usuario'}</b></span>,
                disabled: true,
            },
            { type: 'divider' as const },
            { key: 'perfil', icon: <UserOutlined />, label: 'Mi perfil' },
            { key: 'config', icon: <SettingOutlined />, label: 'Configuración de la empresa' },
            ...(usuario?.rol === 'SUPERADMIN'
                ? [{ key: 'admin', icon: <CrownOutlined />, label: 'Panel de super admin' }]
                : []),
            { type: 'divider' as const },
            { key: 'logout', icon: <LogoutOutlined />, label: 'Cerrar sesión', danger: true },
        ],
        onClick: ({ key }: { key: string }) => {
            if (key === 'logout') {
                logout()
                navigate('/login')
            } else if (key === 'config') {
                navigate('/configuracion')
            } else if (key === 'admin') {
                navigate('/admin/empresas')
            }
        }
    }

    const planNombre: Record<number, string> = { 1: 'Básico', 2: 'Profesional', 3: 'Empresarial' }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <div
                style={{
                    background: colors.sidebarBg, position: 'fixed', height: '100vh',
                    left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column',
                    width: SIDEBAR_WIDTH, overflow: 'hidden',
                    boxShadow: '2px 0 6px rgba(0,0,0,.03), 6px 0 30px rgba(0,0,0,.06)',
                }}
            >
                {/* Logo — recortado a la altura del riel, sin distorsión */}
                <div style={{
                    padding: '18px 0', display: 'flex', justifyContent: 'center',
                    borderBottom: `1px solid ${colors.sidebarBorder}`,
                }}>
                    <img src={logoPlutus} alt="Plutus365" style={{ height: 28, width: 'auto' }} />
                </div>

                {/* Menú — icon-only, tooltip nativo de AntD al pasar el mouse */}
                <div
                    style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
                >
                    <ConfigProvider
                        theme={{
                            components: {
                                Menu: {
                                    itemBg: colors.sidebarBg,
                                    itemColor: colors.sidebarText,
                                    iconSize: 18,
                                    itemHoverBg: colors.sidebarHoverBg,
                                    itemHoverColor: colors.heading,
                                    itemSelectedBg: colors.sidebarActiveBg,
                                    itemSelectedColor: colors.sidebarActiveText,
                                    subMenuItemBg: colors.sidebarBg,
                                    itemBorderRadius: 16,
                                    itemMarginInline: 12,
                                },
                            },
                        }}
                    >
                        <Menu
                            theme="light"
                            mode="inline"
                            inlineCollapsed
                            selectedKeys={[location.pathname]}
                            items={menuItems}
                            onClick={onMenuClick}
                            style={{ border: 'none', paddingTop: 10, width: SIDEBAR_WIDTH }}
                        />
                    </ConfigProvider>
                </div>

                {/* Empresa + sesión de usuario — tooltip con el detalle, click abre el menú */}
                <Dropdown menu={empresaMenu} trigger={['click']} placement="topLeft" arrow>
                    <div>
                        <Tooltip
                            placement="right"
                            title={
                                <>
                                    <div style={{ fontWeight: 600 }}>{nombreEmpresa || 'Configurar empresa'}</div>
                                    <div style={{ opacity: 0.75, fontSize: 12 }}>Plan {planNombre[planId]} · {usuario?.nombre || 'Usuario'}</div>
                                </>
                            }
                        >
                            <div className="sidebar-footer-trigger" style={{
                                borderTop: `1px solid ${colors.sidebarBorder}`,
                                padding: '14px 0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer',
                            }}>
                                {cargandoEmpresa ? (
                                    <Spin size="small" />
                                ) : (
                                    <Avatar
                                        size={32}
                                        icon={<ShopOutlined />}
                                        style={{ background: colors.sidebarActiveBg, color: colors.sidebarActiveText, flexShrink: 0 }}
                                    />
                                )}
                            </div>
                        </Tooltip>
                    </div>
                </Dropdown>
            </div>

            <Layout style={{ marginLeft: SIDEBAR_WIDTH }}>
                <Header style={{
                    background: colors.cardBg, padding: '0 24px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: '0 2px 6px rgba(0,0,0,.03)', position: 'sticky', top: 0, zIndex: 99, gap: 16,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        {/* Buscador de módulos */}
                        <AutoComplete
                            value={busqueda}
                            onChange={setBusqueda}
                            onSelect={(_, option: any) => irAResultado(option.key, option.disabled)}
                            options={resultadosBusqueda.map(o => ({
                                value: o.label,
                                key: o.key,
                                disabled: o.disabled,
                                label: (
                                    <span style={{ color: o.disabled ? colors.textMuted : colors.heading }}>
                                        {o.label} {o.disabled && <LockOutlined style={{ fontSize: 10, marginLeft: 4 }} />}
                                    </span>
                                ),
                            }))}
                            style={{ width: 260 }}
                            popupMatchSelectWidth={280}
                        >
                            <Input
                                prefix={<SearchOutlined style={{ color: colors.textMuted }} />}
                                placeholder="Buscar un módulo..."
                                style={{ background: colors.pageBg }}
                                onPressEnter={() => {
                                    const primero = resultadosBusqueda.find(o => !o.disabled)
                                    if (primero) irAResultado(primero.key, false)
                                }}
                            />
                        </AutoComplete>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tooltip title={modo === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
                            <Button
                                type="text"
                                icon={modo === 'dark'
                                    ? <BulbFilled style={{ fontSize: 18, color: colors.orange }} />
                                    : <BulbOutlined style={{ fontSize: 18, color: colors.heading }} />}
                                onClick={alternarTema}
                            />
                        </Tooltip>

                        <Tooltip title="Crear una cotización para tu cliente">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => navigate('/ventas/cotizaciones')}
                            >
                                Nueva factura
                            </Button>
                        </Tooltip>

                        <Dropdown
                            trigger={['click']}
                            placement="bottomRight"
                            popupRender={() => (
                                <div style={{
                                    width: 320, background: colors.cardBg, borderRadius: 18,
                                    boxShadow: '0 4px 10px rgba(0,0,0,.04), 0 20px 45px rgba(0,0,0,.10)', padding: 8,
                                }}>
                                    <div style={{ padding: '6px 10px', fontWeight: 700, color: colors.heading, fontSize: 13 }}>
                                        Cuentas por pagar próximas a vencer
                                    </div>
                                    {cuentasPorVencer.length === 0 ? (
                                        <div style={{ padding: '16px 10px', color: colors.textMuted, fontSize: 12.5, textAlign: 'center' }}>
                                            No tienes créditos a proveedores por vencer en los próximos 7 días.
                                        </div>
                                    ) : (
                                        cuentasPorVencer.map((c) => {
                                            const vencido = c.fechaVencimientoCredito && new Date(c.fechaVencimientoCredito) < new Date()
                                            return (
                                                <div
                                                    key={c.compraId}
                                                    onClick={() => navigate(`/compras/ver/${c.compraId}`)}
                                                    style={{
                                                        padding: '8px 10px', borderRadius: 14, cursor: 'pointer',
                                                        borderBottom: `1px solid ${colors.border}`,
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                                                        <span style={{ fontWeight: 600 }}>{c.proveedorNombre}</span>
                                                        <span style={{ color: vencido ? colors.red : colors.orange, fontWeight: 700 }}>
                                                            ${(c.saldoPendiente ?? 0).toLocaleString('es-CO')}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 11, color: colors.textMuted }}>
                                                        {c.numeroComprobante} · {vencido ? 'Vencido' : 'Vence'} {c.fechaVencimientoCredito}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            )}
                        >
                            <Badge count={cuentasPorVencer.length} size="small">
                                <Button type="text" icon={<BellOutlined style={{ fontSize: 18, color: colors.heading }} />} />
                            </Badge>
                        </Dropdown>

                        <Tooltip title="Configuración">
                            <Button
                                type="text"
                                icon={<SettingOutlined style={{ fontSize: 18, color: colors.heading }} />}
                                onClick={() => navigate('/configuracion')}
                            />
                        </Tooltip>
                    </div>
                </Header>

                <Content style={{ padding: 24, background: colors.pageBg, minHeight: 'calc(100vh - 64px)' }}>
                    <div key={location.pathname} className="page-enter">
                        <Outlet />
                    </div>
                </Content>
            </Layout>

            {/* Recordatorio: la empresa nunca guardó su configuración (NIT, régimen
                fiscal...). Se puede posponer, no bloquea — solo recuerda. */}
            <Modal
                open={recordatorioConfig}
                onCancel={() => setRecordatorioConfig(false)}
                footer={null}
                centered
                width={420}
            >
                <div style={{ textAlign: 'center', padding: '8px 4px 0' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%', background: colors.primaryLight,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                    }}>
                        <SettingOutlined style={{ fontSize: 24, color: colors.primary }} />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: colors.heading, margin: '0 0 8px' }}>
                        Configura los datos de tu empresa
                    </h3>
                    <p style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 22, lineHeight: 1.5 }}>
                        Todavía no has guardado la información de tu empresa (NIT, régimen fiscal,
                        dirección). La necesitas para facturar y para que tus documentos salgan completos.
                    </p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <Button onClick={() => setRecordatorioConfig(false)}>
                            Más tarde
                        </Button>
                        <Button
                            type="primary"
                            onClick={() => { setRecordatorioConfig(false); navigate('/configuracion') }}
                            style={{ background: colors.primary, borderColor: colors.primary, fontWeight: 600 }}
                        >
                            Configurar ahora
                        </Button>
                    </div>
                </div>
            </Modal>
        </Layout>
    )
}
