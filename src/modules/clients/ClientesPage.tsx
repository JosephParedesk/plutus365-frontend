import { useState, useEffect } from 'react'
import { colors } from '../../shared/theme/colors'
import { Table, Button, Input, Tag, Space, Modal, Form, message, Popconfirm, Select } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    PlusOutlined, SearchOutlined, EditOutlined,
    DeleteOutlined, TeamOutlined, PhoneOutlined, MailOutlined
} from '@ant-design/icons'
import { clienteService } from '../../shared/services/clienteService'
import type { Cliente } from '../../shared/services/clienteService'

const TIPOS_DOCUMENTO = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'NIT', label: 'NIT' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'PASAPORTE', label: 'Pasaporte' },
    { value: 'TI', label: 'Tarjeta de identidad' },
    { value: 'RC', label: 'Registro civil' },
]

const REGIMENES_FISCALES = [
    { value: 'RESPONSABLE_IVA', label: 'Responsable de IVA' },
    { value: 'NO_RESPONSABLE_IVA', label: 'No responsable de IVA' },
]

const nombreVisible = (c: Cliente) =>
    c.tipoPersona === 'JURIDICA'
        ? c.razonSocial || '-'
        : [c.nombres, c.apellidos].filter(Boolean).join(' ') || '-'

export default function ClientesPage() {
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [loading, setLoading] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const [modalVisible, setModalVisible] = useState(false)
    const [editando, setEditando] = useState<Cliente | null>(null)
    const [loadingModal, setLoadingModal] = useState(false)
    const [form] = Form.useForm()

    const tipoPersona = Form.useWatch('tipoPersona', form)
    const tipoDocumento = Form.useWatch('tipoDocumento', form)

    const cargarClientes = () => {
        setLoading(true)
        clienteService.listar()
            .then(({ data }) => setClientes(data))
            .catch(() => message.error('Error al cargar clientes'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        cargarClientes()
    }, [])

    const clientesFiltrados = clientes.filter(c =>
        nombreVisible(c).toLowerCase().includes(busqueda.toLowerCase()) ||
        c.numeroDocumento.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.correo?.toLowerCase().includes(busqueda.toLowerCase())
    )

    const abrirModal = (cliente?: Cliente) => {
        if (cliente) {
            setEditando(cliente)
            form.setFieldsValue(cliente)
        } else {
            setEditando(null)
            form.resetFields()
            form.setFieldsValue({ tipoPersona: 'NATURAL', tipoDocumento: 'CC', pais: 'Colombia' })
        }
        setModalVisible(true)
    }

    const guardarCliente = async (values: any) => {
        setLoadingModal(true)
        try {
            if (editando) {
                await clienteService.actualizar(editando.clienteId, values)
                message.success('Cliente actualizado')
            } else {
                await clienteService.guardar(values)
                message.success('Cliente creado')
            }
            cargarClientes()
            setModalVisible(false)
            form.resetFields()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar el cliente')
        } finally {
            setLoadingModal(false)
        }
    }

    const eliminarCliente = async (clienteId: number) => {
        try {
            await clienteService.eliminar(clienteId)
            message.success('Cliente eliminado')
            cargarClientes()
        } catch {
            message.error('Error al eliminar')
        }
    }

    const columnas = [
        {
            title: 'Documento',
            key: 'documento',
            render: (_: any, c: Cliente) => (
                <span style={{ fontWeight: 600, color: colors.primary, fontFamily: 'monospace' }}>
                    {c.tipoDocumento} {c.numeroDocumento}{c.dv ? `-${c.dv}` : ''}
                </span>
            )
        },
        {
            title: 'Cliente',
            key: 'nombre',
            render: (_: any, c: Cliente) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{nombreVisible(c)}</div>
                    <Tag color={c.tipoPersona === 'JURIDICA' ? 'blue' : 'purple'} style={{ borderRadius: 10, marginTop: 2 }}>
                        {c.tipoPersona === 'JURIDICA' ? 'Jurídica' : 'Natural'}
                    </Tag>
                </div>
            )
        },
        {
            title: 'Teléfono',
            dataIndex: 'telefono',
            key: 'telefono',
            render: (v: string) => (
                <Space>
                    <PhoneOutlined style={{ color: colors.textMuted }} />
                    {v}
                </Space>
            )
        },
        {
            title: 'Correo',
            dataIndex: 'correo',
            key: 'correo',
            render: (v: string) => (
                <Space>
                    <MailOutlined style={{ color: colors.textMuted }} />
                    {v}
                </Space>
            )
        },
        {
            title: 'Ciudad',
            dataIndex: 'ciudad',
            key: 'ciudad',
            render: (v: string) => v ? <Tag color="red" style={{ borderRadius: 10 }}>{v}</Tag> : '-'
        },
        {
            title: 'Régimen',
            dataIndex: 'regimenFiscal',
            key: 'regimenFiscal',
            render: (v: string) => v === 'RESPONSABLE_IVA' ? 'Responsable IVA' : v === 'NO_RESPONSABLE_IVA' ? 'No responsable IVA' : '-'
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
            render: (_: any, record: Cliente) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => abrirModal(record)}
                        style={{ color: colors.primary }}
                    />
                    <Popconfirm
                        title="¿Eliminar cliente?"
                        description="Esta acción no se puede deshacer"
                        onConfirm={() => eliminarCliente(record.clienteId)}
                        okText="Sí, eliminar"
                        cancelText="Cancelar"
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <TeamOutlined style={{ marginRight: 8 }} />
                        Clientes
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: 0, fontSize: 13 }}>
                        {clientes.length} clientes registrados
                    </p>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => abrirModal()}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nuevo cliente
                </Button>
            </div>

            <Input
                placeholder="Buscar por nombre, documento o correo..."
                prefix={<SearchOutlined style={{ color: colors.primary }} />}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ marginBottom: 16, borderRadius: 14, maxWidth: 400 }}
                allowClear
            />

            <TablaOrdenable
                dataSource={clientesFiltrados}
                columns={columnas}
                rowKey="clienteId"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                scroll={{ x: 1000 }}
            />

            <Modal
                title={
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        {editando ? 'Editar cliente' : 'Nuevo cliente'}
                    </span>
                }
                open={modalVisible}
                onCancel={() => { setModalVisible(false); form.resetFields() }}
                footer={null}
                width={640}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onFinish={guardarCliente} style={{ marginTop: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="tipoPersona" label="Tipo de persona" rules={[{ required: true, message: 'Requerido' }]}>
                            <Select
                                options={[
                                    { value: 'NATURAL', label: 'Persona natural' },
                                    { value: 'JURIDICA', label: 'Persona jurídica' },
                                ]}
                                style={{ borderRadius: 14 }}
                            />
                        </Form.Item>
                        <Form.Item name="regimenFiscal" label="Régimen fiscal" rules={[{ required: true, message: 'Requerido' }]}>
                            <Select options={REGIMENES_FISCALES} style={{ borderRadius: 14 }} />
                        </Form.Item>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: tipoDocumento === 'NIT' ? '1fr 1fr 0.6fr' : '1fr 1fr', gap: 16 }}>
                        <Form.Item name="tipoDocumento" label="Tipo de documento" rules={[{ required: true, message: 'Requerido' }]}>
                            <Select options={TIPOS_DOCUMENTO} style={{ borderRadius: 14 }} />
                        </Form.Item>
                        <Form.Item name="numeroDocumento" label="Número de documento" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="1234567890" style={{ borderRadius: 14 }} />
                        </Form.Item>
                        {tipoDocumento === 'NIT' && (
                            <Form.Item name="dv" label="DV" rules={[{ required: true, message: 'Requerido' }]}>
                                <Input placeholder="1" maxLength={1} style={{ borderRadius: 14 }} />
                            </Form.Item>
                        )}
                    </div>

                    {tipoPersona === 'JURIDICA' ? (
                        <Form.Item name="razonSocial" label="Razón social" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="Comercializadora XYZ S.A.S." style={{ borderRadius: 14 }} />
                        </Form.Item>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Form.Item name="nombres" label="Nombres" rules={[{ required: true, message: 'Requerido' }]}>
                                <Input placeholder="Juan Carlos" style={{ borderRadius: 14 }} />
                            </Form.Item>
                            <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true, message: 'Requerido' }]}>
                                <Input placeholder="Gómez Ruiz" style={{ borderRadius: 14 }} />
                            </Form.Item>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="telefono" label="Teléfono" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="3001234567" style={{ borderRadius: 14 }} />
                        </Form.Item>
                        <Form.Item name="correo" label="Correo" rules={[{ required: true, type: 'email', message: 'Email inválido' }]}>
                            <Input placeholder="cliente@correo.com" style={{ borderRadius: 14 }} />
                        </Form.Item>
                    </div>

                    <Form.Item name="direccion" label="Dirección">
                        <Input placeholder="Calle 123 # 45-67" style={{ borderRadius: 14 }} />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        <Form.Item name="ciudad" label="Ciudad">
                            <Input placeholder="Bogotá" style={{ borderRadius: 14 }} />
                        </Form.Item>
                        <Form.Item name="departamento" label="Departamento">
                            <Input placeholder="Cundinamarca" style={{ borderRadius: 14 }} />
                        </Form.Item>
                        <Form.Item name="pais" label="País">
                            <Input placeholder="Colombia" style={{ borderRadius: 14 }} />
                        </Form.Item>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <Button onClick={() => { setModalVisible(false); form.resetFields() }}>
                            Cancelar
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loadingModal}
                            style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14 }}
                        >
                            {editando ? 'Guardar cambios' : 'Crear cliente'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}
