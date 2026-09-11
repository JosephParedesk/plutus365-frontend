import { useState, useEffect } from 'react'
import { colors } from '../../shared/theme/colors'
import { Table, Button, Input, Tag, Space, Modal, Form, message, Popconfirm, Card, Row, Col, Statistic, Select } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import {
    PlusOutlined, SearchOutlined, EditOutlined,
    DeleteOutlined, CarOutlined, PhoneOutlined, MailOutlined
} from '@ant-design/icons'
import { proveedorService } from '../../shared/services/proveedorService'
import type { Proveedor } from '../../shared/services/proveedorService'

export default function ProveedoresPage() {
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [loading, setLoading] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'activo' | 'inactivo'>('todos')
    const [modalVisible, setModalVisible] = useState(false)
    const [editando, setEditando] = useState<Proveedor | null>(null)
    const [loadingModal, setLoadingModal] = useState(false)
    const [form] = Form.useForm()

    const cargarProveedores = () => {
        setLoading(true)
        proveedorService.listar()
            .then(({ data }) => setProveedores(data))
            .catch(() => message.error('Error al cargar proveedores'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        cargarProveedores()
    }, [])

    const proveedoresFiltrados = proveedores.filter(p => {
        const coincideTexto = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.nit.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.ciudad?.toLowerCase().includes(busqueda.toLowerCase())
        const coincideEstado = estadoFiltro === 'todos' ||
            (estadoFiltro === 'activo' ? p.activo : !p.activo)
        return coincideTexto && coincideEstado
    })

    const abrirModal = (proveedor?: Proveedor) => {
        if (proveedor) {
            setEditando(proveedor)
            form.setFieldsValue(proveedor)
        } else {
            setEditando(null)
            form.resetFields()
        }
        setModalVisible(true)
    }

    const guardarProveedor = async (values: any) => {
        setLoadingModal(true)
        try {
            if (editando) {
                await proveedorService.actualizar(editando.proveedorId, values)
                message.success('Proveedor actualizado')
            } else {
                await proveedorService.guardar(values)
                message.success('Proveedor creado')
            }
            cargarProveedores()
            setModalVisible(false)
            form.resetFields()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar el proveedor')
        } finally {
            setLoadingModal(false)
        }
    }

    const eliminarProveedor = async (proveedorId: number) => {
        try {
            await proveedorService.eliminar(proveedorId)
            message.success('Proveedor eliminado')
            cargarProveedores()
        } catch {
            message.error('Error al eliminar')
        }
    }

    const columnas = [
        {
            title: 'NIT',
            dataIndex: 'nit',
            key: 'nit',
            render: (v: string) => <span style={{ fontWeight: 600, color: colors.primary, fontFamily: 'monospace' }}>{v}</span>
        },
        {
            title: 'Proveedor',
            dataIndex: 'nombre',
            key: 'nombre',
            render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>
        },
        {
            title: 'Contacto',
            dataIndex: 'contacto',
            key: 'contacto',
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
            title: 'Crédito',
            dataIndex: 'plazoCredito',
            key: 'plazoCredito',
            render: (v: string) => v || '-'
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
            render: (_: any, record: Proveedor) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => abrirModal(record)}
                        style={{ color: colors.primary }}
                    />
                    <Popconfirm
                        title="¿Eliminar proveedor?"
                        description="Esta acción no se puede deshacer"
                        onConfirm={() => eliminarProveedor(record.proveedorId)}
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
                        <CarOutlined style={{ marginRight: 8 }} />
                        Proveedores
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: 0, fontSize: 13 }}>
                        {proveedores.length} proveedores registrados
                    </p>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => abrirModal()}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nuevo proveedor
                </Button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <Input
                    placeholder="Buscar por nombre, NIT o ciudad..."
                    prefix={<SearchOutlined style={{ color: colors.primary }} />}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={{ borderRadius: 14, maxWidth: 400 }}
                    allowClear
                />
                <Select
                    value={estadoFiltro}
                    onChange={setEstadoFiltro}
                    style={{ minWidth: 160 }}
                    options={[
                        { value: 'todos', label: 'Todos los estados' },
                        { value: 'activo', label: 'Activos' },
                        { value: 'inactivo', label: 'Inactivos' },
                    ]}
                />
            </div>

            <TablaOrdenable
                dataSource={proveedoresFiltrados}
                columns={columnas}
                rowKey="proveedorId"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                scroll={{ x: 900 }}
            />

            <Modal
                title={
                    <span style={{ color: colors.heading, fontWeight: 700 }}>
                        {editando ? 'Editar proveedor' : 'Nuevo proveedor'}
                    </span>
                }
                open={modalVisible}
                onCancel={() => { setModalVisible(false); form.resetFields() }}
                footer={null}
                width={600}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onFinish={guardarProveedor} style={{ marginTop: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="nit" label="NIT" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="900123456-1" style={{ borderRadius: 14 }} />
                        </Form.Item>
                        <Form.Item name="nombre" label="Nombre / Razón social" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="Distribuidora XYZ" style={{ borderRadius: 14 }} />
                        </Form.Item>
                    </div>

                    <Form.Item name="contacto" label="Persona de contacto">
                        <Input placeholder="Juan Pérez" style={{ borderRadius: 14 }} />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="telefono" label="Teléfono" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="3001234567" style={{ borderRadius: 14 }} />
                        </Form.Item>
                        <Form.Item name="correo" label="Correo" rules={[{ required: true, type: 'email', message: 'Email inválido' }]}>
                            <Input placeholder="contacto@proveedor.com" style={{ borderRadius: 14 }} />
                        </Form.Item>
                    </div>

                    <Form.Item name="direccion" label="Dirección">
                        <Input placeholder="Calle 123 # 45-67" style={{ borderRadius: 14 }} />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="ciudad" label="Ciudad">
                            <Input placeholder="Bogotá" style={{ borderRadius: 14 }} />
                        </Form.Item>
                        <Form.Item name="plazoCredito" label="Plazo de crédito">
                            <Input placeholder="30 días" style={{ borderRadius: 14 }} />
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
                            {editando ? 'Guardar cambios' : 'Crear proveedor'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}