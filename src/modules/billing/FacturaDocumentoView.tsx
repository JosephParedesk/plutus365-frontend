import { Button } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import type { FacturaDetalle } from '../../shared/services/facturacionService'
import { numeroALetras } from '../../shared/utils/numeroALetras'
import { colors } from '../../shared/theme/colors'

const formatoCOP = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

const nombreCompleto = (tipoPersona?: string, razonSocial?: string, nombres?: string, apellidos?: string) =>
    tipoPersona === 'JURIDICA' ? (razonSocial || '-') : [nombres, apellidos].filter(Boolean).join(' ') || '-'

const celdaLabel: React.CSSProperties = {
    padding: '6px 8px', fontWeight: 600, border: `1px solid ${colors.border}`, fontSize: 11.5,
}
const celdaValor: React.CSSProperties = {
    padding: '6px 8px', border: `1px solid ${colors.border}`, fontSize: 11.5,
}

interface Props {
    detalle: FacturaDetalle
}

export default function FacturaDocumentoView({ detalle }: Props) {
    const { factura, venta, cliente, empresa, qrCodeBase64 } = detalle

    const nombreEmpresa = nombreCompleto(empresa.tipoPersona, empresa.razonSocial, empresa.nombres, empresa.apellidos)
    const nombreCliente = nombreCompleto(cliente.tipoPersona, cliente.razonSocial, cliente.nombres, cliente.apellidos)

    const fechaEmision = factura.fechaEmision ? new Date(factura.fechaEmision) : new Date()
    const fecha = fechaEmision.toLocaleDateString('es-CO')
    const hora = fechaEmision.toLocaleTimeString('es-CO')

    return (
        <div>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .factura-imprimible, .factura-imprimible * { visibility: visible; }
                    .factura-imprimible { position: absolute; left: 0; top: 0; width: 210mm; }
                    .no-imprimir { display: none !important; }
                }
            `}</style>

            <Button
                className="no-imprimir"
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
                style={{ marginBottom: 12, borderRadius: 14 }}
            >
                Imprimir / Guardar PDF
            </Button>

            <div className="factura-imprimible" style={{
                background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 16,
                padding: 24, fontSize: 12.5, color: '#333', maxWidth: 900, position: 'relative',
            }}>
                {/* Encabezado */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {empresa.logoUrl && (
                            <img src={empresa.logoUrl} alt="logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
                        )}
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: colors.heading }}>{nombreEmpresa}</div>
                            <div>NIT {empresa.numeroDocumento}{empresa.dv ? `-${empresa.dv}` : ''}</div>
                            {empresa.direccion && <div>{empresa.direccion}</div>}
                            {empresa.telefono && <div>Tel: {empresa.telefono}</div>}
                            {empresa.ciudad && <div>{empresa.ciudad} - {empresa.pais || 'Colombia'}</div>}
                            {empresa.correo && <div>{empresa.correo}</div>}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {qrCodeBase64 ? (
                            <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR" style={{ width: 110, height: 110 }} />
                        ) : (
                            <div style={{ width: 110, height: 110, border: `1px dashed ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>
                                QR no disponible
                            </div>
                        )}
                    </div>

                    <div style={{
                        border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12,
                        textAlign: 'center', background: colors.primaryLight,
                    }}>
                        <div style={{ fontWeight: 600 }}>Factura de venta</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: colors.primary }}>No. {factura.numeroFactura}</div>
                    </div>
                </div>

                {/* Cliente + Fecha */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${colors.border}` }}>
                        <tbody>
                            <tr>
                                <td style={celdaLabel}>Señores</td>
                                <td style={celdaValor}>{nombreCliente}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>NIT/Documento</td>
                                <td style={celdaValor}>{cliente.numeroDocumento}{cliente.dv ? `-${cliente.dv}` : ''}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Teléfono</td>
                                <td style={celdaValor}>{cliente.telefono || '-'}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Dirección</td>
                                <td style={celdaValor}>{cliente.direccion || '-'}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Ciudad</td>
                                <td style={celdaValor}>{cliente.ciudad || '-'} {cliente.departamento ? `- ${cliente.departamento}` : ''}</td>
                            </tr>
                        </tbody>
                    </table>

                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${colors.border}` }}>
                        <thead>
                            <tr>
                                <th colSpan={2} style={{ ...celdaLabel, textAlign: 'center', background: colors.primaryLight }}>
                                    Fecha y hora factura
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={celdaLabel}>Generación</td>
                                <td style={celdaValor}>{fecha}, {hora}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Ambiente</td>
                                <td style={celdaValor}>{factura.ambiente === 'PRODUCCION' ? 'Producción' : 'Habilitación (pruebas)'}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Estado DIAN</td>
                                <td style={{ ...celdaValor, fontWeight: 700, color: factura.estado === 'ACEPTADA' ? colors.primary : colors.red }}>
                                    {factura.estado}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Ítems */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${colors.border}`, marginBottom: 12 }}>
                    <thead>
                        <tr style={{ background: colors.primaryLight }}>
                            <th style={celdaLabel}>Ítem</th>
                            <th style={celdaLabel}>Descripción</th>
                            <th style={{ ...celdaLabel, textAlign: 'right' }}>Cantidad</th>
                            <th style={{ ...celdaLabel, textAlign: 'right' }}>Vr. Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {venta.items.map((item, i) => (
                            <tr key={i}>
                                <td style={celdaValor}>{i + 1}</td>
                                <td style={celdaValor}>{item.nombreProducto}</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{item.cantidad.toFixed(2)}</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{formatoCOP.format(item.valorTotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totales */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div>
                        <div>Total ítems: {venta.items.length}</div>
                        <div style={{ marginTop: 8 }}>
                            <b>Valor en letras:</b> {numeroALetras(venta.total)}
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${colors.border}` }}>
                        <tbody>
                            <tr>
                                <td style={celdaLabel}>Total bruto</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{formatoCOP.format(venta.subtotal)}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>IVA</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{formatoCOP.format(venta.totalIva || 0)}</td>
                            </tr>
                            <tr>
                                <td style={{ ...celdaLabel, fontWeight: 700 }}>Total a pagar</td>
                                <td style={{ ...celdaValor, textAlign: 'right', fontWeight: 700, color: colors.primary }}>
                                    {formatoCOP.format(venta.total)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Pie legal */}
                <div style={{
                    background: colors.pageBg, border: `1px solid ${colors.border}`,
                    borderRadius: 14, padding: 12, fontSize: 10.5, color: colors.textSecondary, textAlign: 'center',
                }}>
                    Factura electrónica de venta generada, firmada digitalmente (XAdES-EPES) y validada ante la DIAN.
                    <br />
                    <span style={{ wordBreak: 'break-all' }}><b>CUFE:</b> {factura.cufe}</span>
                </div>
            </div>
        </div>
    )
}
