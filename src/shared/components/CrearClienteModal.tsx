import { useEffect } from 'react'
import { Modal, Form, Input, Select, Button, message } from 'antd'
import { clienteService, type Cliente } from '../services/clienteService'
import { colors } from '../theme/colors'

const TIPOS_DOCUMENTO = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'NIT', label: 'NIT' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'PASAPORTE', label: 'Pasaporte' },
    { value: 'TI', label: 'Tarjeta de identidad' },
    { value: 'RC', label: 'Registro civil' },
]

const REGIMENES_FISCALES = [
    { value: 'RESPONSABLE_IVA', label: 'Responsable de IVA' },
    { value: 'NO_RESPONSABLE_IVA', label: 'No responsable de IVA' },
]

interface Props {
    open: boolean
    onClose: () => void
    onCreado: (cliente: Cliente) => void
}

// Mismo formulario que ClientesPage, en un modal reusable — para crear un
// cliente sin salir de la pantalla donde lo estás pidiendo (venta, cotización,
// remisión, recibo de caja, etc.). No se acortan los campos fiscales
// (tipoDocumento/regimenFiscal/dv): la factura electrónica los necesita reales.
export default function CrearClienteModal({ open, onClose, onCreado }: Props) {
    const [form] = Form.useForm()
    const tipoPersona = Form.useWatch('tipoPersona', form)
    const tipoDocumento = Form.useWatch('tipoDocumento', form)

    useEffect(() => {
        if (open) form.setFieldsValue({ tipoPersona: 'NATURAL', tipoDocumento: 'CC', regimenFiscal: 'NO_RESPONSABLE_IVA', pais: 'Colombia' })
    }, [open, form])

    const guardar = async (values: any) => {
        try {
            const { data } = await clienteService.guardar({ ...values, activo: true })
            message.success(`Cliente "${data.razonSocial || [data.nombres, data.apellidos].filter(Boolean).join(' ')}" creado`)
            form.resetFields()
            onCreado(data)
            onClose()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al crear el cliente')
        }
    }

    return (
        <Modal
            title={<span style={{ color: colors.heading, fontWeight: 700 }}>Nuevo cliente</span>}
            open={open}
            onCancel={() => { onClose(); form.resetFields() }}
            footer={null}
            width={640}
            destroyOnHidden
        >
            <Form form={form} layout="vertical" onFinish={guardar} style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="tipoPersona" label="Tipo de persona" rules={[{ required: true, message: 'Requerido' }]}>
                        <Select options={[{ value: 'NATURAL', label: 'Persona natural' }, { value: 'JURIDICA', label: 'Persona jurídica' }]} />
                    </Form.Item>
                    <Form.Item name="regimenFiscal" label="Régimen fiscal" rules={[{ required: true, message: 'Requerido' }]}>
                        <Select options={REGIMENES_FISCALES} />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: tipoDocumento === 'NIT' ? '1fr 1fr 0.6fr' : '1fr 1fr', gap: 16 }}>
                    <Form.Item name="tipoDocumento" label="Tipo de documento" rules={[{ required: true, message: 'Requerido' }]}>
                        <Select options={TIPOS_DOCUMENTO} />
                    </Form.Item>
                    <Form.Item name="numeroDocumento" label="Número de documento" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="1234567890" />
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="telefono" label="Teléfono" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="3001234567" />
                    </Form.Item>
                    <Form.Item name="correo" label="Correo" rules={[{ required: true, type: 'email', message: 'Email inválido' }]}>
                        <Input placeholder="cliente@correo.com" />
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <Button onClick={() => { onClose(); form.resetFields() }}>Cancelar</Button>
                    <Button type="primary" htmlType="submit" style={{ background: colors.primary, borderColor: colors.primary, fontWeight: 600 }}>
                        Crear cliente
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}
