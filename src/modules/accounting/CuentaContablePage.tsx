import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Input, Spin, Empty, Button, Select, message, Modal, Form, Tag,
    Tooltip, Collapse, Drawer
} from 'antd'
import {
    SearchOutlined, PlusOutlined, BankOutlined, DeleteOutlined,
    WalletOutlined, CreditCardOutlined, CrownOutlined, RiseOutlined,
    FallOutlined, ShoppingOutlined, InfoCircleOutlined, EyeOutlined, BookOutlined, FundOutlined, ApartmentOutlined
} from '@ant-design/icons'
import {
    cuentaContableService, NIVEL_LABEL, DETALLE_SALDOS_LABEL, LONGITUD_NIVEL,
    type CuentaContable, type NivelCuenta, type DetalleSaldos
} from '../../shared/services/contabilidadService'
import { colors } from '../../shared/theme/colors'

const NIVELES_ORDEN: NivelCuenta[] = ['CLASE', 'GRUPO', 'CUENTA', 'SUBCUENTA', 'AUXILIAR']

// Color + ícono por Clase, para que cada una se distinga de un vistazo.
const ESTILO_CLASE: Record<string, { color: string; bg: string; icono: React.ReactNode }> = {
    '1': { color: colors.primary, bg: colors.primaryLight, icono: <WalletOutlined /> },
    '2': { color: colors.red, bg: colors.redLight, icono: <CreditCardOutlined /> },
    '3': { color: colors.purple, bg: colors.purpleLight, icono: <CrownOutlined /> },
    '4': { color: '#3B82F6', bg: '#EEF4FF', icono: <RiseOutlined /> },
    '5': { color: colors.orange, bg: colors.orangeLight, icono: <FallOutlined /> },
    '6': { color: '#0EA5A5', bg: '#E8FBFA', icono: <ShoppingOutlined /> },
}
const estiloClase = (codigo: string) =>
    ESTILO_CLASE[codigo] || { color: colors.textSecondary, bg: colors.pageBg, icono: <BankOutlined /> }

