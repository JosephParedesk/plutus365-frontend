import { useState, useEffect } from 'react'
import { Tabs, DatePicker, Table, Tag, Spin, Empty, Button, message } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { FundOutlined, DownloadOutlined, WarningFilled } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
    estadosFinancierosService, type BalanceGeneral, type EstadoResultados, type SaldoCuenta,
    type FlujoEfectivo, type CambiosPatrimonio
} from '../../shared/services/contabilidadService'
import { empresaService, type Empresa } from '../../shared/services/empresaService'
import { exportarExcel } from '../../shared/utils/exportarExcel'
import { colors } from '../../shared/theme/colors'

const { RangePicker } = DatePicker
const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const columnasSaldo = [
    { title: 'Código', dataIndex: 'codigo', width: 100, render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Cuenta', dataIndex: 'nombre' },
    { title: 'Saldo', dataIndex: 'saldo', align: 'right' as const, render: (v: number) => formatoCOP.format(v) },
]

function BloqueSaldos({ titulo, cuentas, total, color }: { titulo: string; cuentas: SaldoCuenta[]; total: number; color: string }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: colors.heading, fontSize: 14 }}>{titulo}</span>
                <span style={{ fontWeight: 800, color, fontSize: 15 }}>{formatoCOP.format(total)}</span>
            </div>
            {cuentas.length === 0 ? (
                <Empty description="Sin movimientos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '12px 0' }} />
            ) : (
                <TablaOrdenable dataSource={cuentas} columns={columnasSaldo} rowKey="codigo" size="small" pagination={false} />
            )}
        </div>
    )
}

function BloqueFlujo({ titulo, lineas, total, color }: { titulo: string; lineas: any[]; total: number; color: string }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: colors.heading, fontSize: 14 }}>{titulo}</span>
                <span style={{ fontWeight: 800, color, fontSize: 15 }}>{formatoCOP.format(total)}</span>
            </div>
            {lineas.length === 0 ? (
                <Empty description="Sin movimientos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '10px 0' }} />
            ) : (
                lineas.map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
                        <span style={{ color: colors.textSecondary }}>
                            {l.codigo && <span style={{ fontFamily: 'monospace', marginRight: 8, color: colors.textMuted }}>{l.codigo}</span>}
                            {l.concepto}
                        </span>
                        <span style={{ color: l.valor >= 0 ? colors.primary : colors.red }}>{formatoCOP.format(l.valor)}</span>
                    </div>
                ))
            )}
        </div>
    )
}

