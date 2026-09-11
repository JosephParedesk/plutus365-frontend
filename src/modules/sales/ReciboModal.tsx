import { useState } from 'react'
import { colors } from '../../shared/theme/colors'
import { Modal, Button, Divider, message, Checkbox, Tooltip } from 'antd'
import { PrinterOutlined, MailOutlined, CheckCircleFilled } from '@ant-design/icons'
import type { Venta, ConfiguracionRecibo } from '../../shared/services/ventaService'
import { ventaService } from '../../shared/services/ventaService'

const formatoCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
})

const METODO_LABEL: Record<string, string> = {
    EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', MIXTO: 'Mixto',
}

// Valores por defecto si todavía no cargó la configuración (o la empresa nunca la tocó) —
// coinciden con los que entrega el backend, así el recibo se ve igual antes y después de cargar.
const CONFIG_DEFECTO: ConfiguracionRecibo = {
    anchoPapel: '80MM',
    tamanioFuente: 'NORMAL',
    mensajePie: '¡Gracias por tu compra!',
    mostrarLogo: true,
    mostrarDireccionEmpresa: true,
    mostrarAtendidoPor: true,
}

const ANCHO_MM: Record<string, number> = { '58MM': 58, '80MM': 80 }
const FUENTE_PX: Record<string, number> = { PEQUENA: 11, NORMAL: 12.5, GRANDE: 14.5 }

interface Props {
    venta: Venta | null
    empresaNombre: string
    empresaDireccion?: string
    empresaTelefono?: string
    empresaLogoUrl?: string
    config?: ConfiguracionRecibo
    clienteCorreo?: string
    open: boolean
    onClose: () => void
}

