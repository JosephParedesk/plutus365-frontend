import { useState, useEffect } from 'react'
import { colors } from '../../shared/theme/colors'
import { Form, Input, Select, Button, Upload, message, Avatar, Spin, Alert, ColorPicker, Switch } from 'antd'
import {
    SettingOutlined, ShopOutlined, UploadOutlined,
    SaveOutlined, PictureOutlined, ShoppingCartOutlined
} from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { empresaService, type Empresa, type TipoDocumentoEmpresa } from '../../shared/services/empresaService'
import FacturacionElectronicaSection from './FacturacionElectronicaSection'
import ReciboSection from './ReciboSection'
import PreviewCorreosSection from './PreviewCorreosSection'
import UsuariosSection from './UsuariosSection'
import { useAuthStore } from '../../shared/store/authStore'

const REGIMENES_FISCALES = [
    { value: 'RESPONSABLE_IVA', label: 'Responsable de IVA' },
    { value: 'NO_RESPONSABLE_IVA', label: 'No responsable de IVA' },
]

export default function ConfiguracionPage() {
    const { usuario } = useAuthStore()
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [subiendoLogo, setSubiendoLogo] = useState(false)
    const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined)
    const [existeConfiguracion, setExisteConfiguracion] = useState(false)

    const tipoPersona = Form.useWatch('tipoPersona', form)
    const tipoDocumento: TipoDocumentoEmpresa = Form.useWatch('tipoDocumento', form)
    const regimenFiscal = Form.useWatch('regimenFiscal', form)

    useEffect(() => {
        empresaService.obtener()
            .then(({ data }) => {
                form.setFieldsValue(data)
                setLogoUrl(data.logoUrl)
                setExisteConfiguracion(true)
            })
            .catch((error) => {
                if (error.response?.status === 404) {
                    // Aún no configurada: formulario vacío con valores por defecto
                    form.setFieldsValue({ tipoPersona: 'JURIDICA', tipoDocumento: 'NIT', pais: 'Colombia', moneda: 'COP' })
                } else {
                    message.error('Error al cargar la configuración de la empresa')
                }
            })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const guardar = async (values: any) => {
        setGuardando(true)
        try {
            // El ColorPicker de antd entrega un objeto Color, no un string — lo normalizamos acá.
            const colorPrincipal = typeof values.colorPrincipal === 'string'
                ? values.colorPrincipal
                : values.colorPrincipal?.toHexString?.() || colors.primary
            const { data } = await empresaService.guardar({ ...values, colorPrincipal })
            setLogoUrl(data.logoUrl)
            setExisteConfiguracion(true)
            message.success('Configuración guardada correctamente')
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar la configuración')
        } finally {
            setGuardando(false)
        }
    }

    const propsLogo: UploadProps = {
        showUploadList: false,
        accept: 'image/png,image/jpeg,image/webp',
        beforeUpload: (file) => {
            const tiposValidos = ['image/png', 'image/jpeg', 'image/webp']
            if (!tiposValidos.includes(file.type)) {
                message.error('El logo debe ser PNG, JPG o WEBP')
                return Upload.LIST_IGNORE
            }
            if (file.size / 1024 / 1024 > 5) {
                message.error('El logo no puede superar 5MB')
                return Upload.LIST_IGNORE
            }
            if (!existeConfiguracion) {
                message.warning('Guarda primero los datos de la empresa antes de subir el logo')
                return Upload.LIST_IGNORE
            }
            return true
        },
        customRequest: async (options) => {
            const { file, onSuccess, onError } = options
            setSubiendoLogo(true)
            try {
                const { data } = await empresaService.subirLogo(file as File)
                setLogoUrl(data.logoUrl)
                message.success('Logo actualizado')
                onSuccess?.(data)
            } catch (error: any) {
                message.error(error.response?.data?.message || 'Error al subir el logo')
                onError?.(error)
            } finally {
                setSubiendoLogo(false)
            }
        },
    }

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>
    }

    return (
        <div style={{ maxWidth: 720 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                <SettingOutlined style={{ marginRight: 8 }} />
                Configuración de la empresa
            </h2>
            <p style={{ color: colors.textSecondary, margin: '0 0 20px', fontSize: 13 }}>
                Estos datos identifican tu empresa como emisora en recibos y, más adelante, en la facturación electrónica.
            </p>

            {!existeConfiguracion && (
                <Alert
                    type="warning"
                    showIcon
                    message="Aún no has configurado los datos de tu empresa"
                    description="Complétalos y guarda para poder subir tu logo y personalizar tus comprobantes de venta."
                    style={{ marginBottom: 20, borderRadius: 16 }}
                />
            )}

            <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: colors.primaryLight, border: `1px solid ${colors.border}`,
                borderRadius: 18, padding: 16, marginBottom: 24,
            }}>
                <Avatar
                    shape="square"
                    size={72}
                    src={logoUrl}
                    icon={<PictureOutlined />}
                    style={{ background: colors.cardBg, border: '1px solid #ECEFEA' }}
                />
                <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Logo de la empresa</div>
                    <Upload {...propsLogo}>
                        <Button icon={<UploadOutlined />} loading={subiendoLogo} disabled={!existeConfiguracion}>
                            {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                        </Button>
                    </Upload>
                    {!existeConfiguracion && (
                        <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4 }}>
                            Disponible después de guardar los datos por primera vez.
                        </div>
                    )}
                </div>
            </div>

            <Form form={form} layout="vertical" onFinish={guardar}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="tipoPersona" label="Tipo de persona" rules={[{ required: true, message: 'Requerido' }]}>
                        <Select
                            options={[
                                { value: 'JURIDICA', label: 'Persona jurídica' },
                                { value: 'NATURAL', label: 'Persona natural' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="regimenFiscal" label="Régimen fiscal" rules={[{ required: true, message: 'Requerido' }]}>
                        <Select options={REGIMENES_FISCALES} />
                    </Form.Item>
                </div>

                {regimenFiscal === 'RESPONSABLE_IVA' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item
                            name="periodicidadIva"
                            label="Periodicidad de IVA"
                            tooltip="La asigna la DIAN según tus ingresos del año anterior — revísala en tu RUT. Se usa solo para calcular el widget de 'Impuestos próximos' del dashboard."
                        >
                            <Select
                                allowClear
                                placeholder="Sin configurar"
                                options={[
                                    { value: 'BIMESTRAL', label: 'Bimestral' },
                                    { value: 'CUATRIMESTRAL', label: 'Cuatrimestral' },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item
                            name="agenteRetenedor"
                            label="Agente retenedor"
                            tooltip="Si además de responsable de IVA eres agente retenedor de retención en la fuente"
                        >
                            <Select
                                options={[
                                    { value: true, label: 'Sí' },
                                    { value: false, label: 'No' },
                                ]}
                            />
                        </Form.Item>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: tipoDocumento === 'NIT' ? '1fr 1fr 0.6fr' : '1fr 1fr', gap: 16 }}>
                    <Form.Item name="tipoDocumento" label="Tipo de documento" rules={[{ required: true, message: 'Requerido' }]}>
                        <Select
                            options={[
                                { value: 'NIT', label: 'NIT' },
                                { value: 'CC', label: 'Cédula de ciudadanía' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="numeroDocumento" label="Número de documento" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="900123456" />
                    </Form.Item>
                    {tipoDocumento === 'NIT' && (
                        <Form.Item name="dv" label="DV" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="1" maxLength={1} />
                        </Form.Item>
                    )}
                </div>

                {tipoPersona === 'JURIDICA' ? (
                    <Form.Item name="razonSocial" label="Razón social" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Comercializadora XYZ S.A.S." />
                    </Form.Item>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="nombres" label="Nombres" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="Juan Carlos" />
                        </Form.Item>
                        <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true, message: 'Requerido' }]}>
                            <Input placeholder="Gómez Ruiz" />
                        </Form.Item>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
                    <Form.Item name="nombreComercial" label="Nombre comercial (opcional)">
                        <Input placeholder="Tienda XYZ" prefix={<ShopOutlined style={{ color: colors.textMuted }} />} />
                    </Form.Item>
                    <Form.Item
                        name="colorPrincipal"
                        label="Color de marca"
                        tooltip="Se usa en el encabezado de los correos que le llegan a tus clientes (comprobante de venta, factura electrónica)"
                        initialValue="#4E6F3A"
                    >
                        <ColorPicker format="hex" showText disabledAlpha />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="telefono" label="Teléfono" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="3001234567" />
                    </Form.Item>
                    <Form.Item name="correo" label="Correo" rules={[{ required: true, type: 'email', message: 'Email inválido' }]}>
                        <Input placeholder="contacto@empresa.com" />
                    </Form.Item>
                </div>

                <Form.Item name="direccion" label="Dirección">
                    <Input placeholder="Calle 123 # 45-67" />
                </Form.Item>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <Form.Item name="ciudad" label="Ciudad">
                        <Input placeholder="Bogotá" />
                    </Form.Item>
                    <Form.Item name="departamento" label="Departamento">
                        <Input placeholder="Cundinamarca" />
                    </Form.Item>
                    <Form.Item name="pais" label="País">
                        <Input placeholder="Colombia" />
                    </Form.Item>
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                    background: colors.pageBg, border: `1px solid ${colors.border}`,
                    borderRadius: 16, padding: '14px 18px', marginTop: 8, marginBottom: 20,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ShoppingCartOutlined style={{ fontSize: 20, color: colors.primary }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: colors.heading }}>
                                Punto de venta (POS)
                            </div>
                            <div style={{ fontSize: 12, color: colors.textSecondary, maxWidth: 480 }}>
                                Apagado por defecto. La facturación electrónica no depende de esto — funciona
                                igual con el POS apagado, usando "Nueva factura" en el menú de Facturación.
                                Prende esto solo si vas a usar el carrito y la caja de venta en mostrador.
                            </div>
                        </div>
                    </div>
                    <Form.Item name="posHabilitado" valuePropName="checked" noStyle>
                        <Switch />
                    </Form.Item>
                </div>

                <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={guardando}
                    size="large"
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600, marginTop: 8 }}
                >
                    Guardar configuración
                </Button>
            </Form>

            <ReciboSection />

            <PreviewCorreosSection />

            <FacturacionElectronicaSection />

            {(!usuario?.rol || usuario.rol.toUpperCase() === 'ADMIN') && <UsuariosSection />}
        </div>
    )
}
