import { useState, useEffect } from 'react'
import { Button, Spin } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Compra } from '../../shared/services/compraService'
import { METODO_PAGO_LABEL } from '../../shared/services/compraService'
import { proveedorService, type Proveedor } from '../../shared/services/proveedorService'
import { empresaService, type Empresa } from '../../shared/services/empresaService'
import { numeroALetras } from '../../shared/utils/numeroALetras'
import { colors } from '../../shared/theme/colors'

const formatoCOP = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

const nombreEmpresaCompleto = (e?: Empresa) =>
    !e ? '' : e.tipoPersona === 'JURIDICA' ? (e.razonSocial || '-') : [e.nombres, e.apellidos].filter(Boolean).join(' ')

const extraerPorcentaje = (texto?: string) => {
    if (!texto) return 0
    const match = texto.match(/([\d,.]+)\s*%/)
    return match ? parseFloat(match[1].replace(',', '.')) / 100 : 0
}

const celdaLabel: React.CSSProperties = {
    padding: '6px 8px', fontWeight: 600, border: `1px solid ${colors.border}`, fontSize: 11.5,
}
const celdaValor: React.CSSProperties = {
    padding: '6px 8px', border: `1px solid ${colors.border}`, fontSize: 11.5,
}

interface Props {
    compra: Compra
}

