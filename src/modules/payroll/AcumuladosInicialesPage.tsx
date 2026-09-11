import { useState, useEffect } from 'react'
import {
    Table, Button, Modal, Select, InputNumber, DatePicker, Input,
    message, Popconfirm, Empty, Alert
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { ImportOutlined, PlusOutlined, DeleteOutlined, EditOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import {
    acumuladoInicialService, empleadoService,
    type AcumuladoInicial, type Empleado
} from '../../shared/services/nominaService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

// Se agrupan por bloque para que el formulario no se sienta un muro de casillas.
const CAMPOS: { grupo: string; campos: [keyof AcumuladoInicial, string][] }[] = [
    {
        grupo: 'Prestaciones causadas y no pagadas (lo más importante)',
        campos: [
            ['cesantiasAcumuladas', 'Cesantías'],
            ['interesesCesantiasAcumulados', 'Intereses de cesantías'],
            ['primaAcumulada', 'Prima de servicios'],
            ['vacacionesAcumuladas', 'Vacaciones (valor)'],
            ['diasVacacionesPendientes', 'Días de vacaciones pendientes'],
        ],
    },
    {
        grupo: 'Devengados del año',
        campos: [
            ['sueldoAcumulado', 'Sueldo'],
            ['auxilioTransporteAcumulado', 'Auxilio de transporte'],
            ['extrasAcumuladas', 'Horas extra y recargos'],
            ['bonificacionesAcumuladas', 'Bonificaciones'],
        ],
    },
    {
        grupo: 'Aportes y deducciones del año',
        campos: [
            ['saludAcumulada', 'Salud'],
            ['pensionAcumulada', 'Pensión'],
            ['retencionAcumulada', 'Retención en la fuente'],
        ],
    },
]

export default function AcumuladosInicialesPage() {
    const navigate = useNavigate()
    const [anio, setAnio] = useState(dayjs().year())
    const [acumulados, setAcumulados] = useState<AcumuladoInicial[]>([])
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)

    const [modal, setModal] = useState(false)
    const [empleadoId, setEmpleadoId] = useState<number | undefined>()
    const [fechaCorte, setFechaCorte] = useState<Dayjs | null>(null)
    const [valores, setValores] = useState<Record<string, number>>({})
    const [observaciones, setObservaciones] = useState('')
    const [guardando, setGuardando] = useState(false)

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([acumuladoInicialService.listar(anio), empleadoService.listar()])
            .then(([ra, re]) => {
                if (ra.status === 'fulfilled') setAcumulados(ra.value.data)
                if (re.status === 'fulfilled') setEmpleados(re.value.data.filter(e => e.activo))
            })
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [anio])

    const abrir = (a?: AcumuladoInicial) => {
        if (a) {
            setEmpleadoId(a.empleadoId)
            setFechaCorte(a.fechaCorte ? dayjs(a.fechaCorte) : null)
            setObservaciones(a.observaciones || '')
            const v: Record<string, number> = {}
            CAMPOS.forEach(g => g.campos.forEach(([k]) => {
                const valor = a[k]
                if (typeof valor === 'number') v[k as string] = valor
            }))
            setValores(v)
        } else {
            setEmpleadoId(undefined); setFechaCorte(null); setValores({}); setObservaciones('')
        }
        setModal(true)
    }

    const guardar = async () => {
        if (!empleadoId) { message.warning('Selecciona el empleado'); return }
        setGuardando(true)
        try {
            await acumuladoInicialService.guardar({
                empleadoId,
                anio,
                fechaCorte: fechaCorte ? fechaCorte.format('YYYY-MM-DD') : undefined,
                observaciones: observaciones || undefined,
                ...valores,
            })
            message.success('Acumulados guardados')
            setModal(false)
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    const eliminar = async (id: number) => {
        try {
            await acumuladoInicialService.eliminar(id)
            message.success('Registro eliminado')
            cargar()
        } catch {
            message.error('No se pudo eliminar')
        }
    }

    const yaRegistrados = new Set(acumulados.map(a => a.empleadoId))
    const sinRegistrar = empleados.filter(e => !yaRegistrados.has(e.empleadoId!))

    return (
        <div>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/nomina')} style={{ paddingLeft: 0, marginBottom: 8 }}>
                Volver a Nómina
            </Button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <ImportOutlined style={{ marginRight: 8 }} />
                        Acumulados iniciales
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Saldos que cada empleado ya traía antes de empezar a usar Plutus365
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Select
                        value={anio} onChange={setAnio} style={{ width: 110 }}
                        options={[dayjs().year() - 1, dayjs().year()].map(a => ({ value: a, label: String(a) }))}
                    />
                    <Button
                        type="primary" icon={<PlusOutlined />} onClick={() => abrir()}
                        disabled={empleados.length === 0}
                        style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                    >
                        Registrar empleado
                    </Button>
                </div>
            </div>

            <Alert
                type="info" showIcon style={{ marginBottom: 16 }}
                message="¿Para qué sirve esto?"
                description="Si venías llevando la nómina en otro sistema o en Excel y migraste a mitad de año, tus reportes acumulados solo contarían desde tu primera liquidación aquí y quedarían cortos. Estos valores se suman para que reflejen el año completo. Se captura una sola vez por empleado."
            />

            {sinRegistrar.length > 0 && acumulados.length > 0 && (
                <Alert
                    type="warning" showIcon style={{ marginBottom: 16 }}
                    message={`${sinRegistrar.length} ${sinRegistrar.length === 1 ? 'empleado activo no tiene' : 'empleados activos no tienen'} acumulados registrados en ${anio}`}
                    description={sinRegistrar.map(e => `${e.nombres} ${e.apellidos}`).join(' · ')}
                />
            )}

            <TablaOrdenable
                dataSource={acumulados}
                rowKey="acumuladoId"
                loading={loading}
                pagination={false}
                scroll={{ x: 1000 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description={`Sin acumulados registrados para ${anio}`} /> }}
                columns={[
                    { title: 'Empleado', dataIndex: 'nombreEmpleado', fixed: 'left' as const, width: 180 },
                    {
                        title: 'Corte', dataIndex: 'fechaCorte',
                        render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—'
                    },
                    { title: 'Cesantías', dataIndex: 'cesantiasAcumuladas', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                    { title: 'Int. cesantías', dataIndex: 'interesesCesantiasAcumulados', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                    { title: 'Prima', dataIndex: 'primaAcumulada', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                    { title: 'Vacaciones', dataIndex: 'vacacionesAcumuladas', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                    { title: 'Días vac.', dataIndex: 'diasVacacionesPendientes', align: 'right' as const, width: 90 },
                    { title: 'Sueldo año', dataIndex: 'sueldoAcumulado', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                    {
                        title: '', key: 'acciones', width: 80, fixed: 'right' as const,
                        render: (_: any, r: AcumuladoInicial) => (
                            <div style={{ display: 'flex', gap: 4 }}>
                                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => abrir(r)} />
                                <Popconfirm title="¿Eliminar este registro?" onConfirm={() => eliminar(r.acumuladoId!)} okText="Sí" cancelText="No">
                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </div>
                        )
                    },
                ]}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Acumulados iniciales {anio}</span>}
                open={modal}
                onCancel={() => setModal(false)}
                onOk={guardar}
                confirmLoading={guardando}
                okText="Guardar"
                cancelText="Cancelar"
                width={760}
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Empleado *</div>
                        <Select
                            showSearch optionFilterProp="label" placeholder="Selecciona"
                            value={empleadoId} onChange={setEmpleadoId} style={{ width: '100%' }}
                            options={empleados.map(e => ({
                                value: e.empleadoId,
                                label: `${e.nombres} ${e.apellidos} — ${e.numeroDocumento}`,
                            }))}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fecha de corte</div>
                        <DatePicker
                            value={fechaCorte} onChange={setFechaCorte} format="DD/MM/YYYY"
                            style={{ width: '100%' }} placeholder="Último día liquidado"
                        />
                    </div>
                </div>

                {CAMPOS.map(grupo => (
                    <div key={grupo.grupo} style={{ marginBottom: 16 }}>
                        <div style={{
                            fontSize: 12.5, fontWeight: 700, color: colors.primary,
                            borderBottom: `1px solid ${colors.border}`, paddingBottom: 4, marginBottom: 10,
                        }}>
                            {grupo.grupo}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            {grupo.campos.map(([k, label]) => (
                                <div key={k as string}>
                                    <div style={{ fontSize: 11.5, color: colors.textSecondary, marginBottom: 3 }}>{label}</div>
                                    <InputNumber
                                        min={0} style={{ width: '100%' }}
                                        value={valores[k as string]}
                                        onChange={v => setValores(prev => ({ ...prev, [k as string]: Number(v) || 0 }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Observaciones</div>
                    <Input.TextArea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
                        placeholder="De dónde vienen estos saldos, sistema anterior, etc." />
                </div>
            </Modal>
        </div>
    )
}
