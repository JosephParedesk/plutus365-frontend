import { useState } from 'react'
import { Form, Input, Button, message, Checkbox, Modal } from 'antd'
import { MailOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../shared/services/authService'
import { jwtDecode } from 'jwt-decode'
import { useAuthStore } from '../../shared/store/authStore'
import AuthLayout from '../../shared/components/AuthLayout'
import logoPlutusOscuro from '../../assets/logo-oscuro.png'
import { colors } from '../../shared/theme/colors'

export default function LoginPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [form] = Form.useForm()

    const [modalOlvideVisible, setModalOlvideVisible] = useState(false)
    const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false)
    const [formOlvide] = Form.useForm()

    const pedirRecuperacion = async (values: { email: string }) => {
        setEnviandoRecuperacion(true)
        try {
            await authService.forgotPassword(values.email)
            message.success('Si el correo existe, te enviamos un enlace para restablecer tu contraseña')
            setModalOlvideVisible(false)
            formOlvide.resetFields()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo enviar el correo de recuperación')
        } finally {
            setEnviandoRecuperacion(false)
        }
    }

const onFinish = async (values: any) => {
    setLoading(true)
    try {
        const { data } = await authService.login(values.email, values.password, !!values.recordarme)

        const decoded: any = jwtDecode(data.accessToken)

        const { setTokens, setUsuario } = useAuthStore.getState()
        setTokens(data.accessToken, data.refreshToken, !!values.recordarme)
        setUsuario({
            cedula: decoded.cedula,
            nombre: decoded.nombre,
            correo: decoded.sub,
            rol: decoded.rol,
            planId: decoded.planId,
            empresaId: decoded.empresaId,
        })

        message.success(`¡Bienvenido ${decoded.nombre}!`)
        navigate('/dashboard')
    } catch (error: any) {
        message.error(error.response?.data?.message || 'Credenciales incorrectas')
    } finally {
        setLoading(false)
    }
}
    return (
        <AuthLayout
            eyebrow="Bienvenido de nuevo"
            headline="Todo tu negocio, en un solo lugar"
            subtext="Ventas, inventario, compras y contabilidad conectados en un solo lugar. Así no tienes que perseguir la información entre cinco cuadernos distintos."
            ocultarLogoIlustracion
        >
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <img src={logoPlutusOscuro} alt="Plutus365" style={{ height: 70, width: 'auto', marginBottom: 20 }} />
                <h1 style={{ fontSize: 26, fontWeight: 700, color: colors.heading, margin: 0 }}>Iniciar sesión</h1>
                <p style={{ color: colors.textMuted, marginTop: 6, fontSize: 14 }}>Ingresa a tu cuenta POS</p>
            </div>

            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ recordarme: false }}>
                <Form.Item name="email" label="Correo electrónico" rules={[{ required: true, type: 'email', message: 'Ingresa un email válido' }]}>
                    <Input
                        prefix={<MailOutlined style={{ color: colors.primary }} />}
                        size="large"
                        style={{ borderRadius: 14 }}
                    />
                </Form.Item>

                    <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
                        <Input.Password
                            prefix={<LockOutlined style={{ color: colors.primary }} />}
                            size="large"
                            style={{ borderRadius: 14 }}
                        />
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <Form.Item name="recordarme" valuePropName="checked" noStyle>
                            <Checkbox style={{ color: colors.textSecondary }}>Recordarme</Checkbox>
                        </Form.Item>
                        <span
                            onClick={() => setModalOlvideVisible(true)}
                            style={{ color: colors.primary, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                        >
                            ¿Olvidaste tu contraseña?
                        </span>
                    </div>

                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loading}
                        style={{ background: colors.primaryDark, borderColor: colors.primaryDark, borderRadius: 14, fontWeight: 600, height: 48 }}
                    >
                        Ingresar
                    </Button>
                </Form>

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Recuperar contraseña</span>}
                open={modalOlvideVisible}
                onCancel={() => { setModalOlvideVisible(false); formOlvide.resetFields() }}
                footer={null}
                destroyOnHidden
            >
                <p style={{ color: colors.textMuted, fontSize: 13.5, marginBottom: 16 }}>
                    Escribí el correo con el que te registraste. Si existe una cuenta, te
                    mandamos un enlace para restablecer la contraseña (vence en 30 minutos).
                </p>
                <Form form={formOlvide} layout="vertical" onFinish={pedirRecuperacion}>
                    <Form.Item name="email" label="Correo electrónico" rules={[{ required: true, type: 'email', message: 'Ingresa un email válido' }]}>
                        <Input prefix={<MailOutlined style={{ color: colors.primary }} />} size="large" style={{ borderRadius: 14 }} />
                    </Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        size="large"
                        loading={enviandoRecuperacion}
                        style={{ background: colors.primaryDark, borderColor: colors.primaryDark, borderRadius: 14, fontWeight: 600 }}
                    >
                        Enviar enlace de recuperación
                    </Button>
                </Form>
            </Modal>
        </AuthLayout>
    )
}