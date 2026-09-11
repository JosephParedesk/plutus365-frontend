import { useState, useEffect } from 'react'
import {
    Table, Button, Modal, Select, InputNumber, Tag, message, Badge,
    Descriptions, Alert, Popconfirm, Tooltip, Empty
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    DollarOutlined, EyeOutlined, TeamOutlined, PlusOutlined,
    CheckCircleOutlined, DeleteOutlined, DownloadOutlined, ImportOutlined, ThunderboltOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
    nominaService, empleadoService, MESES, COLOR_ESTADO, CONCEPTOS_HORA_EXTRA,
    type Nomina, type NominaDetalle, type Empleado, type NovedadEmpleado, type HoraExtraItem
} from '../../shared/services/nominaService'
import { empresaService, type Empresa } from '../../shared/services/empresaService'
import { exportarExcel } from '../../shared/utils/exportarExcel'
import HorasExtraModal from './HorasExtraModal'
import { nominaElectronicaService, notaAjusteNominaService, type NominaElectronica } from '../../shared/services/facturacionService'
import { SendOutlined, StopOutlined } from '@ant-design/icons'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export default function NominaPage() {
    const navigate = useNavigate()
    const [nominas, setNominas] = useState<Nomina[]>([])
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)

    const [modalLiquidar, setModalLiquidar] = useState(false)
    const [anio, setAnio] = useState(dayjs().year())
    const [mes, setMes] = useState(dayjs().month() + 1)
    const [novedades, setNovedades] = useState<Record<number, NovedadEmpleado>>({})
    const [liquidando, setLiquidando] = useState(false)

    const [detalle, setDetalle] = useState<Nomina | null>(null)
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    useEffect(() => { empresaService.obtener().then(({ data }) => setEmpresa(data)).catch(() => {}) }, [])

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([nominaService.listar(), empleadoService.listar()])
            .then(([rn, re]) => {
                if (rn.status === 'fulfilled') setNominas(rn.value.data)
                if (re.status === 'fulfilled') setEmpleados(re.value.data.filter(e => e.activo))
            })
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    const actualizarNovedad = (empleadoId: number, campo: keyof NovedadEmpleado, valor: number | null) => {
        setNovedades(prev => ({
            ...prev,
            [empleadoId]: { ...prev[empleadoId], [campo]: valor ?? undefined }
        }))
    }

    // Horas extra/recargos: no caben en una celda de tabla (7 tipos posibles por
    // empleado), se editan en un modal aparte.
    const [empleadoHorasExtra, setEmpleadoHorasExtra] = useState<Empleado | null>(null)
    const actualizarHorasExtra = (empleadoId: number, items: HoraExtraItem[]) => {
        setNovedades(prev => ({
            ...prev,
            [empleadoId]: { ...prev[empleadoId], horasExtra: items }
        }))
    }

    const liquidar = async () => {
        setLiquidando(true)
        try {
            const { data } = await nominaService.liquidar(anio, mes, 'MENSUAL', novedades)
            message.success(`Nómina ${data.numero} liquidada`)
            setModalLiquidar(false)
            setNovedades({})
            cargar()
            abrirDetalle(data)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo liquidar la nómina')
        } finally {
            setLiquidando(false)
        }
    }

    const marcarPagada = async (id: number) => {
        try {
            await nominaService.marcarPagada(id)
            message.success('Nómina marcada como pagada')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo actualizar')
        }
    }

    const anular = async (id: number) => {
        try {
            await nominaService.anular(id)
            message.success('Nómina anulada')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo anular')
        }
    }

    // Nómina electrónica DIAN — un empleado por solicitud a Factus.
    const [transmitiendo, setTransmitiendo] = useState<number | null>(null)
    // Por empleadoId, la última nómina electrónica transmitida de este período —
    // se usa para decidir si mostrar "transmitir" o "anular ante la DIAN".
    const [electronicasPorEmpleado, setElectronicasPorEmpleado] = useState<Record<number, NominaElectronica>>({})

    const cargarElectronicas = (nominaId: number) => {
        nominaElectronicaService.porPeriodo(nominaId)
            .then(({ data }) => {
                const mapa: Record<number, NominaElectronica> = {}
                data.forEach(e => {
                    const actual = mapa[e.empleadoId]
                    if (!actual || e.estado === 'ACEPTADA') mapa[e.empleadoId] = e
                })
                setElectronicasPorEmpleado(mapa)
            })
            .catch(() => {})
    }

    const abrirDetalle = (n: Nomina) => { setDetalle(n); cargarElectronicas(n.nominaId) }

    const transmitirNomina = async (nominaId: number, empleadoId: number) => {
        setTransmitiendo(empleadoId)
        try {
            const { data } = await nominaElectronicaService.generar(nominaId, empleadoId)
            message.success(
                data.estado === 'ACEPTADA'
                    ? `Nómina electrónica ${data.numeroDocumento} aceptada por la DIAN`
                    : `Nómina electrónica ${data.numeroDocumento}: ${data.estado}`
            )
            cargarElectronicas(nominaId)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo transmitir la nómina electrónica')
        } finally {
            setTransmitiendo(null)
        }
    }

    const [anulando, setAnulando] = useState<number | null>(null)
    const anularNominaElectronica = async (nominaId: number, empleadoId: number, nominaElectronicaId: number) => {
        setAnulando(empleadoId)
        try {
            await notaAjusteNominaService.emitir(nominaElectronicaId)
            message.success('Nómina electrónica anulada ante la DIAN')
            cargarElectronicas(nominaId)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo anular la nómina electrónica')
        } finally {
            setAnulando(null)
        }
    }

    const descargarDetalle = async (n: Nomina) => {
        const filas = n.detalles.map(d => ({
            documento: d.numeroDocumento, empleado: d.nombreEmpleado, cargo: d.cargo || '',
            dias: d.diasTrabajados, sueldo: d.sueldo, auxTransporte: d.auxilioTransporte,
            horasExtra: (d.horasExtra || []).reduce((s, i) => s + (i.valor || 0), 0),
            comisiones: d.comisiones, bonificaciones: d.bonificaciones, totalDevengado: d.totalDevengado,
            ibc: d.ibc, salud: d.saludEmpleado, pension: d.pensionEmpleado, fondoSolidaridad: d.fondoSolidaridad,
            retefuente: d.retencionFuente, prestamos: d.prestamos, totalDeducciones: d.totalDeducciones,
            netoPagar: d.netoPagar, saludEmpleador: d.saludEmpleador, pensionEmpleador: d.pensionEmpleador,
            arl: d.arl, sena: d.sena, icbf: d.icbf, cajaCompensacion: d.cajaCompensacion,
            exonerado: d.exonerado ? 'Sí' : 'No', provCesantias: d.provCesantias,
            provIntCesantias: d.provInteresesCesantias, provPrima: d.provPrima,
            provVacaciones: d.provVacaciones, costoTotal: d.costoTotal,
        }))
        await exportarExcel({
            archivo: `nomina-${n.numero}-${MESES[n.mes - 1]}-${n.anio}`,
            hoja: 'Nómina',
            titulo: `Nómina ${n.numero} — ${MESES[n.mes - 1]} ${n.anio}`,
            empresa,
            filas,
            columnas: [
                { header: 'Documento', key: 'documento', width: 14 },
                { header: 'Empleado', key: 'empleado', width: 24 },
                { header: 'Cargo', key: 'cargo', width: 18 },
                { header: 'Días', key: 'dias', width: 8 },
                { header: 'Sueldo', key: 'sueldo', width: 14, moneda: true },
                { header: 'Aux. transporte', key: 'auxTransporte', width: 16, moneda: true },
                { header: 'H. extra diurnas', key: 'hExtraDiurnas', width: 16, moneda: true },
                { header: 'H. extra nocturnas', key: 'hExtraNocturnas', width: 16, moneda: true },
                { header: 'Comisiones', key: 'comisiones', width: 14, moneda: true },
                { header: 'Bonificaciones', key: 'bonificaciones', width: 14, moneda: true },
                { header: 'Total devengado', key: 'totalDevengado', width: 16, moneda: true },
                { header: 'IBC', key: 'ibc', width: 14, moneda: true },
                { header: 'Salud (4%)', key: 'salud', width: 14, moneda: true },
                { header: 'Pensión (4%)', key: 'pension', width: 14, moneda: true },
                { header: 'Fondo solidaridad', key: 'fondoSolidaridad', width: 16, moneda: true },
                { header: 'Retefuente', key: 'retefuente', width: 14, moneda: true },
                { header: 'Préstamos', key: 'prestamos', width: 14, moneda: true },
                { header: 'Total deducciones', key: 'totalDeducciones', width: 16, moneda: true },
                { header: 'Neto a pagar', key: 'netoPagar', width: 16, moneda: true },
                { header: 'Salud empleador', key: 'saludEmpleador', width: 16, moneda: true },
                { header: 'Pensión empleador', key: 'pensionEmpleador', width: 16, moneda: true },
                { header: 'ARL', key: 'arl', width: 14, moneda: true },
                { header: 'SENA', key: 'sena', width: 14, moneda: true },
                { header: 'ICBF', key: 'icbf', width: 14, moneda: true },
                { header: 'Caja compensación', key: 'cajaCompensacion', width: 16, moneda: true },
                { header: 'Exonerado Ley 1607', key: 'exonerado', width: 16 },
                { header: 'Prov. cesantías', key: 'provCesantias', width: 16, moneda: true },
                { header: 'Prov. int. cesantías', key: 'provIntCesantias', width: 18, moneda: true },
                { header: 'Prov. prima', key: 'provPrima', width: 14, moneda: true },
                { header: 'Prov. vacaciones', key: 'provVacaciones', width: 16, moneda: true },
                { header: 'Costo total', key: 'costoTotal', width: 16, moneda: true },
            ],
        })
    }

    const columnas = [
        { title: 'Número', dataIndex: 'numero', render: (v: string) => <strong style={{ color: colors.primary }}>{v}</strong> },
        { title: 'Período', render: (_: any, r: Nomina) => `${MESES[r.mes - 1]} ${r.anio}` },
        { title: 'Empleados', render: (_: any, r: Nomina) => r.detalles?.length || 0 },
        { title: 'Total devengado', dataIndex: 'totalDevengado', align: 'right' as const, render: (v: number) => cop.format(v) },
        { title: 'Neto pagado', dataIndex: 'totalNeto', align: 'right' as const, render: (v: number) => <strong>{cop.format(v)}</strong> },
        {
            title: 'Costo empresa', dataIndex: 'costoTotalEmpresa', align: 'right' as const,
            render: (v: number) => <span style={{ color: colors.orange }}>{cop.format(v)}</span>
        },
        {
            title: 'Estado', dataIndex: 'estado',
            render: (v: keyof typeof COLOR_ESTADO) => <Tag color={COLOR_ESTADO[v]}>{v}</Tag>
        },
        {
            title: '', key: 'acciones',
            render: (_: any, r: Nomina) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <Tooltip title="Ver detalle"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => abrirDetalle(r)} /></Tooltip>
                    {r.estado === 'LIQUIDADA' && (
                        <Tooltip title="Marcar como pagada">
                            <Popconfirm title="¿Confirmas que ya se pagó esta nómina?" onConfirm={() => marcarPagada(r.nominaId)} okText="Sí" cancelText="No">
                                <Button type="text" size="small" icon={<CheckCircleOutlined />} style={{ color: colors.primary }} />
                            </Popconfirm>
                        </Tooltip>
                    )}
                    {r.estado !== 'PAGADA' && r.estado !== 'ANULADA' && (
                        <Popconfirm title="¿Anular esta nómina?" onConfirm={() => anular(r.nominaId)} okText="Sí" cancelText="No">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </div>
            )
        },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <DollarOutlined style={{ marginRight: 8 }} />
                        Nómina
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Liquidación mensual de {empleados.length} empleados activos
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button icon={<TeamOutlined />} onClick={() => navigate('/nomina/empleados')} style={{ borderRadius: 14, fontWeight: 600 }}>
                        Empleados
                    </Button>
                    <Button icon={<ImportOutlined />} onClick={() => navigate('/nomina/acumulados-iniciales')} style={{ borderRadius: 14, fontWeight: 600 }}>
                        Acumulados iniciales
                    </Button>
                    <Button
                        type="primary" icon={<PlusOutlined />}
                        onClick={() => { setNovedades({}); setModalLiquidar(true) }}
                        disabled={empleados.length === 0}
                        style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                    >
                        Liquidar período
                    </Button>
                </div>
            </div>

            {empleados.length === 0 && !loading && (
                <Alert
                    type="warning" showIcon style={{ marginBottom: 16 }}
                    message="No tienes empleados activos"
                    description="Registra al menos un empleado antes de poder liquidar la nómina."
                    action={<Button size="small" onClick={() => navigate('/nomina/empleados')}>Ir a empleados</Button>}
                />
            )}

            <TablaOrdenable
                dataSource={nominas}
                columns={columnas}
                rowKey="nominaId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Todavía no has liquidado ninguna nómina" /> }}
            />

            {/* ── Modal liquidar ── */}
            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Liquidar nómina</span>}
                open={modalLiquidar}
                onCancel={() => setModalLiquidar(false)}
                onOk={liquidar}
                confirmLoading={liquidando}
                okText="Liquidar"
                cancelText="Cancelar"
                width={950}
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <Select value={mes} onChange={setMes} style={{ width: 160 }}
                        options={MESES.map((m, i) => ({ value: i + 1, label: m }))} />
                    <Select value={anio} onChange={setAnio} style={{ width: 110 }}
                        options={[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map(a => ({ value: a, label: String(a) }))} />
                </div>

                <Alert
                    type="info" showIcon style={{ marginBottom: 14, fontSize: 12.5 }}
                    message="Sueldo, auxilio de transporte, aportes y provisiones se calculan solos."
                    description="Aquí solo capturas las novedades del mes. La retención en la fuente la debe calcular tu contador según la depuración de cada empleado — el sistema no la asume."
                />

                <TablaOrdenable
                    dataSource={empleados}
                    rowKey="empleadoId"
                    size="small"
                    pagination={false}
                    scroll={{ x: 900, y: 320 }}
                    columns={[
                        {
                            title: 'Empleado', fixed: 'left' as const, width: 170,
                            render: (_: any, r: Empleado) => (
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{r.nombres} {r.apellidos}</div>
                                    <div style={{ fontSize: 11, color: colors.textMuted }}>{cop.format(r.salarioBase)}</div>
                                </div>
                            )
                        },
                        {
                            title: 'Días', width: 90,
                            render: (_: any, r: Empleado) => (
                                <InputNumber
                                    size="small" min={0} style={{ width: '100%' }} placeholder="30"
                                    value={novedades[r.empleadoId!]?.diasTrabajados}
                                    onChange={v => actualizarNovedad(r.empleadoId!, 'diasTrabajados', v as number)}
                                />
                            )
                        },
                        {
                            title: 'Horas extra', width: 110,
                            render: (_: any, r: Empleado) => {
                                const items = novedades[r.empleadoId!]?.horasExtra || []
                                return (
                                    <Badge count={items.length} size="small" offset={[-4, 4]}>
                                        <Button size="small" icon={<ThunderboltOutlined />} onClick={() => setEmpleadoHorasExtra(r)}>
                                            Editar
                                        </Button>
                                    </Badge>
                                )
                            }
                        },
                        ...([
                            ['comisiones', 'Comisiones $'],
                            ['bonificaciones', 'Bonif. $'],
                            ['retencionFuente', 'Retefuente $'],
                            ['prestamos', 'Préstamos $'],
                        ] as [keyof NovedadEmpleado, string][]).map(([campo, titulo]) => ({
                            title: titulo,
                            width: 120,
                            render: (_: any, r: Empleado) => (
                                <InputNumber
                                    size="small" min={0} style={{ width: '100%' }} placeholder="0"
                                    value={novedades[r.empleadoId!]?.[campo] as number | undefined}
                                    onChange={v => actualizarNovedad(r.empleadoId!, campo, v as number)}
                                />
                            )
                        })),
                    ]}
                />
            </Modal>

            <HorasExtraModal
                empleado={empleadoHorasExtra}
                items={empleadoHorasExtra ? (novedades[empleadoHorasExtra.empleadoId!]?.horasExtra || []) : []}
                onClose={() => setEmpleadoHorasExtra(null)}
                onGuardar={(items) => { actualizarHorasExtra(empleadoHorasExtra!.empleadoId!, items); setEmpleadoHorasExtra(null) }}
            />

            {/* ── Modal detalle ── */}
            <Modal
                title={detalle && (
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        {detalle.numero} · {MESES[detalle.mes - 1]} {detalle.anio}
                    </span>
                )}
                open={!!detalle}
                onCancel={() => setDetalle(null)}
                footer={detalle && (
                    <Button icon={<DownloadOutlined />} onClick={() => descargarDetalle(detalle)}>
                        Descargar Excel
                    </Button>
                )}
                width={1000}
            >
                {detalle && (
                    <>
                        <Descriptions size="small" bordered column={3} style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="Total devengado">{cop.format(detalle.totalDevengado)}</Descriptions.Item>
                            <Descriptions.Item label="Total deducciones">{cop.format(detalle.totalDeducciones)}</Descriptions.Item>
                            <Descriptions.Item label="Neto a pagar">
                                <strong style={{ color: colors.primary }}>{cop.format(detalle.totalNeto)}</strong>
                            </Descriptions.Item>
                            <Descriptions.Item label="Aportes empleador">{cop.format(detalle.totalAportesEmpleador)}</Descriptions.Item>
                            <Descriptions.Item label="Provisiones">{cop.format(detalle.totalProvisiones)}</Descriptions.Item>
                            <Descriptions.Item label="Costo total empresa">
                                <strong style={{ color: colors.orange }}>{cop.format(detalle.costoTotalEmpresa)}</strong>
                            </Descriptions.Item>
                        </Descriptions>

                        <TablaOrdenable
                            dataSource={detalle.detalles}
                            rowKey="empleadoId"
                            size="small"
                            pagination={false}
                            scroll={{ x: 1100 }}
                            columns={[
                                { title: 'Empleado', dataIndex: 'nombreEmpleado', fixed: 'left' as const, width: 160 },
                                { title: 'Días', dataIndex: 'diasTrabajados', width: 60 },
                                { title: 'Sueldo', dataIndex: 'sueldo', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Aux. transp.', dataIndex: 'auxilioTransporte', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Devengado', dataIndex: 'totalDevengado', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Salud', dataIndex: 'saludEmpleado', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Pensión', dataIndex: 'pensionEmpleado', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'Deducciones', dataIndex: 'totalDeducciones', align: 'right' as const, render: (v: number) => cop.format(v) },
                                {
                                    title: 'Neto', dataIndex: 'netoPagar', align: 'right' as const, width: 120,
                                    render: (v: number) => <strong style={{ color: colors.primary }}>{cop.format(v)}</strong>
                                },
                                {
                                    title: 'DIAN', key: 'dian', fixed: 'right' as const, width: 90,
                                    render: (_: any, r: NominaDetalle) => {
                                        const electronica = electronicasPorEmpleado[r.empleadoId]
                                        if (electronica?.estado === 'ACEPTADA') return (
                                            <Popconfirm
                                                title="¿Anular esta nómina electrónica ante la DIAN?"
                                                description={`Documento ${electronica.numeroDocumento}`}
                                                onConfirm={() => anularNominaElectronica(detalle.nominaId, r.empleadoId, electronica.nominaElectronicaId!)}
                                                okText="Sí, anular" cancelText="Cancelar"
                                                okButtonProps={{ danger: true }}
                                            >
                                                <Tooltip title="Anular esta nómina electrónica ante la DIAN">
                                                    <Button size="small" danger icon={<StopOutlined />} loading={anulando === r.empleadoId} />
                                                </Tooltip>
                                            </Popconfirm>
                                        )
                                        return (
                                        <Tooltip title="Transmitir la nómina electrónica de este empleado a la DIAN">
                                            <Button
                                                size="small" icon={<SendOutlined />}
                                                loading={transmitiendo === r.empleadoId}
                                                onClick={() => transmitirNomina(detalle.nominaId, r.empleadoId)}
                                            />
                                        </Tooltip>
                                        )
                                    },
                                },
                                {
                                    title: 'Exonerado', dataIndex: 'exonerado', width: 100,
                                    render: (v: boolean) => (
                                        <Tooltip title={v
                                            ? 'Ley 1607/2012: la empresa no paga salud 8.5%, SENA ni ICBF por este empleado (gana menos de 10 SMMLV)'
                                            : 'Gana 10 SMMLV o más: la empresa sí paga todos los aportes'}>
                                            <Tag color={v ? 'green' : 'default'}>{v ? 'Sí' : 'No'}</Tag>
                                        </Tooltip>
                                    )
                                },
                            ]}
                        />
                    </>
                )}
            </Modal>
        </div>
    )
}
