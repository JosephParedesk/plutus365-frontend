import { useState, useEffect } from 'react'
import {
    Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker,
    Switch, Tag, message, Popconfirm, Tabs, Alert
} from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { UserAddOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
    empleadoService, nominaService, TIPO_CONTRATO_LABEL, NIVEL_RIESGO_LABEL,
    type Empleado, type ParametrosNomina
} from '../../shared/services/nominaService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export default function EmpleadosPage() {
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [parametros, setParametros] = useState<ParametrosNomina | null>(null)
    const [loading, setLoading] = useState(true)
    const [modalVisible, setModalVisible] = useState(false)
    const [editando, setEditando] = useState<Empleado | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [form] = Form.useForm()
    const salarioIntegral = Form.useWatch('salarioIntegral', form)

    const cargar = () => {
        setLoading(true)
        empleadoService.listar()
            .then(({ data }) => setEmpleados(data))
            .catch(() => message.error('Error al cargar los empleados'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        cargar()
        nominaService.parametros().then(({ data }) => setParametros(data)).catch(() => { })
    }, [])

    const abrirModal = (empleado?: Empleado) => {
        setEditando(empleado || null)
        if (empleado) {
            form.setFieldsValue({
                ...empleado,
                fechaIngreso: empleado.fechaIngreso ? dayjs(empleado.fechaIngreso) : undefined,
                fechaRetiro: empleado.fechaRetiro ? dayjs(empleado.fechaRetiro) : undefined,
            })
        } else {
            form.resetFields()
            form.setFieldsValue({
                tipoDocumento: 'CC', tipoContrato: 'INDEFINIDO', nivelRiesgoArl: 'I',
                auxilioTransporte: true, salarioIntegral: false, activo: true,
                tipoCuenta: 'AHORROS', fechaIngreso: dayjs(),
            })
        }
        setModalVisible(true)
    }

    const guardar = async (values: any) => {
        setGuardando(true)
        const payload: Empleado = {
            ...values,
            fechaIngreso: values.fechaIngreso?.format('YYYY-MM-DD'),
            fechaRetiro: values.fechaRetiro ? values.fechaRetiro.format('YYYY-MM-DD') : undefined,
        }
        try {
            if (editando?.empleadoId) {
                await empleadoService.actualizar(editando.empleadoId, payload)
                message.success('Empleado actualizado')
            } else {
                await empleadoService.crear(payload)
                message.success('Empleado creado')
            }
            setModalVisible(false)
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar el empleado')
        } finally {
            setGuardando(false)
        }
    }

    const eliminar = async (id: number) => {
        try {
            await empleadoService.eliminar(id)
            message.success('Empleado eliminado')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo eliminar')
        }
    }

    const columnas = [
        {
            title: 'Empleado',
            render: (_: any, r: Empleado) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{r.nombres} {r.apellidos}</div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted }}>{r.tipoDocumento} {r.numeroDocumento}</div>
                </div>
            )
        },
        { title: 'Cargo', dataIndex: 'cargo' },
        {
            title: 'Contrato', dataIndex: 'tipoContrato',
            render: (v: keyof typeof TIPO_CONTRATO_LABEL) => <Tag>{TIPO_CONTRATO_LABEL[v] || v}</Tag>
        },
        {
            title: 'Salario', dataIndex: 'salarioBase',
            render: (v: number, r: Empleado) => (
                <div>
                    <div>{cop.format(v)}</div>
                    {r.salarioIntegral && <Tag color="purple" style={{ fontSize: 10 }}>Integral</Tag>}
                </div>
            )
        },
        { title: 'Ingreso', dataIndex: 'fechaIngreso', render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '' },
        {
            title: 'Estado', dataIndex: 'activo',
            render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>
        },
        {
            title: '', key: 'acciones',
            render: (_: any, r: Empleado) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
                    <Popconfirm title="¿Eliminar este empleado?" onConfirm={() => eliminar(r.empleadoId!)} okText="Sí" cancelText="No">
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </div>
            )
        },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <TeamOutlined style={{ marginRight: 8 }} />
                        Empleados
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        {empleados.filter(e => e.activo).length} activos de {empleados.length} registrados
                    </p>
                </div>
                <Button
                    type="primary" icon={<UserAddOutlined />} onClick={() => abrirModal()}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nuevo empleado
                </Button>
            </div>

            <TablaOrdenable
                dataSource={empleados}
                columns={columnas}
                rowKey="empleadoId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>
                    {editando ? 'Editar empleado' : 'Nuevo empleado'}
                </span>}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={720}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onFinish={guardar}>
                    <Tabs
                        items={[
                            {
                                key: 'personal',
                                label: 'Datos personales',
                                children: (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Form.Item name="nombres" label="Nombres" rules={[{ required: true, message: 'Requerido' }]}>
                                                <Input placeholder="María Fernanda" />
                                            </Form.Item>
                                            <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true, message: 'Requerido' }]}>
                                                <Input placeholder="Gómez Ruiz" />
                                            </Form.Item>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                                            <Form.Item name="tipoDocumento" label="Tipo doc." rules={[{ required: true }]}>
                                                <Select options={[
                                                    { value: 'CC', label: 'CC' }, { value: 'CE', label: 'CE' },
                                                    { value: 'PA', label: 'Pasaporte' }, { value: 'PEP', label: 'PEP' },
                                                ]} />
                                            </Form.Item>
                                            <Form.Item name="numeroDocumento" label="Número de documento" rules={[{ required: true, message: 'Requerido' }]}>
                                                <Input placeholder="1023456789" />
                                            </Form.Item>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Form.Item name="correo" label="Correo"><Input placeholder="maria@correo.com" /></Form.Item>
                                            <Form.Item name="telefono" label="Teléfono"><Input placeholder="3001234567" /></Form.Item>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                                            <Form.Item name="direccion" label="Dirección"><Input /></Form.Item>
                                            <Form.Item name="ciudad" label="Ciudad"><Input placeholder="Bogotá" /></Form.Item>
                                        </div>
                                    </>
                                ),
                            },
                            {
                                key: 'laboral',
                                label: 'Contrato y salario',
                                children: (
                                    <>
                                        {parametros && (
                                            <Alert
                                                type="info" showIcon style={{ marginBottom: 14, fontSize: 12.5 }}
                                                message={`Vigencia ${parametros.anioVigencia}: salario mínimo ${cop.format(parametros.smmlv)} · auxilio de transporte ${cop.format(parametros.auxilioTransporte)} (hasta ${cop.format(parametros.topeAuxilioTransporte)})`}
                                            />
                                        )}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Form.Item name="cargo" label="Cargo"><Input placeholder="Cajera" /></Form.Item>
                                            <Form.Item name="tipoContrato" label="Tipo de contrato" rules={[{ required: true }]}>
                                                <Select options={Object.entries(TIPO_CONTRATO_LABEL).map(([value, label]) => ({ value, label }))} />
                                            </Form.Item>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Form.Item name="fechaIngreso" label="Fecha de ingreso" rules={[{ required: true, message: 'Requerido' }]}>
                                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                                            </Form.Item>
                                            <Form.Item name="fechaRetiro" label="Fecha de retiro (si aplica)">
                                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                                            </Form.Item>
                                        </div>
                                        <Form.Item
                                            name="salarioBase" label="Salario base mensual"
                                            rules={[{ required: true, message: 'Requerido' }]}
                                            extra={salarioIntegral
                                                ? `El salario integral no puede ser inferior a 13 SMMLV${parametros ? ' = ' + cop.format(parametros.minimoSalarioIntegral) : ''}`
                                                : undefined}
                                        >
                                            <InputNumber
                                                min={0} style={{ width: '100%' }}
                                                formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                parser={v => Number(v?.replace(/\$\s?|(,*)/g, '')) as any}
                                            />
                                        </Form.Item>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Form.Item name="salarioIntegral" label="Salario integral" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                            <Form.Item
                                                name="auxilioTransporte" label="Auxilio de transporte" valuePropName="checked"
                                                extra="Solo se paga si gana hasta 2 SMMLV. El sistema lo valida solo."
                                            >
                                                <Switch disabled={salarioIntegral} />
                                            </Form.Item>
                                        </div>
                                        <Form.Item name="activo" label="Empleado activo" valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                    </>
                                ),
                            },
                            {
                                key: 'seguridad',
                                label: 'Seguridad social',
                                children: (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Form.Item name="eps" label="EPS"><Input placeholder="Sura, Sanitas..." /></Form.Item>
                                            <Form.Item name="fondoPension" label="Fondo de pensión"><Input placeholder="Porvenir, Colpensiones..." /></Form.Item>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Form.Item name="fondoCesantias" label="Fondo de cesantías"><Input placeholder="Protección..." /></Form.Item>
                                            <Form.Item name="cajaCompensacion" label="Caja de compensación"><Input placeholder="Compensar, Colsubsidio..." /></Form.Item>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
                                            <Form.Item name="arl" label="ARL"><Input placeholder="Sura, Positiva..." /></Form.Item>
                                            <Form.Item
                                                name="nivelRiesgoArl" label="Nivel de riesgo ARL"
                                                extra="Define la tarifa que paga la empresa"
                                            >
                                                <Select options={Object.entries(NIVEL_RIESGO_LABEL).map(([value, label]) => ({ value, label }))} />
                                            </Form.Item>
                                        </div>
                                    </>
                                ),
                            },
                            {
                                key: 'pago',
                                label: 'Datos de pago',
                                children: (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: 12 }}>
                                        <Form.Item name="bancoPago" label="Banco"><Input placeholder="Bancolombia" /></Form.Item>
                                        <Form.Item name="tipoCuenta" label="Tipo de cuenta">
                                            <Select options={[{ value: 'AHORROS', label: 'Ahorros' }, { value: 'CORRIENTE', label: 'Corriente' }]} />
                                        </Form.Item>
                                        <Form.Item name="numeroCuenta" label="Número de cuenta"><Input /></Form.Item>
                                    </div>
                                ),
                            },
                        ]}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <Button onClick={() => setModalVisible(false)}>Cancelar</Button>
                        <Button
                            type="primary" htmlType="submit" loading={guardando}
                            style={{ background: colors.primary, borderColor: colors.primary }}
                        >
                            {editando ? 'Guardar cambios' : 'Crear empleado'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}
