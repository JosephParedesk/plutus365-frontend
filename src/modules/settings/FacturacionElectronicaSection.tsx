import { useState, useEffect } from 'react'
import { colors } from '../../shared/theme/colors'
import { Form, Input, InputNumber, Button, message, Alert, Tag, Divider } from 'antd'
import { FileProtectOutlined, SaveOutlined } from '@ant-design/icons'
import {
    configuracionDianService,
    type ConfiguracionDian,
} from '../../shared/services/facturacionService'

export default function FacturacionElectronicaSection() {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [config, setConfig] = useState<ConfiguracionDian | null>(null)

    const cargar = () => {
        setLoading(true)
        configuracionDianService.obtener()
            .then(({ data }) => {
                // El backend nunca devuelve los secretos — se dejan en blanco,
                // solo se reemplazan si el usuario escribe unos nuevos.
                form.setFieldsValue(data)
                setConfig(data)
            })
            .catch((error) => {
                if (error.response?.status === 404) {
                    setConfig(null)
                } else {
                    message.error('Error al cargar la configuración de Factus')
                }
            })
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    const guardar = async (values: any) => {
        setGuardando(true)
        try {
            const { data } = await configuracionDianService.guardar(values)
            setConfig(data)
            message.success('Credenciales de Factus guardadas y verificadas')
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudieron guardar las credenciales')
        } finally {
            setGuardando(false)
        }
    }

    if (loading) return null

    return (
        <div style={{ maxWidth: 720, marginTop: 40 }}>
            <Divider />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.heading, margin: 0 }}>
                <FileProtectOutlined style={{ marginRight: 8 }} />
                Facturación electrónica (Factus)
                {config?.activo && <Tag color="green" style={{ marginLeft: 10 }}>Conectado</Tag>}
            </h2>
            <p style={{ color: colors.textSecondary, margin: '4px 0 20px', fontSize: 13 }}>
                Factus es tu proveedor tecnológico habilitado ante la DIAN: firma y transmite
                tus facturas por ti. Pide tus credenciales en factus.com.co y pégalas acá.
            </p>

            <Alert
                type="info"
                showIcon
                message="Credenciales por empresa"
                description="Cada empresa necesita su propia cuenta de Factus (Factus identifica al emisor por la cuenta, no por la factura). No compartas estas credenciales entre empresas distintas."
                style={{ marginBottom: 20, borderRadius: 16 }}
            />

            <Form form={form} layout="vertical" onFinish={guardar}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="factusClientId" label="Client ID" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Entregado por Factus" />
                    </Form.Item>
                    <Form.Item name="factusClientSecret" label="Client Secret" extra={config ? 'Déjalo en blanco para no cambiarlo' : undefined}>
                        <Input.Password placeholder={config ? '••••••••' : 'Entregado por Factus'} />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="factusUsername" label="Usuario" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="correo@empresa.com" />
                    </Form.Item>
                    <Form.Item name="factusPassword" label="Contraseña" extra={config ? 'Déjala en blanco para no cambiarla' : undefined}>
                        <Input.Password placeholder={config ? '••••••••' : 'Contraseña de Factus'} />
                    </Form.Item>
                </div>

                <Alert
                    type="warning"
                    showIcon
                    message="Rangos de numeración"
                    description="Solo llena esto si tu cuenta de Factus tiene más de un rango activo de facturas o de notas crédito (Factus te avisará el error si hace falta). Si solo tienes uno de cada tipo, déjalo vacío."
                    style={{ marginBottom: 16, borderRadius: 16 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="facturaNumberingRangeId" label="ID de rango — facturas (opcional)">
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="notaCreditoNumberingRangeId" label="ID de rango — notas crédito (opcional)">
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={guardando}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Guardar y verificar con Factus
                </Button>
            </Form>
        </div>
    )
}
