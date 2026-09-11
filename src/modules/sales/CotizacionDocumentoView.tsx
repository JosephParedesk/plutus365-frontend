import { useState, useEffect } from 'react'
import { Modal, Button, Spin, Empty } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { empresaService, type Empresa } from '../../shared/services/empresaService'
import { clienteService, type Cliente } from '../../shared/services/clienteService'
import type { Cotizacion } from '../../shared/services/ventaService'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const VERDE = '#4E6F3A'
const OSCURO = '#2E3A2F'
const BORDE = '#ECEFEA'

interface Props {
    cotizacion: Cotizacion | null
    open: boolean
    onClose: () => void
}

const nombreDe = (e?: Empresa | Cliente | null) =>
    !e ? '' : (e.razonSocial || `${e.nombres || ''} ${e.apellidos || ''}`.trim())

/** Solo renderiza la fila si el dato existe: nada de campos vacíos en el documento. */
function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
    if (!valor) return null
    return (
        <div style={{ display: 'flex', gap: 6, marginBottom: 3, fontSize: 12 }}>
            <span style={{ color: '#888', minWidth: 92 }}>{etiqueta}:</span>
            <span style={{ color: '#333' }}>{valor}</span>
        </div>
    )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <div style={{ marginTop: 18 }}>
            <div style={{
                fontSize: 12.5, fontWeight: 700, color: VERDE, textTransform: 'uppercase',
                letterSpacing: 0.4, borderBottom: `2px solid ${VERDE}`, paddingBottom: 3, marginBottom: 8,
            }}>
                {titulo}
            </div>
            {children}
        </div>
    )
}

