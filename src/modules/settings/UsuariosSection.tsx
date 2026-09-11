import { useState, useEffect } from 'react'
import { colors } from '../../shared/theme/colors'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Progress } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { UserAddOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons'
import { authService } from '../../shared/services/authService'
import { ROLES_DISPONIBLES, type Rol } from '../../shared/utils/permisos'
import { useAuthStore } from '../../shared/store/authStore'

interface Empleado {
    cedula: string
    tipoDocumento: string
    nombre: string
    correo: string
    telefono: string
    rol: Rol
}

const LIMITE_POR_PLAN: Record<number, number> = { 1: 2, 2: 10, 3: 999 }
const colorRol: Record<Rol, string> = { ADMIN: 'purple', CAJERO: 'green', CONTADOR: 'blue', INVENTARIO: 'orange' }

export default function UsuariosSection() {
    const { usuario } = useAuthStore()
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)
    const [modalVisible, setModalVisible] = useState(false)
    const [form] = Form.useForm()
    const [creando, setCreando] = useState(false)

    const limite = LIMITE_POR_PLAN[usuario?.planId ?? 1] ?? 2

    const cargar = () => {
        setLoading(true)
        authService.listarEmpleados()
            .then(({ data }: any) => setEmpleados(data))
            .catch(() => message.error('Error al cargar los usuarios'))
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    const crearUsuario = async (values: any) => {
        setCreando(true)
        try {
            await authService.crearEmpleado(values)
            message.success('Usuario creado correctamente')
            setModalVisible(false)
            form.resetFields()
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al crear el usuario')
        } finally {
            setCreando(false)
        }
    }

    const eliminarUsuario = async (cedula: string) => {
        try {
            await authService.eliminar(cedula)
            message.success('Usuario eliminado')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo eliminar el usuario')
        }
    }

    const columnas = [
        { title: 'Nombre', dataIndex: 'nombre' },
        { title: 'Correo', dataIndex: 'correo' },
        { title: 'Documento', dataIndex: 'cedula' },
        {
            title: 'Rol', dataIndex: 'rol',
            render: (v: Rol) => <Tag color={colorRol[v] || 'default'}>{ROLES_DISPONIBLES.find(r => r.value === v)?.label || v}</Tag>
        },
        {
            title: '', key: 'acciones',
            render: (_: any, record: Empleado) => (
                record.cedula === usuario?.cedula ? null : (
                    <Popconfirm title="¿Eliminar este usuario?" onConfirm={() => eliminarUsuario(record.cedula)} okText="Sí" cancelText="No">
                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                )
            )
        },
    ]

    return (
        <Card
            style={{ borderRadius: 18, marginTop: 20 }}
            title={<span style={{ fontWeight: 700 }}><TeamOutlined style={{ marginRight: 8 }} />Usuarios y roles</span>}
            extra={
                <Button
                    type="primary" icon={<UserAddOutlined />}
                    onClick={() => { form.resetFields(); setModalVisible(true) }}
                    disabled={empleados.length >= limite}
                >
                    Nuevo usuario
                </Button>
            }
        >
            <div style={{ marginBottom: 16, maxWidth: 320 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: colors.textSecondary, marginBottom: 4 }}>
                    <span>Usuarios de tu plan</span>
                    <span>{empleados.length} / {limite === 999 ? 'ilimitado' : limite}</span>
                </div>
                <Progress percent={limite === 999 ? 0 : Math.round((empleados.length / limite) * 100)} showInfo={false} size="small" />
            </div>

            <TablaOrdenable dataSource={empleados} columns={columnas} rowKey="cedula" loading={loading} pagination={false} />

            <Modal
                title="Nuevo usuario"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onFinish={crearUsuario}>
                    <Form.Item name="nombre" label="Nombre completo" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="María Pérez" />
                    </Form.Item>
                    <Form.Item name="cedula" label="Número de documento" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="1023456789" />
                    </Form.Item>
                    <Form.Item name="tipoDocumento" label="Tipo de documento" initialValue="CC" rules={[{ required: true }]}>
                        <Select options={[{ value: 'CC', label: 'Cédula de ciudadanía' }, { value: 'CE', label: 'Cédula de extranjería' }]} />
                    </Form.Item>
                    <Form.Item name="correo" label="Correo" rules={[{ required: true, type: 'email', message: 'Correo inválido' }]}>
                        <Input placeholder="maria@tuempresa.com" />
                    </Form.Item>
                    <Form.Item name="telefono" label="Teléfono">
                        <Input placeholder="3001234567" />
                    </Form.Item>
                    <Form.Item name="contrasena" label="Contraseña temporal" rules={[{ required: true, min: 6, message: 'Mínimo 6 caracteres' }]}>
                        <Input.Password placeholder="La puede cambiar después" />
                    </Form.Item>
                    <Form.Item name="rol" label="Rol" rules={[{ required: true, message: 'Requerido' }]}>
                        <Select
                            placeholder="Elige el rol"
                            options={ROLES_DISPONIBLES.map(r => ({ value: r.value, label: r.label }))}
                            optionRender={(opt) => {
                                const r = ROLES_DISPONIBLES.find(x => x.value === opt.value)
                                return (
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{r?.label}</div>
                                        <div style={{ fontSize: 11.5, color: colors.textMuted }}>{r?.descripcion}</div>
                                    </div>
                                )
                            }}
                        />
                    </Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setModalVisible(false)}>Cancelar</Button>
                        <Button type="primary" htmlType="submit" loading={creando}>Crear usuario</Button>
                    </div>
                </Form>
            </Modal>
        </Card>
    )
}
