import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Switch, Tag, message, Popconfirm, Alert } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { centroCostoService, type CentroCosto } from '../../shared/services/contabilidadService'
import { colors } from '../../shared/theme/colors'

export default function CentrosCostoPage() {
    const navigate = useNavigate()
    const [centros, setCentros] = useState<CentroCosto[]>([])
    const [loading, setLoading] = useState(true)
    const [modalVisible, setModalVisible] = useState(false)
    const [editando, setEditando] = useState<CentroCosto | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [form] = Form.useForm()

    const cargar = () => {
        setLoading(true)
        centroCostoService.listar()
            .then(({ data }) => setCentros(data))
            .catch(() => message.error('Error al cargar los centros de costo'))
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    const abrirModal = (c?: CentroCosto) => {
        setEditando(c || null)
        if (c) form.setFieldsValue(c)
        else { form.resetFields(); form.setFieldsValue({ activo: true }) }
        setModalVisible(true)
    }

    const guardar = async (values: CentroCosto) => {
        setGuardando(true)
        try {
            if (editando?.centroCostoId) {
                await centroCostoService.actualizar(editando.centroCostoId, values)
                message.success('Centro de costo actualizado')
            } else {
                await centroCostoService.crear(values)
                message.success('Centro de costo creado')
            }
            setModalVisible(false)
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar')
        } finally {
            setGuardando(false)
        }
    }

    const eliminar = async (id: number) => {
        try {
            await centroCostoService.eliminar(id)
            message.success('Centro de costo eliminado')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo eliminar')
        }
    }

    return (
        <div>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/contabilidad')} style={{ paddingLeft: 0, marginBottom: 8 }}>
                Volver a Contabilidad
            </Button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <ApartmentOutlined style={{ marginRight: 8 }} />
                        Centros de costo
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Segmenta ingresos y gastos por área, sucursal, proyecto o línea de negocio
                    </p>
                </div>
                <Button
                    type="primary" icon={<PlusOutlined />} onClick={() => abrirModal()}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nuevo centro de costo
                </Button>
            </div>

            {centros.length === 0 && !loading && (
                <Alert
                    type="info" showIcon style={{ marginBottom: 16 }}
                    message="Todavía no tienes centros de costo"
                    description="Crea al menos uno para poder asignarlo en tus ventas y compras. Ejemplos típicos: Sede Norte, Sede Sur, Administración, Proyecto X."
                />
            )}

            <TablaOrdenable
                dataSource={centros}
                rowKey="centroCostoId"
                loading={loading}
                pagination={false}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                columns={[
                    { title: 'Código', dataIndex: 'codigo', width: 120, render: (v: string) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{v}</span> },
                    { title: 'Nombre', dataIndex: 'nombre' },
                    { title: 'Descripción', dataIndex: 'descripcion' },
                    { title: 'Responsable', dataIndex: 'responsable' },
                    {
                        title: 'Estado', dataIndex: 'activo', width: 100,
                        render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>
                    },
                    {
                        title: '', key: 'acciones', width: 90,
                        render: (_: any, r: CentroCosto) => (
                            <div style={{ display: 'flex', gap: 4 }}>
                                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => abrirModal(r)} />
                                <Popconfirm
                                    title="¿Eliminar este centro de costo?"
                                    description="Los documentos que ya lo tengan asignado conservan el nombre guardado."
                                    onConfirm={() => eliminar(r.centroCostoId!)} okText="Sí" cancelText="No"
                                >
                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </div>
                        )
                    },
                ]}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>
                    {editando ? 'Editar centro de costo' : 'Nuevo centro de costo'}
                </span>}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onFinish={guardar}>
                    <Form.Item
                        name="codigo" label="Código"
                        rules={[{ required: true, message: 'Requerido' }]}
                        extra={editando ? 'El código no se puede cambiar: ya quedó estampado en documentos anteriores.' : 'Ej: 001, NORTE, ADM'}
                    >
                        <Input placeholder="001" disabled={!!editando} />
                    </Form.Item>
                    <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Sede Norte" />
                    </Form.Item>
                    <Form.Item name="descripcion" label="Descripción">
                        <Input.TextArea rows={2} placeholder="Opcional" />
                    </Form.Item>
                    <Form.Item name="responsable" label="Responsable">
                        <Input placeholder="Nombre del encargado" />
                    </Form.Item>
                    <Form.Item name="activo" label="Activo" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setModalVisible(false)}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={guardando}
                            style={{ background: colors.primary, borderColor: colors.primary }}>
                            {editando ? 'Guardar cambios' : 'Crear'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}