export default function ReciboModal({
    venta, empresaNombre, empresaDireccion, empresaTelefono, empresaLogoUrl,
    config, clienteCorreo, open, onClose,
}: Props) {
    const [enviarCorreo, setEnviarCorreo] = useState(!!clienteCorreo)
    const [enviando, setEnviando] = useState(false)
    const [enviado, setEnviado] = useState(false)

    if (!venta) return null

    const cfg = config || CONFIG_DEFECTO
    const anchoMm = ANCHO_MM[cfg.anchoPapel] || 80
    const fuentePx = FUENTE_PX[cfg.tamanioFuente] || 12.5

    const imprimir = () => window.print()

    const enviarComprobante = async () => {
        if (!clienteCorreo) return
        setEnviando(true)
        try {
            await ventaService.enviarComprobante(venta.ventaId, clienteCorreo)
            message.success(`Comprobante enviado a ${clienteCorreo}`)
            setEnviado(true)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo enviar el comprobante')
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={380}
            title={<span style={{ color: colors.heading, fontWeight: 700 }}>Venta {venta.numeroVenta} registrada</span>}
            destroyOnHidden
        >
            {/* CSS de impresión: aísla solo el recibo y lo ajusta al ancho configurado */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .recibo-imprimible, .recibo-imprimible * { visibility: visible; }
                    .recibo-imprimible {
                        position: absolute; left: 0; top: 0;
                        width: ${anchoMm}mm; padding: 4mm;
                        font-family: 'Courier New', monospace;
                    }
                    .no-imprimir { display: none !important; }
                }
            `}</style>

            <div className="recibo-imprimible" style={{ fontFamily: "'Courier New', monospace", fontSize: fuentePx }}>
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    {cfg.mostrarLogo && empresaLogoUrl && (
                        <img src={empresaLogoUrl} alt="" style={{ maxHeight: 40, maxWidth: '70%', marginBottom: 4 }} />
                    )}
                    <div style={{ fontWeight: 700, fontSize: fuentePx + 2.5 }}>{empresaNombre}</div>
                    {cfg.mostrarDireccionEmpresa && (empresaDireccion || empresaTelefono) && (
                        <div style={{ fontSize: fuentePx - 1.5, color: '#666' }}>
                            {[empresaDireccion, empresaTelefono].filter(Boolean).join(' · ')}
                        </div>
                    )}
                    <div style={{ fontSize: fuentePx - 1.5, color: '#666' }}>Comprobante de venta</div>
                </div>
                <Divider style={{ margin: '6px 0', borderColor: '#000' }} dashed />

                <div>Nº venta: <b>{venta.numeroVenta}</b></div>
                <div>Fecha: {new Date(venta.fecha).toLocaleString('es-CO')}</div>
                <div>Cliente: {venta.clienteNombre || 'Consumidor final'}</div>
                {cfg.mostrarAtendidoPor && <div>Atendido por: {venta.creadoPor || 'Sistema'}</div>}

                <Divider style={{ margin: '6px 0', borderColor: '#000' }} dashed />

                {venta.items.map((item, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                        <div>{item.nombreProducto}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#444' }}>
                            {/* precioUnitario es el precio al público con IVA incluido — el
                                total de la línea es cantidad x precioUnitario, no item.valorTotal
                                (que es la base sin IVA, usada solo para contabilidad/DIAN). */}
                            <span>{item.cantidad} x {formatoCOP.format(item.precioUnitario)}</span>
                            <span>{formatoCOP.format(item.cantidad * item.precioUnitario - (item.descuento || 0))}</span>
                        </div>
                    </div>
                ))}

                <Divider style={{ margin: '6px 0', borderColor: '#000' }} dashed />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span><span>{formatoCOP.format(venta.subtotal)}</span>
                </div>
                {!!venta.descuentoTotal && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Descuento</span><span>-{formatoCOP.format(venta.descuentoTotal)}</span>
                    </div>
                )}
                {!!venta.totalIva && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>IVA incluido</span><span>{formatoCOP.format(venta.totalIva)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: fuentePx + 1.5, marginTop: 4 }}>
                    <span>TOTAL</span><span>{formatoCOP.format(venta.total)}</span>
                </div>

                <Divider style={{ margin: '6px 0', borderColor: '#000' }} dashed />

                {venta.formasPago.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{METODO_LABEL[f.metodo] || f.metodo}</span>
                        <span>{formatoCOP.format(f.valor)}</span>
                    </div>
                ))}

                <div style={{ textAlign: 'center', marginTop: 14, fontSize: fuentePx - 1.5, color: '#666' }}>
                    {cfg.mensajePie}
                    <br />
                    Este comprobante no constituye factura electrónica DIAN.
                </div>
            </div>

            {/* Controles — ocultos al imprimir */}
            <div className="no-imprimir">
                <Divider style={{ margin: '14px 0 10px' }} />

                <Button
                    icon={<PrinterOutlined />}
                    block
                    onClick={imprimir}
                    style={{ marginBottom: 10, borderRadius: 14 }}
                >
                    Imprimir recibo
                </Button>

                <div style={{
                    background: colors.primaryLight, border: `1px solid ${colors.border}`,
                    borderRadius: 16, padding: 12,
                }}>
                    <Checkbox
                        checked={enviarCorreo}
                        onChange={(e) => setEnviarCorreo(e.target.checked)}
                        disabled={!clienteCorreo}
                    >
                        Enviar comprobante al correo del cliente
                    </Checkbox>
                    {!clienteCorreo && (
                        <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4 }}>
                            Selecciona un cliente con correo registrado para poder enviarlo.
                        </div>
                    )}
                    {clienteCorreo && (
                        <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4 }}>
                            Se enviará a <b>{clienteCorreo}</b>. No es una factura electrónica DIAN.
                        </div>
                    )}

                    {enviarCorreo && clienteCorreo && (
                        <Tooltip title={enviado ? 'Ya enviado' : ''}>
                            <Button
                                type="primary"
                                icon={enviado ? <CheckCircleFilled /> : <MailOutlined />}
                                block
                                loading={enviando}
                                disabled={enviado}
                                onClick={enviarComprobante}
                                style={{
                                    marginTop: 10, borderRadius: 14, fontWeight: 600,
                                    background: enviado ? '#27ae60' : colors.primary,
                                    borderColor: enviado ? '#27ae60' : colors.primary,
                                }}
                            >
                                {enviado ? 'Comprobante enviado' : 'Enviar comprobante'}
                            </Button>
                        </Tooltip>
                    )}
                </div>

                <Button block type="text" onClick={onClose} style={{ marginTop: 10 }}>
                    Cerrar y continuar vendiendo
                </Button>
            </div>
        </Modal>
    )
}
