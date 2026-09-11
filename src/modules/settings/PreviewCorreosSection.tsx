import { useState, useEffect, useCallback } from 'react'
import { colors } from '../../shared/theme/colors'
import { Button, Divider, Tabs, Spin, Alert } from 'antd'
import { MailOutlined, ReloadOutlined } from '@ant-design/icons'
import { ventaService } from '../../shared/services/ventaService'
import { facturaService } from '../../shared/services/facturacionService'

// Vista previa real: pide al backend el mismo HTML que arma para un correo de
// verdad (con datos de ejemplo), así nunca se desincroniza de lo que de verdad
// se manda. Se muestra en un <iframe srcDoc> para que los estilos del correo
// no se mezclen con los de esta página.
function VistaPreviaCorreo({ cargar }: { cargar: () => Promise<{ data: string }> }) {
    const [html, setHtml] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const recargar = useCallback(() => {
        setLoading(true)
        setError(null)
        cargar()
            .then(({ data }) => setHtml(data))
            .catch((err) => setError(err.response?.data?.message || 'No se pudo generar la vista previa'))
            .finally(() => setLoading(false))
    }, [cargar])

    useEffect(recargar, [recargar])

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Button size="small" icon={<ReloadOutlined />} onClick={recargar} loading={loading}>
                    Actualizar vista previa
                </Button>
            </div>
            {error ? (
                <Alert type="warning" showIcon message={error} style={{ borderRadius: 14 }} />
            ) : loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin /></div>
            ) : (
                <iframe
                    title="Vista previa del correo"
                    srcDoc={html}
                    style={{ width: '100%', height: 560, border: '1px solid #f0f0f0', borderRadius: 16, background: '#fff' }}
                />
            )}
        </div>
    )
}

export default function PreviewCorreosSection() {
    const cargarVenta = useCallback(() => ventaService.vistaPreviaCorreo(), [])
    const cargarFactura = useCallback(() => facturaService.vistaPreviaCorreo(), [])

    return (
        <div style={{ maxWidth: 720, marginTop: 40 }}>
            <Divider />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.heading, margin: 0 }}>
                <MailOutlined style={{ marginRight: 8 }} />
                Vista previa de correos
            </h2>
            <p style={{ color: colors.textSecondary, margin: '4px 0 20px', fontSize: 13 }}>
                Así se ven los correos que le llegan a tus clientes, con tu logo y color de
                marca reales. Si cambiaste algo arriba, guardá primero y después actualizá la vista previa.
            </p>

            <Tabs
                items={[
                    {
                        key: 'venta',
                        label: 'Comprobante de venta',
                        children: <VistaPreviaCorreo cargar={cargarVenta} />,
                    },
                    {
                        key: 'factura',
                        label: 'Factura electrónica',
                        children: <VistaPreviaCorreo cargar={cargarFactura} />,
                    },
                ]}
            />
        </div>
    )
}