export default function EstadosFinancierosPage() {
    const [tab, setTab] = useState('balance')
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    useEffect(() => { empresaService.obtener().then(({ data }) => setEmpresa(data)).catch(() => {}) }, [])

    // Balance General
    const [fechaCorte, setFechaCorte] = useState<Dayjs>(dayjs())
    const [balance, setBalance] = useState<BalanceGeneral | null>(null)
    const [cargandoBalance, setCargandoBalance] = useState(true)

    // Estado de Resultados
    const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
    const [resultados, setResultados] = useState<EstadoResultados | null>(null)
    const [cargandoResultados, setCargandoResultados] = useState(true)

    // Flujo de efectivo y cambios en patrimonio comparten el mismo rango del estado de resultados
    const [flujo, setFlujo] = useState<FlujoEfectivo | null>(null)
    const [patrimonio, setPatrimonio] = useState<CambiosPatrimonio | null>(null)
    const [cargandoExtra, setCargandoExtra] = useState(false)

    useEffect(() => {
        setCargandoBalance(true)
        estadosFinancierosService.balanceGeneral(fechaCorte.format('YYYY-MM-DD'))
            .then(({ data }) => setBalance(data))
            .catch(() => message.error('Error al calcular el balance general'))
            .finally(() => setCargandoBalance(false))
    }, [fechaCorte])

    useEffect(() => {
        setCargandoResultados(true)
        estadosFinancierosService.estadoResultados(rango[0].format('YYYY-MM-DD'), rango[1].format('YYYY-MM-DD'))
            .then(({ data }) => setResultados(data))
            .catch(() => message.error('Error al calcular el estado de resultados'))
            .finally(() => setCargandoResultados(false))
    }, [rango])

    useEffect(() => {
        if (tab !== 'flujo' && tab !== 'patrimonio') return
        setCargandoExtra(true)
        const ini = rango[0].format('YYYY-MM-DD')
        const fin = rango[1].format('YYYY-MM-DD')
        Promise.allSettled([
            estadosFinancierosService.flujoEfectivo(ini, fin),
            estadosFinancierosService.cambiosPatrimonio(ini, fin),
        ]).then(([rf, rp]) => {
            setFlujo(rf.status === 'fulfilled' ? rf.value.data : null)
            setPatrimonio(rp.status === 'fulfilled' ? rp.value.data : null)
            if (rf.status === 'rejected' || rp.status === 'rejected')
                message.error('Error al calcular el estado')
        }).finally(() => setCargandoExtra(false))
    }, [tab, rango])

    const columnasEstado = [
        { header: 'Sección', key: 'seccion', width: 14 },
        { header: 'Código', key: 'codigo', width: 12 },
        { header: 'Cuenta', key: 'cuenta', width: 34 },
        { header: 'Valor', key: 'valor', width: 18, moneda: true },
    ]

    const descargarBalance = async () => {
        if (!balance) return
        const filas = [
            ...balance.activos.map(c => ({ seccion: 'Activo', codigo: c.codigo, cuenta: c.nombre, valor: c.saldo })),
            { seccion: 'Activo', codigo: '', cuenta: 'TOTAL ACTIVO', valor: balance.totalActivo },
            ...balance.pasivos.map(c => ({ seccion: 'Pasivo', codigo: c.codigo, cuenta: c.nombre, valor: c.saldo })),
            { seccion: 'Pasivo', codigo: '', cuenta: 'TOTAL PASIVO', valor: balance.totalPasivo },
            ...balance.patrimonio.map(c => ({ seccion: 'Patrimonio', codigo: c.codigo, cuenta: c.nombre, valor: c.saldo })),
            { seccion: 'Patrimonio', codigo: '', cuenta: 'TOTAL PATRIMONIO', valor: balance.totalPatrimonio },
        ]
        await exportarExcel({
            archivo: `balance-general-${fechaCorte.format('YYYY-MM-DD')}`,
            hoja: 'Balance General',
            titulo: `Balance General al ${fechaCorte.format('DD/MM/YYYY')}`,
            empresa, filas, columnas: columnasEstado,
        })
    }

    const descargarResultados = async () => {
        if (!resultados) return
        const filas = [
            ...resultados.ingresos.map(c => ({ seccion: 'Ingresos', codigo: c.codigo, cuenta: c.nombre, valor: c.saldo })),
            { seccion: 'Ingresos', codigo: '', cuenta: 'TOTAL INGRESOS', valor: resultados.totalIngresos },
            ...resultados.costos.map(c => ({ seccion: 'Costos', codigo: c.codigo, cuenta: c.nombre, valor: c.saldo })),
            { seccion: 'Costos', codigo: '', cuenta: 'TOTAL COSTOS', valor: resultados.totalCostos },
            ...resultados.gastos.map(c => ({ seccion: 'Gastos', codigo: c.codigo, cuenta: c.nombre, valor: c.saldo })),
            { seccion: 'Gastos', codigo: '', cuenta: 'TOTAL GASTOS', valor: resultados.totalGastos },
            { seccion: 'Resultado', codigo: '', cuenta: 'UTILIDAD DEL PERÍODO', valor: resultados.utilidad },
        ]
        await exportarExcel({
            archivo: `estado-resultados-${rango[0].format('YYYY-MM-DD')}_a_${rango[1].format('YYYY-MM-DD')}`,
            hoja: 'Estado de Resultados',
            titulo: `Estado de Resultados: ${rango[0].format('DD/MM/YYYY')} a ${rango[1].format('DD/MM/YYYY')}`,
            empresa, filas, columnas: columnasEstado,
        })
    }

    return (
        <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                <FundOutlined style={{ marginRight: 8 }} />
                Estados financieros
            </h2>
            <p style={{ color: colors.textSecondary, margin: '4px 0 20px', fontSize: 13 }}>
                Calculados en vivo a partir de tus asientos contables
            </p>

            <Tabs
                activeKey={tab}
                onChange={setTab}
                items={[
                    {
                        key: 'balance',
                        label: 'Balance General',
                        children: (
                            <div style={{ background: colors.cardBg, borderRadius: 22, padding: 20, boxShadow: '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <span style={{ fontSize: 12.5, color: colors.textSecondary, marginRight: 8 }}>Corte a fecha:</span>
                                        <DatePicker
                                            value={fechaCorte}
                                            onChange={(v) => v && setFechaCorte(v)}
                                            format="DD/MM/YYYY"
                                            allowClear={false}
                                        />
                                    </div>
                                    <Button icon={<DownloadOutlined />} onClick={descargarBalance} disabled={!balance}>
                                        Descargar Excel
                                    </Button>
                                </div>

                                {cargandoBalance || !balance ? (
                                    <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
                                ) : (
                                    <>
                                        {!balance.cuadra && (
                                            <div style={{
                                                background: colors.redLight, border: `1px solid ${colors.red}`, borderRadius: 14,
                                                padding: 10, marginBottom: 16, fontSize: 12.5, color: '#a02030',
                                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                            }}>
                                                <WarningFilled style={{ color: colors.red, fontSize: 14, marginTop: 1, flexShrink: 0 }} />
                                                <span>
                                                    El balance no cuadra exactamente (diferencia mayor a redondeo). Revisa que no haya
                                                    asientos manuales incompletos o cuentas mal clasificadas.
                                                </span>
                                            </div>
                                        )}
                                        <BloqueSaldos titulo="Activo" cuentas={balance.activos} total={balance.totalActivo} color={colors.primary} />
                                        <BloqueSaldos titulo="Pasivo" cuentas={balance.pasivos} total={balance.totalPasivo} color={colors.red} />
                                        <BloqueSaldos titulo="Patrimonio" cuentas={balance.patrimonio} total={balance.totalPatrimonio} color={colors.purple} />

                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            borderTop: `2px solid ${colors.heading}`, paddingTop: 12, marginTop: 8,
                                        }}>
                                            <span style={{ fontWeight: 700 }}>Activo = Pasivo + Patrimonio</span>
                                            <Tag color={balance.cuadra ? 'green' : 'red'} style={{ fontSize: 13, padding: '2px 10px' }}>
                                                {formatoCOP.format(balance.totalActivo)} = {formatoCOP.format(balance.totalPasivo + balance.totalPatrimonio)}
                                            </Tag>
                                        </div>
                                    </>
                                )}
                            </div>
                        ),
                    },
                    {
                        key: 'resultados',
                        label: 'Estado de Resultados',
                        children: (
                            <div style={{ background: colors.cardBg, borderRadius: 22, padding: 20, boxShadow: '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <span style={{ fontSize: 12.5, color: colors.textSecondary, marginRight: 8 }}>Período:</span>
                                        <RangePicker
                                            value={rango}
                                            onChange={(v) => v && v[0] && v[1] && setRango([v[0], v[1]])}
                                            format="DD/MM/YYYY"
                                            allowClear={false}
                                        />
                                    </div>
                                    <Button icon={<DownloadOutlined />} onClick={descargarResultados} disabled={!resultados}>
                                        Descargar Excel
                                    </Button>
                                </div>

                                {cargandoResultados || !resultados ? (
                                    <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
                                ) : (
                                    <>
                                        <BloqueSaldos titulo="Ingresos" cuentas={resultados.ingresos} total={resultados.totalIngresos} color={colors.primary} />
                                        <BloqueSaldos titulo="Costos de ventas" cuentas={resultados.costos} total={resultados.totalCostos} color={colors.orange} />
                                        <BloqueSaldos titulo="Gastos" cuentas={resultados.gastos} total={resultados.totalGastos} color={colors.red} />

                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            borderTop: `2px solid ${colors.heading}`, paddingTop: 12, marginTop: 8,
                                        }}>
                                            <span style={{ fontWeight: 700, fontSize: 15 }}>
                                                {resultados.utilidad >= 0 ? 'Utilidad del período' : 'Pérdida del período'}
                                            </span>
                                            <span style={{
                                                fontWeight: 800, fontSize: 18,
                                                color: resultados.utilidad >= 0 ? colors.primary : colors.red,
                                            }}>
                                                {formatoCOP.format(Math.abs(resultados.utilidad))}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        ),
                    },
                    {
                        key: 'flujo',
                        label: 'Flujo de efectivo',
                        children: (
                            <div style={{ background: colors.cardBg, borderRadius: 22, padding: 20, boxShadow: '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)' }}>
                                <div style={{ marginBottom: 16 }}>
                                    <span style={{ fontSize: 12.5, color: colors.textSecondary, marginRight: 8 }}>Período:</span>
                                    <RangePicker
                                        value={rango}
                                        onChange={(v) => v && v[0] && v[1] && setRango([v[0], v[1]])}
                                        format="DD/MM/YYYY" allowClear={false}
                                    />
                                </div>

                                {cargandoExtra || !flujo ? (
                                    <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
                                ) : (
                                    <>
                                        <Alert
                                            type="info" showIcon style={{ marginBottom: 16, fontSize: 12.5 }}
                                            message="Método indirecto"
                                            description="Parte de la utilidad del período y ajusta las variaciones de las cuentas del balance. La clasificación operación/inversión/financiación se hace por grupo del PUC — si tu operación tiene casos especiales, tu contador debe reclasificarlos."
                                        />
                                        {!flujo.cuadra && (
                                            <Alert type="warning" showIcon style={{ marginBottom: 16 }}
                                                message="El flujo no concilia exactamente con la variación de efectivo del balance. Revisa asientos manuales incompletos." />
                                        )}
                                        <BloqueFlujo titulo="Actividades de operación" lineas={flujo.operacion} total={flujo.flujoOperacion} color={colors.primary} />
                                        <BloqueFlujo titulo="Actividades de inversión" lineas={flujo.inversion} total={flujo.flujoInversion} color={colors.purple} />
                                        <BloqueFlujo titulo="Actividades de financiación" lineas={flujo.financiacion} total={flujo.flujoFinanciacion} color={colors.orange} />

                                        <div style={{ borderTop: `2px solid ${colors.heading}`, paddingTop: 12, marginTop: 8 }}>
                                            {[
                                                ['Variación neta de efectivo', flujo.variacionNeta],
                                                ['Efectivo al inicio', flujo.efectivoInicial],
                                                ['Efectivo al final', flujo.efectivoFinal],
                                            ].map(([label, valor], i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                                    <span style={{ fontWeight: i === 2 ? 700 : 500 }}>{label as string}</span>
                                                    <span style={{ fontWeight: i === 2 ? 800 : 600, color: i === 2 ? colors.primary : undefined }}>
                                                        {formatoCOP.format(valor as number)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ),
                    },
                    {
                        key: 'patrimonio',
                        label: 'Cambios en el patrimonio',
                        children: (
                            <div style={{ background: colors.cardBg, borderRadius: 22, padding: 20, boxShadow: '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)' }}>
                                <div style={{ marginBottom: 16 }}>
                                    <span style={{ fontSize: 12.5, color: colors.textSecondary, marginRight: 8 }}>Período:</span>
                                    <RangePicker
                                        value={rango}
                                        onChange={(v) => v && v[0] && v[1] && setRango([v[0], v[1]])}
                                        format="DD/MM/YYYY" allowClear={false}
                                    />
                                </div>

                                {cargandoExtra || !patrimonio ? (
                                    <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
                                ) : (
                                    <>
                                        <TablaOrdenable
                                            dataSource={patrimonio.lineas}
                                            rowKey="codigo"
                                            size="small"
                                            pagination={false}
                                            columns={[
                                                { title: 'Código', dataIndex: 'codigo', width: 110, render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
                                                { title: 'Concepto', dataIndex: 'concepto' },
                                                { title: 'Saldo inicial', dataIndex: 'saldoInicial', align: 'right' as const, render: (v: number) => formatoCOP.format(v) },
                                                {
                                                    title: 'Variación', dataIndex: 'variacion', align: 'right' as const,
                                                    render: (v: number) => <span style={{ color: v >= 0 ? colors.primary : colors.red }}>{formatoCOP.format(v)}</span>
                                                },
                                                { title: 'Saldo final', dataIndex: 'saldoFinal', align: 'right' as const, render: (v: number) => <strong>{formatoCOP.format(v)}</strong> },
                                            ]}
                                            summary={() => (
                                                <Table.Summary.Row style={{ fontWeight: 700, background: colors.pageBg }}>
                                                    <Table.Summary.Cell index={0} colSpan={2}>Total patrimonio</Table.Summary.Cell>
                                                    <Table.Summary.Cell index={2} align="right">{formatoCOP.format(patrimonio.totalSaldoInicial)}</Table.Summary.Cell>
                                                    <Table.Summary.Cell index={3} align="right">{formatoCOP.format(patrimonio.totalVariacion)}</Table.Summary.Cell>
                                                    <Table.Summary.Cell index={4} align="right">{formatoCOP.format(patrimonio.totalSaldoFinal)}</Table.Summary.Cell>
                                                </Table.Summary.Row>
                                            )}
                                        />
                                        <Alert
                                            type="info" showIcon style={{ marginTop: 14, fontSize: 12.5 }}
                                            message="La utilidad aparece como línea separada porque todavía no hay cierre contable formal que la traslade a utilidades acumuladas."
                                        />
                                    </>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
        </div>
    )
}
