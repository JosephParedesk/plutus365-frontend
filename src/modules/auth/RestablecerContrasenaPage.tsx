import { useState } from 'react'
import { Form, Input, Button, message, Result } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../../shared/services/authService'
import AuthLayout from '../../shared/components/AuthLayout'
import logoPlutusOscuro from '../../assets/logo-oscuro.png'
import { colors } from '../../shared/theme/colors'

export default function RestablecerContrasenaPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') || ''
    const [loading, setLoading] = useState(false)
    const [listo, setListo] = useState(false)
    const [form] = Form.useForm()

    const onFinish = async (values: { nuevaContrasena: string }) => {
        setLoading(true)
        try {
            await authService.resetPassword(token, values.nuevaContrasena)
            setListo(true)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'El enlace no es válido o ya venció')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            eyebrow="Recuperar acceso"
            headline="Elegí una contraseña nueva"
            subtext="Por seguridad, este enlace solo funciona una vez y vence 30 minutos después de haberlo pedido."
            ocultarLogoIlustracion
        >
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <img src={logoPlutusOscuro} alt="Plutus365" style={{ height: 70, width: 'auto', marginBottom: 20 }} />
                <h1 style={{ fontSize: 26, fontWeight: 700, color: colors.heading, margin: 0 }}>Restablecer contraseña</h1>
            </div>

            {!token ? (
                <Result
                    status="error"
                    title="Enlace incompleto"
                    subTitle="Le falta el token — abrí el enlace tal como llegó en el correo, sin editarlo."
                    extra={<Button onClick={() => navigate('/login')}>Volver a iniciar sesión</Button>}
                />
            ) : listo ? (
                <Result
                    status="success"
                    title="Contraseña actualizada"
                    subTitle="Ya podés iniciar sesión con tu nueva contraseña."
                    extra={
                        <Button
                            type="primary"
                            onClick={() => navigate('/login')}
                            style={{ background: colors.primaryDark, borderColor: colors.primaryDark, borderRadius: 14, fontWeight: 600 }}
                        >
                            Ir a iniciar sesión
                        </Button>
                    }
                />
            ) : (
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Form.Item
                        name="nuevaContrasena"
                        label="Contraseña nueva"
                        rules={[
                            { required: true, message: 'Ingresa una contraseña' },
                            { min: 8, message: 'Mínimo 8 caracteres' },
                        ]}
                        hasFeedback
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: colors.primary }} />} size="large" style={{ borderRadius: 14 }} />
                    </Form.Item>
                    <Form.Item
                        name="confirmar"
                        label="Confirmar contraseña"
                        dependencies={['nuevaContrasena']}
                        hasFeedback
                        rules={[
                            { required: true, message: 'Confirmá la contraseña' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('nuevaContrasena') === value) return Promise.resolve()
                                    return Promise.reject(new Error('Las contraseñas no coinciden'))
                                },
                            }),
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: colors.primary }} />} size="large" style={{ borderRadius: 14 }} />
                    </Form.Item>

                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loading}
                        style={{ background: colors.primaryDark, borderColor: colors.primaryDark, borderRadius: 14, fontWeight: 600, height: 48, marginTop: 8 }}
                    >
                        Guardar nueva contraseña
                    </Button>
                </Form>
            )}
        </AuthLayout>
    )
}
