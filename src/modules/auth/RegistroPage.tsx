import { useState } from "react";
import { Form, Input, Button, Steps, message, Checkbox, Select } from 'antd'
import { UserOutlined, MailOutlined, LockOutlined, PhoneOutlined, ShopOutlined, IdcardOutlined } from '@ant-design/icons'

import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from '../../shared/services/authService'
import AuthLayout from '../../shared/components/AuthLayout'
import { colors } from '../../shared/theme/colors'

export default function RegistroPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const plan = searchParams.get("plan") || "basico";
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const [password, setPassword] = useState('')

    const requisitos = [
        { label: 'Una mayúscula', cumple: /[A-Z]/.test(password) },
        { label: 'Mínimo 8 caracteres', cumple: password.length >= 8 },
        { label: 'Un número', cumple: /[0-9]/.test(password) },
        { label: 'Un carácter especial: $ % * @ ? - ! _ / +', cumple: /[$%*@?!\-_/+]/.test(password) },
    ]
    const planNombres: Record<string, string> = {
        basico: "Básico: $89.900/mes",
        profesional: "Profesional: $189.900/mes",
        empresarial: "Empresarial: $349.900/mes",
    };

    const onFinish = async (values: any) => {
        setLoading(true)
        try {
            const payload = {
                cedula: values.cedula,
                tipoDocumento: values.tipoDocumento,
                nombre: values.nombre,
                correo: values.email,
                contrasena: values.password,
                telefono: values.telefono,
                planId: Number(plan)
            }
            await authService.registro(payload)
            message.success('Cuenta creada exitosamente')
            navigate(`/pago?plan=${plan}&cedula=${values.cedula}`)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al crear la cuenta')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            eyebrow="Primeros pasos"
            headline="Monta tu tienda en menos de 5 minutos"
            subtext="Sin instalaciones, sin papeleo. Creas tu cuenta, eliges tu plan, y ya puedes empezar a vender."
            ancho={480}
        >
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            color: colors.heading,
                            margin: 0,
                        }}
                    >
                        Crear cuenta
                    </h1>
                    <p style={{ color: colors.textMuted, marginTop: 8 }}>
                        Plan seleccionado:{" "}
                        <strong style={{ color: colors.primary }}>{planNombres[plan]}</strong>
                    </p>
                </div>

                <Steps
                    size="small"
                    current={0}
                    style={{ marginBottom: 32 }}
                    items={[
                        { title: "Registro" },
                        { title: "Pago" },
                        { title: "Activación" },
                    ]}
                />

                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Form.Item name="tipoDocumento" label="Tipo de documento" rules={[{ required: true, message: 'Selecciona el tipo de documento' }]}>
                        <Select
                            size="large"
                            style={{ borderRadius: 14 }}
                        >
                            <Select.Option value="CC">Cédula de ciudadanía</Select.Option>
                            <Select.Option value="CE">Cédula de extranjería</Select.Option>
                            <Select.Option value="NIT">NIT</Select.Option>
                            <Select.Option value="PP">Pasaporte</Select.Option>
                            <Select.Option value="TI">Tarjeta de identidad</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item name="cedula" label="Número de documento" rules={[{ required: true, message: 'Ingresa tu número de documento' }]}>
                        <Input
                            prefix={<IdcardOutlined style={{ color: colors.primary }} />}
                            size="large"
                            style={{ borderRadius: 14 }}
                        />
                    </Form.Item>
                    <Form.Item
                        name="nombre"
                        label="Nombre completo"
                        rules={[{ required: true, message: "Ingresa tu nombre" }]}
                    >
                        <Input
                            prefix={<UserOutlined style={{ color: colors.primary }} />}
                            size="large"
                            style={{ borderRadius: 14 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="empresa"
                        label="Nombre de la empresa"
                        rules={[
                            { required: true, message: "Ingresa el nombre de tu empresa" },
                        ]}
                    >
                        <Input
                            prefix={<ShopOutlined style={{ color: colors.primary }} />}
                            size="large"
                            style={{ borderRadius: 14 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="email"
                        label="Correo electrónico"
                        rules={[
                            {
                                required: true,
                                type: "email",
                                message: "Ingresa un email válido",
                            },
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined style={{ color: colors.primary }} />}
                            size="large"
                            style={{ borderRadius: 14 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="telefono"
                        label="Teléfono"
                        rules={[{ required: true, message: "Ingresa tu teléfono" }]}
                    >
                        <Input
                            prefix={<PhoneOutlined style={{ color: colors.primary }} />}
                            size="large"
                            style={{ borderRadius: 14 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="Contraseña"
                        rules={[
                            { required: true, message: 'Ingresa tu contraseña' },
                            () => ({
                                validator(_, value) {
                                    if (!value) return Promise.resolve()
                                    if (!/[A-Z]/.test(value)) return Promise.reject('Agrega al menos una mayúscula')
                                    if (value.length < 8) return Promise.reject('Mínimo 8 caracteres')
                                    if (!/[0-9]/.test(value)) return Promise.reject('Agrega al menos un número')
                                    if (!/[$%*@?!\-_/+]/.test(value)) return Promise.reject('Agrega un carácter especial: $ % * @ ? - ! _ / +')
                                    return Promise.resolve()
                                },
                            }),
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: colors.primary }} />}
                            size="large"
                            style={{ borderRadius: 14 }}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </Form.Item>

                    {password.length > 0 && (
                        <div style={{ background: colors.primaryLight, borderRadius: 16, padding: '12px 16px', marginBottom: 16 }}>
                            <p style={{ fontWeight: 600, color: colors.heading, marginBottom: 10, fontSize: 13 }}>Debe contener:</p>
                            {requisitos.map((r, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <div style={{
                                        width: 24, height: 24, borderRadius: '50%',
                                        background: r.cumple ? colors.primary : '#fff',
                                        border: r.cumple ? `2px solid ${colors.primary}` : `2px solid ${colors.border}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 700,
                                        color: r.cumple ? '#fff' : colors.textMuted,
                                        transition: 'all 0.3s ease',
                                        flexShrink: 0,
                                    }}>
                                        {i + 1}
                                    </div>
                                    <span style={{ fontSize: 13, color: r.cumple ? colors.primary : colors.textMuted, fontWeight: r.cumple ? 600 : 400, transition: 'all 0.3s ease' }}>
                                        {r.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <Form.Item
                        name="confirmar"
                        label="Confirmar contraseña"
                        rules={[
                            { required: true, message: "Confirma tu contraseña" },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue("password") === value)
                                        return Promise.resolve();
                                    return Promise.reject("Las contraseñas no coinciden");
                                },
                            }),
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: colors.primary }} />}
                            size="large"
                            style={{ borderRadius: 14 }}
                        />
                    </Form.Item>

                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loading}
                        style={{
                            background: colors.primaryDark,
                            borderColor: colors.primaryDark,
                            borderRadius: 14,
                            fontWeight: 600,
                            height: 48,
                        }}
                    >
                        Crear cuenta
                    </Button>
                </Form>

                <p
                    style={{
                        textAlign: "center",
                        marginTop: 20,
                        color: colors.textMuted,
                        fontSize: 14,
                    }}
                >
                    ¿Ya tienes cuenta?{" "}
                    <span
                        onClick={() => navigate("/login")}
                        style={{ color: colors.primary, cursor: "pointer", fontWeight: 600 }}
                    >
                        Inicia sesión
                    </span>
                </p>
        </AuthLayout>
    );
}