export default function CotizacionDocumentoView({ cotizacion, open, onClose }: Props) {
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    const [cliente, setCliente] = useState<Cliente | null>(null)
    const [cargando, setCargando] = useState(false)

    useEffect(() => {
        if (!open || !cotizacion) return
        setCargando(true)
        Promise.allSettled([
            empresaService.obtener(),
            cotizacion.clienteId ? clienteService.buscar(cotizacion.clienteId) : Promise.reject(),
        ]).then(([re, rc]) => {
            setEmpresa(re.status === 'fulfilled' ? re.value.data : null)
            setCliente(rc.status === 'fulfilled' ? (rc as any).value.data : null)
        }).finally(() => setCargando(false))
    }, [open, cotizacion])

    if (!cotizacion) return null

    const imprimir = () => window.print()

    const hayCondiciones = cotizacion.formaPago || cotizacion.tiempoEntrega || cotizacion.lugarEntrega
        || cotizacion.transporte || cotizacion.tiempoFabricacion || cotizacion.instalacion || cotizacion.capacitacion
    const hayGarantia = cotizacion.garantiaTiempo || cotizacion.garantiaCubre
        || cotizacion.garantiaNoCubre || cotizacion.garantiaComoHacerEfectiva
    const hayAsesor = cotizacion.asesorNombre || cotizacion.asesorCorreo || cotizacion.asesorTelefono

    const diasVigencia = cotizacion.fechaVencimiento && cotizacion.fecha
        ? dayjs(cotizacion.fechaVencimiento).diff(dayjs(cotizacion.fecha), 'day')
        : null

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={860}
            footer={[
                <Button key="cerrar" onClick={onClose}>Cerrar</Button>,
                <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={imprimir}
                    style={{ background: VERDE, borderColor: VERDE }}>
                    Imprimir / Guardar PDF
                </Button>,
            ]}
        >
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #cotizacion-doc, #cotizacion-doc * { visibility: visible; }
                    #cotizacion-doc { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                }
            `}</style>

            {cargando ? (
                <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
            ) : (
                <div id="cotizacion-doc" style={{ background: '#fff', color: '#333' }}>

                    {/* ── Encabezado: empresa + número ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, paddingBottom: 14, borderBottom: `2px solid ${VERDE}` }}>
                        <div style={{ flex: 1 }}>
                            {empresa?.logoUrl && (
                                <img src={empresa.logoUrl} alt="" style={{ height: 46, marginBottom: 8 }} />
                            )}
                            <div style={{ fontSize: 16, fontWeight: 700, color: OSCURO }}>
                                {nombreDe(empresa) || 'Tu empresa'}
                            </div>
                            {empresa?.nombreComercial && empresa.nombreComercial !== nombreDe(empresa) && (
                                <div style={{ fontSize: 12, color: '#777' }}>{empresa.nombreComercial}</div>
                            )}
                            <div style={{ fontSize: 11.5, color: '#666', marginTop: 4, lineHeight: 1.6 }}>
                                {empresa && <div>{empresa.tipoDocumento} {empresa.numeroDocumento}{empresa.dv ? `-${empresa.dv}` : ''}</div>}
                                {empresa?.regimenFiscal && <div>{empresa.regimenFiscal.replace(/_/g, ' ')}</div>}
                                {empresa?.direccion && <div>{empresa.direccion}</div>}
                                {(empresa?.ciudad || empresa?.departamento) && (
                                    <div>{[empresa.ciudad, empresa.departamento].filter(Boolean).join(', ')}</div>
                                )}
                                {empresa?.telefono && <div>Tel: {empresa.telefono}</div>}
                                {empresa?.correo && <div>{empresa.correo}</div>}
                            </div>
                        </div>

                        <div style={{ textAlign: 'right', minWidth: 210 }}>
                            <div style={{
                                background: VERDE, color: '#fff', padding: '8px 14px', borderRadius: 14,
                                fontWeight: 700, fontSize: 15, marginBottom: 10,
                            }}>
                                COTIZACIÓN<br />
                                <span style={{ fontSize: 17 }}>{cotizacion.numeroCotizacion}</span>
                            </div>
                            <div style={{ fontSize: 11.5, lineHeight: 1.7, color: '#555' }}>
                                <div><strong>Fecha:</strong> {cotizacion.fecha ? dayjs(cotizacion.fecha).format('DD/MM/YYYY') : ''}</div>
                                {cotizacion.fechaVencimiento && (
                                    <div><strong>Válida hasta:</strong> {dayjs(cotizacion.fechaVencimiento).format('DD/MM/YYYY')}</div>
                                )}
                                {(cotizacion.lugarEmision || empresa?.ciudad) && (
                                    <div><strong>Lugar:</strong> {cotizacion.lugarEmision || empresa?.ciudad}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Cliente ── */}
                    <Seccion titulo="Cliente">
                        <Dato etiqueta="Nombre" valor={nombreDe(cliente) || cotizacion.clienteNombre} />
                        {cliente && <Dato etiqueta="Documento" valor={`${cliente.tipoDocumento} ${cliente.numeroDocumento}${cliente.dv ? '-' + cliente.dv : ''}`} />}
                        <Dato etiqueta="Contacto" valor={cotizacion.contactoNombre} />
                        <Dato etiqueta="Cargo" valor={cotizacion.contactoCargo} />
                        <Dato etiqueta="Dirección" valor={cliente?.direccion} />
                        <Dato etiqueta="Ciudad" valor={[cliente?.ciudad, cliente?.departamento].filter(Boolean).join(', ')} />
                        <Dato etiqueta="Teléfono" valor={cliente?.telefono} />
                        <Dato etiqueta="Correo" valor={cliente?.correo || cotizacion.clienteCorreo} />
                    </Seccion>

                    {/* ── Detalle ── */}
                    <Seccion titulo="Detalle de la oferta">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: '#F6F8F5' }}>
                                    <th style={{ padding: 7, textAlign: 'left', borderBottom: `1px solid ${BORDE}` }}>Descripción</th>
                                    <th style={{ padding: 7, textAlign: 'right', borderBottom: `1px solid ${BORDE}`, width: 70 }}>Cant.</th>
                                    <th style={{ padding: 7, textAlign: 'right', borderBottom: `1px solid ${BORDE}`, width: 110 }}>Vr. unitario</th>
                                    <th style={{ padding: 7, textAlign: 'right', borderBottom: `1px solid ${BORDE}`, width: 110 }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cotizacion.items?.map((it, i) => (
                                    <tr key={i}>
                                        <td style={{ padding: 7, borderBottom: `1px solid ${BORDE}` }}>{it.nombreProducto}</td>
                                        <td style={{ padding: 7, textAlign: 'right', borderBottom: `1px solid ${BORDE}` }}>{it.cantidad}</td>
                                        <td style={{ padding: 7, textAlign: 'right', borderBottom: `1px solid ${BORDE}` }}>{cop.format(it.precioUnitario)}</td>
                                        <td style={{ padding: 7, textAlign: 'right', borderBottom: `1px solid ${BORDE}` }}>
                                            {cop.format(it.valorTotal || it.cantidad * it.precioUnitario)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            <div style={{ minWidth: 270, fontSize: 12.5 }}>
                                {[
                                    ['Subtotal', cotizacion.subtotal],
                                    ...(cotizacion.descuentoTotal ? [['Descuentos', -cotizacion.descuentoTotal]] : []),
                                    ...(cotizacion.totalIva ? [['IVA', cotizacion.totalIva]] : []),
                                ].map(([label, valor], i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                        <span style={{ color: '#777' }}>{label as string}</span>
                                        <span>{cop.format((valor as number) || 0)}</span>
                                    </div>
                                ))}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 8,
                                    borderTop: `2px solid ${OSCURO}`, fontWeight: 800, fontSize: 15,
                                }}>
                                    <span>Total a pagar</span>
                                    <span style={{ color: VERDE }}>{cop.format(cotizacion.total || 0)}</span>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 10.5, color: '#999', marginTop: 3 }}>
                                    Valores expresados en pesos colombianos (COP)
                                </div>
                            </div>
                        </div>
                    </Seccion>

                    {hayCondiciones && (
                        <Seccion titulo="Condiciones comerciales">
                            <Dato etiqueta="Forma de pago" valor={cotizacion.formaPago} />
                            <Dato etiqueta="Entrega" valor={cotizacion.tiempoEntrega} />
                            <Dato etiqueta="Lugar entrega" valor={cotizacion.lugarEntrega} />
                            <Dato etiqueta="Transporte" valor={cotizacion.transporte} />
                            <Dato etiqueta="Fabricación" valor={cotizacion.tiempoFabricacion} />
                            <Dato etiqueta="Instalación" valor={cotizacion.instalacion} />
                            <Dato etiqueta="Capacitación" valor={cotizacion.capacitacion} />
                        </Seccion>
                    )}

                    {hayGarantia && (
                        <Seccion titulo="Garantía">
                            <Dato etiqueta="Vigencia" valor={cotizacion.garantiaTiempo} />
                            <Dato etiqueta="Cubre" valor={cotizacion.garantiaCubre} />
                            <Dato etiqueta="No cubre" valor={cotizacion.garantiaNoCubre} />
                            <Dato etiqueta="Cómo aplicar" valor={cotizacion.garantiaComoHacerEfectiva} />
                        </Seccion>
                    )}

                    <Seccion titulo="Validez y observaciones">
                        <div style={{ fontSize: 12, lineHeight: 1.7, color: '#555' }}>
                            <div>
                                • Esta cotización tiene una vigencia de {diasVigencia ?? 15} días calendario
                                contados a partir de su fecha de emisión.
                            </div>
                            <div>• Los precios están sujetos a cambio después de la fecha de vencimiento.</div>
                            <div>• Productos sujetos a disponibilidad de inventario.</div>
                            <div>• Esta cotización no constituye factura de venta.</div>
                            {cotizacion.observaciones && (
                                <div style={{ marginTop: 6, whiteSpace: 'pre-line' }}>• {cotizacion.observaciones}</div>
                            )}
                        </div>
                    </Seccion>

                    {hayAsesor && (
                        <Seccion titulo="Asesor comercial">
                            <Dato etiqueta="Nombre" valor={cotizacion.asesorNombre} />
                            <Dato etiqueta="Cargo" valor={cotizacion.asesorCargo} />
                            <Dato etiqueta="Teléfono" valor={cotizacion.asesorTelefono} />
                            <Dato etiqueta="Correo" valor={cotizacion.asesorCorreo} />
                        </Seccion>
                    )}

                    {/* ── Aceptación ── */}
                    <div style={{ marginTop: 34, display: 'flex', gap: 40 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ borderTop: '1px solid #999', paddingTop: 5, fontSize: 11, color: '#777' }}>
                                Firma y sello de aceptación del cliente
                            </div>
                            <div style={{ fontSize: 10.5, color: '#999', marginTop: 16, lineHeight: 2 }}>
                                Nombre: ______________________________<br />
                                Cargo: _______________________________<br />
                                Fecha: _______________________________
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ borderTop: '1px solid #999', paddingTop: 5, fontSize: 11, color: '#777' }}>
                                {cotizacion.asesorNombre || nombreDe(empresa)}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#999', marginTop: 4 }}>
                                {cotizacion.asesorCargo || 'Asesor comercial'}
                            </div>
                        </div>
                    </div>

                    {!empresa && (
                        <div style={{ marginTop: 20, fontSize: 11, color: '#c00' }}>
                            Completa los datos de tu empresa en Configuración para que aparezcan en el documento.
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}
