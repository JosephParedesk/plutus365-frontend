import { Modal, Form, Input, Button, message } from 'antd'
import { proveedorService, type Proveedor } from '../services/proveedorService'
import { colors } from '../theme/colors'

interface Props {
    open: boolean
    onClose: () => void
    onCreado: (proveedor: Proveedor) => void
}

// Mismo formulario que ya usaba NuevaCompraPage internamente para su "crear
// proveedor rápido" — ahora reusable desde cualquier pantalla que necesite
// elegir un proveedor.
export default function CrearProveedorModal({ open, onClose, onCreado }: Props) {
    const [form] = Form.useForm()

    const guardar = async (values: any) => {
        try {
            const { data } = await proveedorService.guardar(values)
            message.success(`Proveedor "${data.nombre}" creado`)
            form.resetFields()
            onCreado(data)
            onClose()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al crear el proveedor')
        }
    }

    return (
        <Modal
            title={<span style={{ color: colors.heading, fontWeight: 700 }}>Nuevo proveedor</span>}
            open={open}
            onCancel={() => { onClose(); form.resetFields() }}
            footer={null}
            destroyOnHidden
        >
            <Form form={form} layout="vertical" onFinish={guardar}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Distribuidora XYZ S.A.S." />
                    </Form.Item>
                    <Form.Item name="nit" label="NIT" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="900123456-7" />
                    </Form.Item>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="telefono" label="Teléfono">
                        <Input placeholder="3001234567" />
                    </Form.Item>
                    <Form.Item name="correo" label="Correo">
                        <Input placeholder="contacto@proveedor.com" />
                    </Form.Item>
                </div>
                <Form.Item name="direccion" label="Dirección">
                    <Input placeholder="Calle 123 # 45-67" />
                </Form.Item>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="ciudad" label="Ciudad">
                        <Input placeholder="Bogotá" />
                    </Form.Item>
                    <Form.Item name="plazoCredito" label="Plazo de crédito">
                        <Input placeholder="30 días" />
                    </Form.Item>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Button onClick={() => { onClose(); form.resetFields() }}>Cancelar</Button>
                    <Button type="primary" htmlType="submit" style={{ background: colors.primary, borderColor: colors.primary, fontWeight: 600 }}>
                        Crear proveedor
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}
