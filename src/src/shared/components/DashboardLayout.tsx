import { useState, useEffect, useMemo } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Button, Tag, ConfigProvider, Spin, AutoComplete, Input, Tooltip } from 'antd'
import {
    DashboardOutlined, ShoppingCartOutlined, InboxOutlined,
    TeamOutlined, CarOutlined, AccountBookOutlined,
    FileTextOutlined, UserOutlined, SettingOutlined,
    LogoutOutlined, BellOutlined, LockOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
    ShopOutlined, DownOutlined, SearchOutlined, PlusOutlined, BarChartOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { empresaService } from '../services/empresaService'
import { compraService, type Compra } from '../services/compraService'
import { colors } from '../theme/colors'
import { puedeVer } from '../utils/permisos'
import logoPlutus from '../../assets/logo.png'

const { Header, Content } = Layout

const todosLosModulos = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard', planes: [1, 2, 3], modulo: null },
    { key: '/ventas', icon: <ShoppingCartOutlined />, label: 'Venta POS', planes: [1, 2, 3], modulo: 'VENTAS' as const },
    {
        key: 'facturacion',
        icon: <FileTextOutlined />,
        label: 'Facturación',
        planes: [2, 3],
        modulo: 'FACTURACION' as const,
        children: [
            { key: '/facturacion', label: 'Factura de venta / Ingresos', planes: [2, 3], modulo: 'FACTURACION' as const },
            { key: '/facturacion/notas-credito', label: 'Nota crédito', planes: [2, 3], modulo: 'FACTURACION' as const },
            { key: '/ventas/cotizaciones', label: 'Cotización', planes: [2, 3], modulo: 'VENTAS' as const },
            { key: '/ventas/recurrentes', label: 'Facturación recurrente', planes: [2, 3], modulo: 'VENTAS' as const },
            { key: '/clientes', label: 'Clientes', planes: [1, 2, 3], modulo: 'CLIENTES' as const },
        ]
    },
    { key: '/inventario', icon: <InboxOutlined />, label: 'Inventario', planes: [1, 2, 3], modulo: 'INVENTARIO' as const },
    {
        key: 'compras',
        icon: <CarOutlined />,
        label: 'Compras',
        planes: [2, 3],
        modulo: 'COMPRAS' as const,
        children: [
            { key: '/compras', label: 'Compras y Gastos', planes: [2, 3], modulo: 'COMPRAS' as const },
            { key: '/compras/proveedores', label: 'Proveedores', planes: [2, 3], modulo: 'COMPRAS' as const },
        ]
    },
    { key: '/contabilidad', icon: <AccountBookOutlined />, label: 'Contabilidad', planes: [2, 3], modulo: 'CONTABILIDAD' as const },
    { key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes', planes: [2, 3], modulo: 'VENTAS' as const },
    { key: '/nomina', icon: <UserOutlined />, label: 'Nómina', planes: [3], modulo: 'NOMINA' as const },
    { key: '/configuracion', icon: <SettingOutlined />, label: 'Configuración', planes: [1, 2, 3], modulo: 'CONFIGURACION' as const },
]

export default function DashboardLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { usuario, logout } = useAuthStore()
    const [collapsed, setCollapsed] = useState(false)
    const [nombreEmpresa, setNombreEmpresa] = useState<string | null>(null)
    const [cargandoEmpresa, setCargandoEmpresa] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const [cuentasPorVencer, setCuentasPorVencer] = useState<Compra[]>([])

    const planId = usuario?.planId ?? 1

    useEffect(() => {
        empresaService.obtener()
            .then(({ data }) => setNombreEmpresa(data.nombreComercial || data.razonSocial || data.nombres || null))
            .catch(() => setNombreEmpresa(null))
            .finally(() => setCargandoEmpresa(false))
    }, [])

    useEffect(() => {
        compraService.proximasAVencer(7)
            .then(({ data }) => setCuentasPorVencer(data))
            .catch(() => setCuentasPorVencer([]))
    }, [])

    // Acceso real = plan lo incluye Y el rol tiene al menos lectura en ese módulo.
    // 'modulo: null' (como Dashboard) no depende del rol, solo del plan.
    const tieneAccesoCompleto = (item: { planes: number[]; modulo: any }) =>
        item.planes.includes(planId) && (item.modulo === null || puedeVer(usuario?.rol, item.modulo))

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
    }, [planId, usuario?.rol])

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
            { type: 'divider' as const },
            { key: 'logout', icon: <LogoutOutlined />, label: 'Cerrar sesión', danger: true },
        ],
        onClick: ({ key }: { key: string }) => {
            if (key === 'logout') {
                logout()
                navigate('/login')
            } else if (key === 'config') {
                navigate('/configuracion')
            }
        }
    }

    const planNombre: Record<number, string> = { 1: 'Básico', 2: 'Profesional', 3: 'Empresarial' }
    const planColor: Record<number, string> = { 1: 'default', 2: 'purple', 3: 'gold' }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <div
                style={{
                    background: colors.sidebarBg, position: 'fixed', height: '100vh',
                    left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column',
                    width: collapsed ? 80 : 230, transition: 'width 0.2s', overflow: 'hidden',
                }}
            >
                {/* Logo */}
                <div style={{
                    padding: collapsed ? '16px 12px' : '20px 20px 16px',
                    borderBottom: `1px solid ${colors.sidebarBorder}`,
                }}>
                    <img src={logoPlutus} alt="Plutus365" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    {!collapsed && (
                        <Tag color={planColor[planId]} style={{ fontSize: 10, lineHeight: '16px', marginTop: 10 }}>
                            Plan {planNombre[planId]}
                        </Tag>
                    )}
                </div>

                {/* Menú — misma organización de siempre */}
                <div
                    className="menu-lateral-scroll"
                    style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
                >
                    <style>{`
                        .menu-lateral-scroll::-webkit-scrollbar { width: 6px; }
                        .menu-lateral-scroll::-webkit-scrollbar-track { background: transparent; }
                        .menu-lateral-scroll::-webkit-scrollbar-thumb {
                            background: rgba(255,255,255,0.18);
                            border-radius: 10px;
                        }
                        .menu-lateral-scroll::-webkit-scrollbar-thumb:hover {
                            background: rgba(255,255,255,0.3);
                        }
                        .menu-lateral-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent; }
                    `}</style>
                    <ConfigProvider
                        theme={{
                            components: {
                                Menu: {
                                    darkItemBg: colors.sidebarBg,
                                    darkItemColor: colors.sidebarText,
                                    darkItemHoverBg: colors.sidebarHoverBg,
                                    darkItemHoverColor: '#fff',
                                    darkItemSelectedBg: colors.sidebarActiveBg,
                                    darkItemSelectedColor: colors.sidebarActiveText,
                                    darkSubMenuItemBg: colors.sidebarBg,
                                    itemBorderRadius: 10,
                                    itemMarginInline: 12,
                                },
                            },
                        }}
                    >
                        <Menu
                            theme="dark"
                            mode="inline"
                            selectedKeys={[location.pathname]}
                            items={menuItems}
                            onClick={onMenuClick}
                            style={{ border: 'none', paddingTop: 10 }}
                        />
                    </ConfigProvider>
                </div>

                {/* Empresa + sesión de usuario — sección fija al final del sidebar */}
                <Dropdown menu={empresaMenu} trigger={['click']} placement="topLeft" arrow>
                    <div style={{
                        borderTop: `1px solid ${colors.sidebarBorder}`,
                        padding: collapsed ? '14px 8px' : '14px 16px',
                        display: 'flex', alignItems: 'center', gap: 10,
                        cursor: 'pointer',
                    }}>
                        <Avatar
                            size={32}
                            icon={<ShopOutlined />}
                            style={{ background: colors.sidebarActiveBg, color: colors.sidebarActiveText, flexShrink: 0 }}
                        />
                        {!collapsed && (
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 10.5, color: colors.sidebarTextMuted, lineHeight: 1.2 }}>Empresa</div>
                                {cargandoEmpresa ? (
                                    <Spin size="small" />
                                ) : (
                                    <div style={{
                                        fontSize: 13, fontWeight: 600, color: '#fff',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {nombreEmpresa || 'Configurar empresa'}
                                    </div>
                                )}
                                <div style={{
                                    fontSize: 10.5, color: colors.sidebarTextMuted,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {usuario?.nombre || 'Usuario'}
                                </div>
                            </div>
                        )}
                        {!collapsed && <DownOutlined style={{ color: colors.sidebarTextMuted, fontSize: 11 }} />}
                    </div>
                </Dropdown>
            </div>

            <Layout style={{ marginLeft: collapsed ? 80 : 230, transition: 'all 0.2s' }}>
                <Header style={{
                    background: colors.cardBg, padding: '0 24px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: `1px solid ${colors.border}`, position: 'sticky', top: 0, zIndex: 99, gap: 16,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{ fontSize: 16, color: colors.primary }}
                        />

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
                                style={{ borderRadius: 8, borderColor: colors.border, background: colors.pageBg }}
                                onPressEnter={() => {
                                    const primero = resultadosBusqueda.find(o => !o.disabled)
                                    if (primero) irAResultado(primero.key, false)
                                }}
                            />
                        </AutoComplete>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Tooltip title="Crear una cotización para tu cliente">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => navigate('/ventas/cotizaciones')}
                                style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 8, fontWeight: 600 }}
                            >
                                Nueva factura
                            </Button>
                        </Tooltip>

                        <Dropdown
                            trigger={['click']}
                            placement="bottomRight"
                            popupRender={() => (
                                <div style={{
                                    width: 320, background: colors.cardBg, borderRadius: 10,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 8,
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
                                                        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
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
                    </div>
                </Header>

                <Content style={{ padding: 24, background: colors.pageBg, minHeight: 'calc(100vh - 64px)' }}>
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    )
}
