import { useState, useEffect } from 'react'
import { colors } from '../../shared/theme/colors'
import { Form, Input, Select, Switch, Button, message, Divider } from 'antd'
import { PrinterOutlined, SaveOutlined } from '@ant-design/icons'
import {
    configuracionReciboService,
    type ConfiguracionRecibo,
} from '../../shared/services/ventaService'

const ANCHO_MM: Record<string, number> = { '58MM': 58, '80MM': 80 }
const FUENTE_PX: Record<string, number> = { PEQUENA: 11, NORMAL: 12.5, GRANDE: 14.5 }

export default function ReciboSection() {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    // Reactivo para la vista previa — se actualiza en cada cambio del formulario, no solo al guardar.
    const [preview, setPreview] = useState<ConfiguracionRecibo | null>(null)

    useEffect(() => {
        configuracionReciboService.obtener()
            .then(({ data }) => {
                form.setFieldsValue(data)
                setPreview(data)
            })
            .catch(() => message.error('Error al cargar la configuración del recibo'))
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const guardar = async (values: ConfiguracionRecibo) => {
        setGuardando(true)
        try {
            const { data } = await configuracionReciboService.guardar(values)
            form.setFieldsValue(data)
            setPreview(data)
            message.success('Configuración del recibo guardada')
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al guardar la configuración')
        } finally {
            setGuardando(false)
        }
    }

    if (loading) return null

    const anchoMm = ANCHO_MM[preview?.anchoPapel || '80MM']
    const fuentePx = FUENTE_PX[preview?.tamanioFuente || 'NORMAL']

    return (
        <div style={{ maxWidth: 720, marginTop: 40 }}>
            <Divider />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.heading, margin: 0 }}>
                <PrinterOutlined style={{ marginRight: 8 }} />
                Recibo de venta (POS)
            </h2>
            <p style={{ color: colors.textSecondary, margin: '4px 0 20px', fontSize: 13 }}>
                Cómo se ve el comprobante que se imprime al cobrar una venta. Viene con
                valores por defecto que ya funcionan — personalizalos si querés.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24 }}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={guardar}
                    onValuesChange={(_, todos) => setPreview((p) => ({ ...(p as ConfiguracionRecibo), ...todos }))}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="anchoPapel" label="Ancho del papel" rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { value: '58MM', label: '58mm (impresora angosta)' },
                                    { value: '80MM', label: '80mm (impresora estándar)' },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item name="tamanioFuente" label="Tamaño de letra" rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { value: 'PEQUENA', label: 'Pequeña' },
                                    { value: 'NORMAL', label: 'Normal' },
                                    { value: 'GRANDE', label: 'Grande' },
                                ]}
                            />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="mensajePie"
                        label="Mensaje del pie de página"
                        rules={[{ max: 200, message: 'Máximo 200 caracteres' }]}
                    >
                        <Input.TextArea rows={2} placeholder="¡Gracias por tu compra!" style={{ borderRadius: 14 }} />
                    </Form.Item>

                    <div style={{
                        background: colors.pageBg, border: `1px solid ${colors.border}`,
                        borderRadius: 16, padding: '12px 16px',
                    }}>
                        <Form.Item name="mostrarLogo" label="Mostrar logo de la empresa" valuePropName="checked" style={{ marginBottom: 12 }}>
                            <Switch />
                        </Form.Item>
                        <Form.Item name="mostrarDireccionEmpresa" label="Mostrar dirección y teléfono" valuePropName="checked" style={{ marginBottom: 12 }}>
                            <Switch />
                        </Form.Item>
                        <Form.Item name="mostrarAtendidoPor" label="Mostrar quién atendió la venta" valuePropName="checked" style={{ marginBottom: 0 }}>
                            <Switch />
                        </Form.Item>
                    </div>

                    <p style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 12 }}>
                        La leyenda "Este comprobante no constituye factura electrónica DIAN" siempre
                        se muestra — es la que te protege de que alguien lo confunda con una factura.
                    </p>

                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={guardando}
                        style={{ background: '#4E6F3A', borderColor: '#4E6F3A', borderRadius: 14, fontWeight: 600, marginTop: 8 }}
                    >
                        Guardar configuración del recibo
                    </Button>
                </Form>

                {/* Vista previa — se actualiza con cada cambio, sin necesidad de imprimir para ver el efecto */}
                <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8, fontWeight: 600 }}>Vista previa</div>
                    <div style={{
                        background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8,
                        padding: '14px 10px', width: Math.max(anchoMm * 3, 140),
                        fontFamily: "'Courier New', monospace", fontSize: fuentePx,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: 6 }}>
                            {preview?.mostrarLogo && (
                                <div style={{ fontSize: 9, color: '#bbb', marginBottom: 2 }}>[logo]</div>
                            )}
                            <div style={{ fontWeight: 700, fontSize: fuentePx + 2.5 }}>Tu Empresa S.A.S.</div>
                            {preview?.mostrarDireccionEmpresa && (
                                <div style={{ fontSize: fuentePx - 1.5, color: '#666' }}>Calle 10 # 20-30 · 3001234567</div>
                            )}
                            <div style={{ fontSize: fuentePx - 1.5, color: '#666' }}>Comprobante de venta</div>
                        </div>
                        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                        <div>Nº venta: <b>VT-00001</b></div>
                        {preview?.mostrarAtendidoPor && <div>Atendido por: Sistema</div>}
                        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Producto ejemplo</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#444' }}>
                            <span>1 x $10.000</span><span>$10.000</span>
                        </div>
                        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>TOTAL</span><span>$10.000</span>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 10, fontSize: fuentePx - 1.5, color: '#666' }}>
                            {preview?.mensajePie || '¡Gracias por tu compra!'}
                            <br />
                            Este comprobante no constituye factura electrónica DIAN.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
