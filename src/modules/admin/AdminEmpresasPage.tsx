import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { colors } from '../../shared/theme/colors'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, message, Alert, Divider } from 'antd'
import { CrownOutlined, FileProtectOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../shared/store/authStore'
import { adminService, type EmpresaAdminResumen } from '../../shared/services/adminService'
import type { ConfiguracionDian } from '../../shared/services/facturacionService'

// Panel exclusivo del super administrador de Plutus365 (rol SUPERADMIN): acá
// se cargan las credenciales de Factus que llegan por cada empresa cuando
// termina su proceso de onboarding (Plutus365 manda los documentos, Factus
// responde con usuario/clave para esa empresa) — la empresa no las autogestiona.
export default function AdminEmpresasPage() {
    const usuario = useAuthStore(s => s.usuario)
    const [empresas, setEmpresas] = useState<EmpresaAdminResumen[]>([])
    const [loading, setLoading] = useState(true)
    const [modalVisible, setModalVisible] = useState(false)
    const [empresaSeleccionada, setEmpresaSeleccionada] = useState<EmpresaAdminResumen | null>(null)
    const [configActual, setConfigActual] = useState<ConfiguracionDian | null>(null)
    const [cargandoConfig, setCargandoConfig] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [form] = Form.useForm()

    const cargarEmpresas = () => {
        setLoading(true)
        adminService.listarEmpresas()
            .then(({ data }) => setEmpresas(data))
            .catch(() => message.error('Error al cargar las empresas'))
            .finally(() => setLoading(false))
    }

    useEffect(cargarEmpresas, [])

    const abrirModal = (empresa: EmpresaAdminResumen) => {
        setEmpresaSeleccionada(empresa)
        setConfigActual(null)
        form.resetFields()
        setModalVisible(true)
        setCargandoConfig(true)
        adminService.obtenerFactus(empresa.empresaId)
            .then(({ data }) => {
                form.setFieldsValue(data)
                setConfigActual(data)
            })
            .catch((error) => {
                if (error.response?.status !== 404) message.error('Error al cargar las credenciales de Factus')
            })
            .finally(() => setCargandoConfig(false))
    }

    const guardar = async (values: any) => {
        if (!empresaSeleccionada) return
        setGuardando(true)
        try {
            await adminService.guardarFactus(empresaSeleccionada.empresaId, values)
            message.success('Credenciales de Factus guardadas y verificadas')
            setModalVisible(false)
            cargarEmpresas()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudieron guardar las credenciales')
        } finally {
            setGuardando(false)
        }
    }

    if (usuario?.rol !== 'SUPERADMIN') return <Navigate to="/dashboard" />

    return (
        <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                <CrownOutlined style={{ marginRight: 8 }} />
                Panel de super administrador
            </h2>
            <p style={{ color: colors.textSecondary, margin: '4px 0 20px', fontSize: 13 }}>
                Credenciales de Factus por empresa. Solo vos ves esta pantalla.
            </p>

            <Table
                rowKey="empresaId"
                loading={loading}
                dataSource={empresas}
                pagination={false}
                columns={[
                    { title: 'Empresa', dataIndex: 'nombre' },
                    {
                        title: 'Documento', key: 'documento',
                        render: (_, e) => `${e.tipoDocumento} ${e.numeroDocumento}`,
                    },
                    { title: 'Correo', dataIndex: 'correo' },
                    {
                        title: 'Factus', dataIndex: 'factusConfigurado',
                        render: (v: boolean) => v
                            ? <Tag color="green">Configurado</Tag>
                            : <Tag color="orange">Sin configurar</Tag>,
                    },
                    {
                        title: '', key: 'acciones',
                        render: (_, e) => (
                            <Button size="small" icon={<FileProtectOutlined />} onClick={() => abrirModal(e)}>
                                Credenciales Factus
                            </Button>
                        ),
                    },
                ]}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Factus — {empresaSeleccionada?.nombre}</span>}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                confirmLoading={guardando}
                okText="Guardar y verificar"
                cancelText="Cancelar"
                width={620}
            >
                {!cargandoConfig && (
                    <Form form={form} layout="vertical" onFinish={guardar}>
                        <Alert
                            type="info"
                            showIcon
                            message="Estas son las credenciales que entrega Factus para esta empresa"
                            style={{ marginBottom: 20, borderRadius: 16 }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Form.Item name="factusClientId" label="Client ID" rules={[{ required: true, message: 'Requerido' }]}>
                                <Input placeholder="Entregado por Factus" />
                            </Form.Item>
                            <Form.Item name="factusClientSecret" label="Client Secret" extra={configActual ? 'Déjalo en blanco para no cambiarlo' : undefined}>
                                <Input.Password placeholder={configActual ? '••••••••' : 'Entregado por Factus'} />
                            </Form.Item>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Form.Item name="factusUsername" label="Usuario" rules={[{ required: true, message: 'Requerido' }]}>
                                <Input placeholder="correo@empresa.com" />
                            </Form.Item>
                            <Form.Item name="factusPassword" label="Contraseña" extra={configActual ? 'Déjala en blanco para no cambiarla' : undefined}>
                                <Input.Password placeholder={configActual ? '••••••••' : 'Contraseña de Factus'} />
                            </Form.Item>
                        </div>

                        <Divider style={{ margin: '8px 0 16px' }} />
                        <Alert
                            type="warning"
                            showIcon
                            message="Rangos de numeración (opcional)"
                            description="Solo llenar si la cuenta de Factus de esta empresa tiene más de un rango activo de ese tipo de documento."
                            style={{ marginBottom: 16, borderRadius: 16 }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Form.Item name="facturaNumberingRangeId" label="ID de rango — facturas">
                                <InputNumber style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item name="notaCreditoNumberingRangeId" label="ID de rango — notas crédito">
                                <InputNumber style={{ width: '100%' }} />
                            </Form.Item>
                        </div>
                    </Form>
                )}
            </Modal>
        </div>
    )
}