export default function CuentaContablePage() {
    const navigate = useNavigate()
    const [cuentas, setCuentas] = useState<CuentaContable[]>([])
    const [loading, setLoading] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const [claseSeleccionada, setClaseSeleccionada] = useState<string | null>(null)

    const [seleccionada, setSeleccionada] = useState<CuentaContable | null>(null)
    const [drawerVisible, setDrawerVisible] = useState(false)
    const [guardando, setGuardando] = useState(false)

    const [modalVisible, setModalVisible] = useState(false)
    const [form] = Form.useForm()
    const [creando, setCreando] = useState(false)
    const [padreParaCrear, setPadreParaCrear] = useState<CuentaContable | null>(null)
    const [sufijoCodigo, setSufijoCodigo] = useState('')

    const cargar = () => {
        setLoading(true)
        cuentaContableService.listar()
            .then(({ data }) => setCuentas(data))
            .catch(() => message.error('Error al cargar el plan de cuentas'))
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    const clases = useMemo(() => cuentas.filter(c => c.nivel === 'CLASE').sort((a, b) => a.codigo.localeCompare(b.codigo)), [cuentas])
    const porPadre = useMemo(() => {
        const mapa = new Map<string, CuentaContable[]>()
        cuentas.forEach(c => {
            if (!c.codigoPadre) return
            if (!mapa.has(c.codigoPadre)) mapa.set(c.codigoPadre, [])
            mapa.get(c.codigoPadre)!.push(c)
        })
        mapa.forEach(lista => lista.sort((a, b) => a.codigo.localeCompare(b.codigo)))
        return mapa
    }, [cuentas])
    const contarDescendientes = (codigo: string) => cuentas.filter(c => c.codigo.startsWith(codigo) && c.codigo !== codigo).length

    const buscando = busqueda.trim() !== ''
    const resultadosBusqueda = useMemo(() => {
        if (!buscando) return []
        const termino = busqueda.trim().toLowerCase()
        const porCodigo = new Map(cuentas.map(c => [c.codigo, c]))
        const rutaTexto = (c: CuentaContable) => {
            const partes: string[] = []
            let actual: CuentaContable | undefined = c
            while (actual) {
                partes.unshift(actual.nombre)
                actual = actual.codigoPadre ? porCodigo.get(actual.codigoPadre) : undefined
            }
            return partes.join(' › ')
        }
        return cuentas
            .filter(c => c.codigo.includes(termino) || c.nombre.toLowerCase().includes(termino))
            .sort((a, b) => a.codigo.localeCompare(b.codigo))
            .map(c => ({ cuenta: c, ruta: rutaTexto(c) }))
    }, [buscando, busqueda, cuentas])

    // ── Cadena Clase → Grupo → Cuenta → Subcuenta → Auxiliar (para el Drawer) ──
    const cadena = useMemo(() => {
        const resultado: Partial<Record<NivelCuenta, CuentaContable>> = {}
        let actual = seleccionada
        const porCodigo = new Map(cuentas.map(c => [c.codigo, c]))
        while (actual) {
            resultado[actual.nivel] = actual
            actual = actual.codigoPadre ? porCodigo.get(actual.codigoPadre) || null : null
        }
        return resultado
    }, [seleccionada, cuentas])

    const siguienteNivel = (nivel: NivelCuenta): NivelCuenta | null => {
        const idx = NIVELES_ORDEN.indexOf(nivel)
        return idx < NIVELES_ORDEN.length - 1 ? NIVELES_ORDEN[idx + 1] : null
    }

    const sugerirSufijo = (padre: CuentaContable, nivelHijo: NivelCuenta) => {
        const longitudSufijo = LONGITUD_NIVEL[nivelHijo] - padre.codigo.length
        const hermanos = porPadre.get(padre.codigo)?.filter(c => c.nivel === nivelHijo) || []
        let maximo = 0
        hermanos.forEach(h => {
            const sufijo = parseInt(h.codigo.slice(padre.codigo.length), 10)
            if (!isNaN(sufijo) && sufijo > maximo) maximo = sufijo
        })
        return String(maximo + 1).padStart(longitudSufijo, '0')
    }

    const abrirDrawer = (cuenta: CuentaContable) => {
        setSeleccionada(cuenta)
        setDrawerVisible(true)
    }

    const abrirModalCrear = (padre: CuentaContable | null) => {
        form.resetFields()
        setPadreParaCrear(padre)
        if (padre) {
            const nivelHijo = siguienteNivel(padre.nivel)
            if (nivelHijo) setSufijoCodigo(sugerirSufijo(padre, nivelHijo))
        } else {
            setSufijoCodigo('')
        }
        setModalVisible(true)
    }

    const actualizarCampo = async (campo: 'categoria' | 'detalleSaldos', valor: string) => {
        if (!seleccionada) return
        setGuardando(true)
        try {
            const { data } = await cuentaContableService.actualizar(seleccionada.codigo, { [campo]: valor })
            setSeleccionada(data)
            setCuentas(prev => prev.map(c => c.codigo === data.codigo ? data : c))
            message.success('Guardado')
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar')
        } finally {
            setGuardando(false)
        }
    }

    const eliminarCuenta = async (codigo: string) => {
        try {
            await cuentaContableService.eliminar(codigo)
            message.success('Cuenta eliminada')
            setDrawerVisible(false)
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo eliminar')
        }
    }

    const crearCuenta = async (values: any) => {
        const codigoFinal = padreParaCrear ? `${padreParaCrear.codigo}${sufijoCodigo}` : values.codigo
        setCreando(true)
        try {
            const { data } = await cuentaContableService.crear({ ...values, codigo: codigoFinal })
            message.success(`Cuenta ${data.codigo} creada`)
            setModalVisible(false)
            setPadreParaCrear(null)
            form.resetFields()
            cargar()
            abrirDrawer(data)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al crear la cuenta')
        } finally {
            setCreando(false)
        }
    }

    // ── Fila reutilizable de una cuenta dentro del acordeón ──
    const FilaCuenta = ({ cuenta }: { cuenta: CuentaContable }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: colors.heading, minWidth: 70 }}>
                {cuenta.codigo}
            </span>
            <span style={{ flex: 1, color: cuenta.activa ? colors.heading : colors.textMuted }}>{cuenta.nombre}</span>
            {cuenta.esTransaccional && <Tag color="green" style={{ fontSize: 10 }}>Transaccional</Tag>}
            {cuenta.personalizada && <Tag color="purple" style={{ fontSize: 10 }}>Personalizada</Tag>}
            <Tooltip title="Ver detalle">
                <Button
                    type="text" size="small" icon={<EyeOutlined />}
                    onClick={(e) => { e.stopPropagation(); abrirDrawer(cuenta) }}
                />
            </Tooltip>
        </div>
    )

    // ── Acordeón anidado: Grupo → Cuenta → Subcuenta → Auxiliar ──
    const renderNivelAcordeon = (padre: CuentaContable) => {
        const hijos = porPadre.get(padre.codigo) || []
        if (hijos.length === 0) return null

        if (hijos[0].nivel === 'AUXILIAR') {
            return (
                <div style={{ paddingLeft: 4 }}>
                    {hijos.map(h => (
                        <div key={h.codigo} onClick={() => abrirDrawer(h)} style={{ cursor: 'pointer' }}>
                            <FilaCuenta cuenta={h} />
                        </div>
                    ))}
                </div>
            )
        }

        return (
            <Collapse
                accordion
                ghost
                items={hijos.map(hijo => ({
                    key: hijo.codigo,
                    label: <FilaCuenta cuenta={hijo} />,
                    children: renderNivelAcordeon(hijo) || (
                        <span
                            onClick={() => abrirModalCrear(hijo)}
                            style={{ color: colors.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                            + Crear {NIVEL_LABEL[siguienteNivel(hijo.nivel)!]}
                        </span>
                    ),
                }))}
            />
        )
    }

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <BankOutlined style={{ marginRight: 8 }} />
                        Cuenta contable (PUC)
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        {cuentas.length} cuentas · basado en el Plan Único de Cuentas colombiano
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                        icon={<BookOutlined />}
                        onClick={() => navigate('/contabilidad/asientos')}
                        style={{ borderRadius: 14, fontWeight: 600 }}
                    >
                        Ver asientos contables
                    </Button>
                    <Button
                        icon={<FundOutlined />}
                        onClick={() => navigate('/contabilidad/estados-financieros')}
                        style={{ borderRadius: 14, fontWeight: 600 }}
                    >
                        Estados financieros
                    </Button>
                    <Button
                        icon={<ApartmentOutlined />}
                        onClick={() => navigate('/contabilidad/centros-costo')}
                        style={{ borderRadius: 14, fontWeight: 600 }}
                    >
                        Centros de costo
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => abrirModalCrear(null)}
                        style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                    >
                        Nueva cuenta
                    </Button>
                </div>
            </div>

            <Input
                placeholder="Buscar por código o nombre en todo el plan de cuentas..."
                prefix={<SearchOutlined style={{ color: colors.textMuted }} />}
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                allowClear
                size="large"
                style={{ marginBottom: 20, maxWidth: 480, borderRadius: 14 }}
            />

            {buscando ? (
                /* ── Resultados de búsqueda: lista plana con la ruta completa ── */
                <div style={{ background: colors.cardBg, borderRadius: 18, padding: 16, boxShadow: '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)' }}>
                    {resultadosBusqueda.length === 0 ? (
                        <Empty description="Sin resultados" style={{ margin: '30px 0' }} />
                    ) : (
                        resultadosBusqueda.map(({ cuenta, ruta }) => (
                            <div
                                key={cuenta.codigo}
                                onClick={() => abrirDrawer(cuenta)}
                                style={{ padding: '10px 8px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer' }}
                            >
                                <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>{ruta}</div>
                                <FilaCuenta cuenta={cuenta} />
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <>
                    {/* ── Tarjetas por Clase ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                        {clases.map(clase => {
                            const estilo = estiloClase(clase.codigo)
                            const activa = claseSeleccionada === clase.codigo
                            return (
                                <div
                                    key={clase.codigo}
                                    onClick={() => setClaseSeleccionada(activa ? null : clase.codigo)}
                                    style={{
                                        background: estilo.bg, border: `2px solid ${activa ? estilo.color : 'transparent'}`,
                                        borderRadius: 22, padding: 18, cursor: 'pointer', transition: 'border-color 0.15s',
                                        position: 'relative',
                                    }}
                                >
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 16, background: colors.cardBg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: estilo.color, fontSize: 18, marginBottom: 10,
                                    }}>
                                        {estilo.icono}
                                    </div>
                                    <div style={{ fontWeight: 700, color: colors.heading, fontSize: 14.5 }}>{clase.nombre}</div>
                                    <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                                        Clase {clase.codigo} · {contarDescendientes(clase.codigo)} cuentas
                                    </div>
                                    <Tooltip title="Ver detalle de la Clase">
                                        <Button
                                            type="text" size="small" icon={<InfoCircleOutlined />}
                                            onClick={(e) => { e.stopPropagation(); abrirDrawer(clase) }}
                                            style={{ position: 'absolute', top: 10, right: 10, color: estilo.color }}
                                        />
                                    </Tooltip>
                                </div>
                            )
                        })}
                    </div>

                    {/* ── Acordeón de la Clase seleccionada ── */}
                    {claseSeleccionada && (
                        <div style={{
                            background: colors.cardBg, borderRadius: 18,
                            padding: '8px 16px', borderTop: `3px solid ${estiloClase(claseSeleccionada).color}`,
                            boxShadow: '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)',
                        }}>
                            {renderNivelAcordeon(clases.find(c => c.codigo === claseSeleccionada)!) || (
                                <Empty description="Esta clase todavía no tiene grupos" style={{ margin: '20px 0' }} />
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── Drawer de detalle ── */}
            <Drawer
                title={seleccionada && (
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        <span style={{ fontFamily: 'monospace', color: colors.primary, marginRight: 8 }}>{seleccionada.codigo}</span>
                        {seleccionada.nombre}
                    </span>
                )}
                open={drawerVisible}
                onClose={() => setDrawerVisible(false)}
                width={420}
            >
                {seleccionada && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 8, marginBottom: 20, fontSize: 12.5 }}>
                            {NIVELES_ORDEN.map(nivel => {
                                const cta = cadena[nivel]
                                if (!cta) return null
                                return (
                                    <div key={nivel} style={{ display: 'contents' }}>
                                        <div style={{ color: colors.textSecondary }}>{NIVEL_LABEL[nivel]}</div>
                                        <div style={{ fontFamily: 'monospace' }}>{cta.codigo} · {cta.nombre}</div>
                                    </div>
                                )
                            })}
                        </div>

                        {siguienteNivel(seleccionada.nivel) && (
                            <Button
                                block type="dashed"
                                onClick={() => abrirModalCrear(seleccionada)}
                                style={{ marginBottom: 20, borderColor: colors.primary, color: colors.primary }}
                                icon={<PlusOutlined />}
                            >
                                Crear {NIVEL_LABEL[siguienteNivel(seleccionada.nivel)!]}
                            </Button>
                        )}

                        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
                            <div style={{ fontWeight: 700, color: colors.heading, marginBottom: 12 }}>
                                Característica transaccional
                                {guardando && <Spin size="small" style={{ marginLeft: 10 }} />}
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Naturaleza</div>
                                <Tag color={seleccionada.naturaleza === 'DEBITO' ? 'blue' : 'orange'}>
                                    {seleccionada.naturaleza === 'DEBITO' ? 'Débito' : 'Crédito'}
                                </Tag>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Categoría</div>
                                <Input
                                    defaultValue={seleccionada.categoria}
                                    placeholder="Sin asignar"
                                    onBlur={(e) => e.target.value !== (seleccionada.categoria || '') && actualizarCampo('categoria', e.target.value)}
                                />
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                                    Detallar saldos de cartera o proveedores
                                </div>
                                <Select<DetalleSaldos>
                                    value={seleccionada.detalleSaldos || 'SIN_DETALLE'}
                                    onChange={(v) => actualizarCampo('detalleSaldos', v)}
                                    style={{ width: '100%' }}
                                    options={Object.entries(DETALLE_SALDOS_LABEL).map(([value, label]) => ({ value, label }))}
                                />
                            </div>

                            {seleccionada.personalizada ? (
                                <Button
                                    danger icon={<DeleteOutlined />}
                                    onClick={() => eliminarCuenta(seleccionada.codigo)}
                                    style={{ marginTop: 10 }}
                                >
                                    Eliminar esta cuenta
                                </Button>
                            ) : (
                                <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 10 }}>
                                    Cuenta del PUC base — no se puede eliminar, pero puedes desactivarla.
                                </div>
                            )}
                        </div>
                    </>
                )}
            </Drawer>

            {/* ── Modal crear cuenta ── */}
            <Modal
                title={
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        {padreParaCrear
                            ? `Nueva ${NIVEL_LABEL[siguienteNivel(padreParaCrear.nivel) || 'AUXILIAR']} bajo ${padreParaCrear.codigo} · ${padreParaCrear.nombre}`
                            : 'Nueva cuenta contable'}
                    </span>
                }
                open={modalVisible}
                onCancel={() => { setModalVisible(false); setPadreParaCrear(null) }}
                footer={null}
                destroyOnHidden
            >
                {!padreParaCrear && (
                    <p style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: -8 }}>
                        El código debe empezar con el código de una cuenta que ya exista (por ejemplo, para crear
                        un auxiliar nuevo bajo la subcuenta <code>110505</code>, usa algo como <code>11050502</code>).
                    </p>
                )}
                <Form form={form} layout="vertical" onFinish={crearCuenta}>
                    {padreParaCrear ? (
                        <Form.Item label="Código" required>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{
                                    fontFamily: 'monospace', fontWeight: 700, background: colors.pageBg,
                                    border: `1px solid ${colors.border}`, borderRight: 'none',
                                    borderRadius: '8px 0 0 8px', padding: '4px 10px', color: colors.textSecondary,
                                }}>
                                    {padreParaCrear.codigo}
                                </span>
                                <Input
                                    value={sufijoCodigo}
                                    onChange={(e) => setSufijoCodigo(e.target.value.replace(/\D/g, ''))}
                                    style={{ borderRadius: '0 8px 8px 0', fontFamily: 'monospace', fontWeight: 700 }}
                                />
                            </div>
                        </Form.Item>
                    ) : (
                        <Form.Item name="codigo" label="Código" rules={[{ required: true, message: 'Requerido' }, { pattern: /^\d+$/, message: 'Solo números' }]}>
                            <Input placeholder="11050502" />
                        </Form.Item>
                    )}
                    <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Caja sucursal norte" />
                    </Form.Item>
                    <Form.Item name="categoria" label="Categoría (opcional)">
                        <Input placeholder="Caja - Bancos" />
                    </Form.Item>
                    <Form.Item name="detalleSaldos" label="Detallar saldos de cartera o proveedores">
                        <Select
                            options={Object.entries(DETALLE_SALDOS_LABEL).map(([value, label]) => ({ value, label }))}
                            defaultValue="SIN_DETALLE"
                        />
                    </Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => { setModalVisible(false); setPadreParaCrear(null) }}>Cancelar</Button>
                        <Button
                            type="primary" htmlType="submit" loading={creando}
                            style={{ background: colors.primary, borderColor: colors.primary }}
                        >
                            Crear cuenta
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}
