import { useState, useEffect } from 'react'
import { Tag, Button, Empty, message, Modal, Alert, Select, Input, Space, Tooltip } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { InboxOutlined, CloudUploadOutlined, ShoppingCartOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { compraService, type Compra } from '../../shared/services/compraService'
import {
    recepcionDocumentoService,
    type RecepcionDocumento, type EventoRadianCatalogo, type ConceptoReclamoRadian,
    type CodigoEventoRadian, type PersonaRadian
} from '../../shared/services/facturacionService'
import { colors } from '../../shared/theme/colors'

const COLOR_ESTADO: Record<string, string> = { CARGADO: 'blue', ERROR: 'red' }

const TIPOS_DOCUMENTO = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'NIT', label: 'NIT' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'TI', label: 'Tarjeta de identidad' },
    { value: 'PASAPORTE', label: 'Pasaporte' },
]

// Fila fusionada: la compra elegible (a crédito, con CUFE) + su estado de recepción, si ya existe.
interface Fila {
    compra: Compra
    recepcion: RecepcionDocumento | null
}

export default function RecepcionDocumentosPage() {
    const navigate = useNavigate()
    const [filas, setFilas] = useState<Fila[]>([])
    const [loading, setLoading] = useState(true)
    const [eventos, setEventos] = useState<EventoRadianCatalogo[]>([])
    const [conceptosReclamo, setConceptosReclamo] = useState<ConceptoReclamoRadian[]>([])
    const [cargando, setCargando] = useState<number | null>(null)

    const cargar = () => {
        setLoading(true)
        Promise.all([compraService.listar(), recepcionDocumentoService.listar()])
            .then(([rc, rr]) => {
                const elegibles = rc.data.filter(c => c.cufeProveedor && c.tieneCreditoProveedor)
                setFilas(elegibles.map(compra => ({
                    compra,
                    recepcion: rr.data.find(r => r.compraId === compra.compraId) || null,
                })))
            })
            .catch(() => message.error('Error al cargar las facturas recibidas'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        cargar()
        recepcionDocumentoService.eventos().then(({ data }) => setEventos(data)).catch(() => {})
        recepcionDocumentoService.conceptosReclamo().then(({ data }) => setConceptosReclamo(data)).catch(() => {})
    }, [])

    const cargarEnFactus = async (compraId: number) => {
        setCargando(compraId)
        try {
            await recepcionDocumentoService.cargar(compraId)
            message.success('Factura cargada en Factus — ya podés registrar los eventos')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo cargar la factura en Factus')
        } finally {
            setCargando(null)
        }
    }

    // Modal de emisión de evento
    const [filaEvento, setFilaEvento] = useState<Fila | null>(null)
    const [codigoEvento, setCodigoEvento] = useState<CodigoEventoRadian | undefined>()
    const [conceptoReclamo, setConceptoReclamo] = useState<string | undefined>()
    const [persona, setPersona] = useState<PersonaRadian>({
        tipoDocumento: 'CC', numeroDocumento: '', nombres: '', apellidos: '', cargo: '', area: '',
    })
    const [emitiendo, setEmitiendo] = useState(false)

    const cerrarEvento = () => {
        setFilaEvento(null); setCodigoEvento(undefined); setConceptoReclamo(undefined)
        setPersona({ tipoDocumento: 'CC', numeroDocumento: '', nombres: '', apellidos: '', cargo: '', area: '' })
    }

    const emitirEvento = async () => {
        if (!filaEvento?.compra.compraId || !codigoEvento) { message.warning('Selecciona el evento a emitir'); return }
        if (codigoEvento === '031' && !conceptoReclamo) { message.warning('El reclamo exige un motivo'); return }
        if (!persona.numeroDocumento || !persona.nombres || !persona.apellidos) {
            message.warning('Completa los datos de quien firma el evento'); return
        }
        setEmitiendo(true)
        try {
            await recepcionDocumentoService.emitirEvento(filaEvento.compra.compraId, codigoEvento, persona, conceptoReclamo)
            message.success('Evento emitido a la DIAN')
            cerrarEvento()
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo emitir el evento')
        } finally {
            setEmitiendo(false)
        }
    }

    const eventosDisponibles = (fila: Fila) => {
        const emitidos = new Set((fila.recepcion?.eventos || []).map(e => e.codigo))
        return eventos.filter(e => !emitidos.has(e.codigo))
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <InboxOutlined style={{ marginRight: 8 }} />
                        Recepción de facturas (RADIAN)
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Facturas electrónicas de proveedores a crédito — eventos ante la DIAN (Resolución 000085/2022)
                    </p>
                </div>
                <Button
                    icon={<ShoppingCartOutlined />}
                    onClick={() => navigate('/compras')}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                >
                    Ir a compras
                </Button>
            </div>

            <Alert
                type="info" showIcon style={{ marginBottom: 16, fontSize: 12.5 }}
                message="Solo aparecen acá las compras a crédito con CUFE del proveedor"
                description="Vienen de facturas de proveedor importadas por XML. Primero se carga la factura en Factus por su CUFE, y después se van registrando los eventos uno por uno: acuse de recibo, recibo del bien/servicio, y luego aceptación expresa o reclamo. La aceptación tácita no se emite manualmente — la genera la DIAN sola a los 3 días hábiles si no hay reclamo ni aceptación expresa."
            />

            <TablaOrdenable
                dataSource={filas}
                rowKey={r => r.compra.compraId!}
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1000 }}
                style={{ background: colors.cardBg, borderRadius: 12 }}
                locale={{ emptyText: <Empty description="No hay compras a crédito con CUFE de proveedor todavía" /> }}
                columns={[
                    { title: 'Comprobante', render: (_: any, r: Fila) => r.compra.numeroComprobante },
                    { title: 'Factura proveedor', render: (_: any, r: Fila) => r.compra.facturaProveedor },
                    { title: 'Proveedor', render: (_: any, r: Fila) => r.compra.proveedorNombre },
                    {
                        title: 'CUFE', render: (_: any, r: Fila) => (
                            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                {r.compra.cufeProveedor?.slice(0, 16)}…
                            </span>
                        )
                    },
                    {
                        title: 'Estado', render: (_: any, r: Fila) => (
                            <Tag color={COLOR_ESTADO[r.recepcion?.estado || ''] || 'default'}>
                                {r.recepcion?.estado || 'SIN CARGAR'}
                            </Tag>
                        )
                    },
                    {
                        title: 'Eventos emitidos', render: (_: any, r: Fila) => (
                            <Space size={4} wrap>
                                {(r.recepcion?.eventos || []).map(e => (
                                    <Tag key={e.codigo} color="green">{e.nombre}</Tag>
                                ))}
                                {!r.recepcion?.eventos?.length && <span style={{ color: colors.textMuted, fontSize: 12 }}>—</span>}
                            </Space>
                        )
                    },
                    {
                        title: '', key: 'acciones', width: 140,
                        render: (_: any, r: Fila) => {
                            if (!r.recepcion || r.recepcion.estado === 'ERROR') return (
                                <Tooltip title={r.recepcion?.respuestaDian}>
                                    <Button
                                        size="small" icon={<CloudUploadOutlined />}
                                        loading={cargando === r.compra.compraId}
                                        onClick={() => cargarEnFactus(r.compra.compraId!)}
                                    >
                                        {r.recepcion?.estado === 'ERROR' ? 'Reintentar' : 'Cargar'}
                                    </Button>
                                </Tooltip>
                            )
                            if (eventosDisponibles(r).length === 0) return null
                            return (
                                <Button size="small" icon={<SendOutlined />} onClick={() => setFilaEvento(r)}>
                                    Evento
                                </Button>
                            )
                        }
                    },
                ]}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>
                    Emitir evento RADIAN {filaEvento ? `· ${filaEvento.compra.numeroComprobante}` : ''}
                </span>}
                open={!!filaEvento}
                onCancel={cerrarEvento}
                width={560}
                destroyOnHidden
                footer={[
                    <Button key="cancel" onClick={cerrarEvento}>Cancelar</Button>,
                    <Button
                        key="ok" type="primary" loading={emitiendo} onClick={emitirEvento}
                        style={{ background: colors.primary, borderColor: colors.primary }}
                    >
                        Emitir evento
                    </Button>,
                ]}
            >
                {filaEvento && (
                    <>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Evento *</div>
                            <Select
                                placeholder="Selecciona el evento"
                                value={codigoEvento}
                                onChange={v => setCodigoEvento(v as CodigoEventoRadian)}
                                style={{ width: '100%' }}
                                options={eventosDisponibles(filaEvento).map(e => ({ value: e.codigo, label: `${e.codigo} · ${e.nombre}` }))}
                            />
                        </div>

                        {codigoEvento === '031' && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Motivo del reclamo *</div>
                                <Select
                                    placeholder="Selecciona el motivo"
                                    value={conceptoReclamo}
                                    onChange={setConceptoReclamo}
                                    style={{ width: '100%' }}
                                    options={conceptosReclamo.map(c => ({ value: c.codigo, label: `${c.codigo} · ${c.descripcion}` }))}
                                />
                            </div>
                        )}

                        <Alert
                            type="info" showIcon style={{ marginBottom: 12, fontSize: 12 }}
                            message="Datos de quien firma el evento en tu empresa"
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <Select
                                value={persona.tipoDocumento}
                                onChange={v => setPersona(p => ({ ...p, tipoDocumento: v }))}
                                options={TIPOS_DOCUMENTO}
                            />
                            <Input
                                placeholder="Número de documento"
                                value={persona.numeroDocumento}
                                onChange={e => setPersona(p => ({ ...p, numeroDocumento: e.target.value }))}
                            />
                        </div>
                        {persona.tipoDocumento === 'NIT' && (
                            <Input
                                placeholder="DV"
                                style={{ width: 80, marginBottom: 10 }}
                                value={persona.dv}
                                onChange={e => setPersona(p => ({ ...p, dv: e.target.value }))}
                            />
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <Input
                                placeholder="Nombres"
                                value={persona.nombres}
                                onChange={e => setPersona(p => ({ ...p, nombres: e.target.value }))}
                            />
                            <Input
                                placeholder="Apellidos"
                                value={persona.apellidos}
                                onChange={e => setPersona(p => ({ ...p, apellidos: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <Input
                                placeholder="Cargo (opcional)"
                                value={persona.cargo}
                                onChange={e => setPersona(p => ({ ...p, cargo: e.target.value }))}
                            />
                            <Input
                                placeholder="Área (opcional)"
                                value={persona.area}
                                onChange={e => setPersona(p => ({ ...p, area: e.target.value }))}
                            />
                        </div>
                    </>
                )}
            </Modal>
        </div>
    )
}