export default function CompraDocumentoView({ compra }: Props) {
    const [proveedor, setProveedor] = useState<Proveedor | null>(null)
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    const [cargando, setCargando] = useState(true)

    useEffect(() => {
        Promise.allSettled([
            proveedorService.buscar(compra.proveedorId),
            empresaService.obtener(),
        ]).then(([rProveedor, rEmpresa]) => {
            if (rProveedor.status === 'fulfilled') setProveedor(rProveedor.value.data)
            if (rEmpresa.status === 'fulfilled') setEmpresa(rEmpresa.value.data)
        }).finally(() => setCargando(false))
    }, [compra.proveedorId])

    if (cargando) return <div style={{ padding: 60, textAlign: 'center' }}><Spin /></div>

    // Agrupa impuestos (cargo y retención) por etiqueta, sumando el valor calculado de cada ítem.
    const impuestosCargo: Record<string, number> = {}
    const impuestosRetencion: Record<string, number> = {}
    for (const item of compra.items || []) {
        const base = (item.cantidad || 0) * (item.valorUnitario || 0) - (item.descuento || 0)
        if (item.impuestoCargo && item.impuestoCargo !== 'Sin impuesto') {
            impuestosCargo[item.impuestoCargo] = (impuestosCargo[item.impuestoCargo] || 0) + base * extraerPorcentaje(item.impuestoCargo)
        }
        if (item.impuestoRetencion && item.impuestoRetencion !== 'Sin retención') {
            impuestosRetencion[item.impuestoRetencion] = (impuestosRetencion[item.impuestoRetencion] || 0) + base * extraerPorcentaje(item.impuestoRetencion)
        }
    }

    const pagada = compra.tieneCreditoProveedor ? (compra.saldoPendiente ?? 0) <= 0 : true
    const vencida = !pagada && compra.fechaVencimientoCredito && dayjs(compra.fechaVencimientoCredito).isBefore(dayjs(), 'day')

    return (
        <div>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .compra-imprimible, .compra-imprimible * { visibility: visible; }
                    .compra-imprimible { position: absolute; left: 0; top: 0; width: 210mm; }
                    .no-imprimir { display: none !important; }
                }
            `}</style>

            <Button
                className="no-imprimir"
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
                style={{ marginBottom: 12, borderRadius: 14 }}
            >
                Descargar e imprimir
            </Button>

            <div className="compra-imprimible" style={{
                background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 16,
                padding: 24, fontSize: 12.5, color: '#333', maxWidth: 900, position: 'relative', overflow: 'hidden',
            }}>
                {/* Sello diagonal */}
                <div style={{
                    position: 'absolute', top: 18, left: -38, width: 150, transform: 'rotate(-45deg)',
                    background: pagada ? colors.primary : (vencida ? colors.red : colors.orange),
                    color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: 700,
                    padding: '3px 0', letterSpacing: 1, textTransform: 'uppercase',
                }}>
                    {pagada ? 'Pagada' : vencida ? 'Vencida' : 'Pendiente'}
                </div>

                {/* Encabezado */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 16, marginBottom: 16, marginLeft: 90 }}>
                    <div>
                        {empresa?.logoUrl ? (
                            <img src={empresa.logoUrl} alt="logo" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ color: colors.textMuted, fontSize: 11 }}>Espacio para<br />Logo Corporativo</div>
                        )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{nombreEmpresaCompleto(empresa || undefined)}</div>
                        <div>Nit {empresa?.numeroDocumento}{empresa?.dv ? `-${empresa.dv}` : ''}</div>
                        {empresa?.direccion && <div>{empresa.direccion}</div>}
                        {empresa?.telefono && <div>Tel: {empresa.telefono}</div>}
                        {empresa?.ciudad && <div>{empresa.ciudad} - {empresa.pais || 'Colombia'}</div>}
                    </div>
                    <div style={{
                        border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12,
                        textAlign: 'center', background: colors.primaryLight, alignSelf: 'start',
                    }}>
                        <div style={{ fontWeight: 600 }}>Compra</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: colors.primary }}>No. {compra.numeroComprobante}</div>
                    </div>
                </div>

                {/* Proveedor + fechas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${colors.border}` }}>
                        <tbody>
                            <tr>
                                <td style={celdaLabel}>Proveedor</td>
                                <td style={celdaValor}>{proveedor?.nombre || compra.proveedorNombre}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Nit</td>
                                <td style={celdaValor}>{proveedor?.nit || '-'}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Teléfono</td>
                                <td style={celdaValor}>{proveedor?.telefono || '-'}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Dirección</td>
                                <td style={celdaValor}>{proveedor?.direccion || '-'}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Ciudad</td>
                                <td style={celdaValor}>{proveedor?.ciudad || '-'}</td>
                            </tr>
                        </tbody>
                    </table>

                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${colors.border}` }}>
                        <tbody>
                            <tr>
                                <td style={celdaLabel}>Fecha de compra</td>
                                <td style={celdaValor}>{compra.fechaElaboracion ? dayjs(compra.fechaElaboracion).format('YYYY-MM-DD') : '-'}</td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Fecha de vencimiento</td>
                                <td style={celdaValor}>
                                    {compra.fechaVencimientoCredito ? dayjs(compra.fechaVencimientoCredito).format('YYYY-MM-DD') : '--'}
                                </td>
                            </tr>
                            <tr>
                                <td style={celdaLabel}>Factura del proveedor</td>
                                <td style={celdaValor}>{compra.facturaProveedor || '-'}</td>
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
                            <th style={{ ...celdaLabel, textAlign: 'right' }}>Vr. Unitario</th>
                            <th style={{ ...celdaLabel, textAlign: 'right' }}>Valor desc.</th>
                            <th style={{ ...celdaLabel, textAlign: 'right' }}>Impto. Cargo</th>
                            <th style={{ ...celdaLabel, textAlign: 'right' }}>Impto. Rete.</th>
                            <th style={{ ...celdaLabel, textAlign: 'right' }}>Vr. Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(compra.items || []).map((item, i) => (
                            <tr key={i}>
                                <td style={celdaValor}>{i + 1}</td>
                                <td style={celdaValor}>{item.descripcion}</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{item.cantidad.toFixed(2)}</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{formatoCOP.format(item.valorUnitario)}</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{formatoCOP.format(item.descuento || 0)}</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{(extraerPorcentaje(item.impuestoCargo) * 100).toFixed(0)}%</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{(extraerPorcentaje(item.impuestoRetencion) * 100).toFixed(0)}%</td>
                                <td style={{ ...celdaValor, textAlign: 'right', fontWeight: 600 }}>{formatoCOP.format(item.valorTotal || 0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Valor en letras + Condiciones de pago / Totales */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
                    <div>
                        <div style={{ marginBottom: 10 }}>
                            <b>Valor en Letras:</b> {numeroALetras(compra.totalPagar || 0)}
                        </div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Condiciones de Pago:</div>
                        {(compra.formasPago || []).length === 0 ? (
                            <div style={{ color: colors.textMuted }}>—</div>
                        ) : (
                            compra.formasPago.map((f, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12 }}>
                                    <span>{METODO_PAGO_LABEL[f.metodo]}</span>
                                    <span style={{ fontWeight: 600 }}>{formatoCOP.format(f.valor)}</span>
                                </div>
                            ))
                        )}
                        {compra.observaciones && (
                            <div style={{ marginTop: 14 }}>
                                <div style={{ fontWeight: 600, marginBottom: 2 }}>Observaciones:</div>
                                <div style={{ color: colors.textSecondary }}>{compra.observaciones}</div>
                            </div>
                        )}
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${colors.border}`, height: 'fit-content' }}>
                        <tbody>
                            <tr>
                                <td style={celdaLabel}>Total bruto</td>
                                <td style={{ ...celdaValor, textAlign: 'right' }}>{formatoCOP.format(compra.totalBruto || 0)}</td>
                            </tr>
                            {Object.entries(impuestosCargo).map(([label, valor]) => (
                                <tr key={label}>
                                    <td style={celdaLabel}>{label}</td>
                                    <td style={{ ...celdaValor, textAlign: 'right' }}>{formatoCOP.format(valor)}</td>
                                </tr>
                            ))}
                            {Object.entries(impuestosRetencion).map(([label, valor]) => (
                                <tr key={label}>
                                    <td style={celdaLabel}>{label}</td>
                                    <td style={{ ...celdaValor, textAlign: 'right' }}>-{formatoCOP.format(valor)}</td>
                                </tr>
                            ))}
                            <tr>
                                <td style={{ ...celdaLabel, fontWeight: 700 }}>Total a pagar</td>
                                <td style={{ ...celdaValor, textAlign: 'right', fontWeight: 700, color: colors.primary }}>
                                    {formatoCOP.format(compra.totalPagar || 0)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
