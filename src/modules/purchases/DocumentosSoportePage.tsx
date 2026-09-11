import { useState, useEffect } from 'react'
import { Table, Tag, Button, Empty, message, Modal, Alert, Popconfirm, Select, Input } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { SendOutlined, EyeOutlined, ShoppingCartOutlined, DeleteOutlined, FileSyncOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
    documentoSoporteService, notaAjusteDocumentoSoporteService,
    type DocumentoSoporte, type ConceptoNotaAjuste
} from '../../shared/services/facturacionService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const COLOR_ESTADO: Record<string, string> = {
    ACEPTADA: 'green', RECHAZADA: 'red', ERROR: 'red',
}

export default function DocumentosSoportePage() {
    const navigate = useNavigate()
    const [documentos, setDocumentos] = useState<DocumentoSoporte[]>([])
    const [loading, setLoading] = useState(true)
    const [detalle, setDetalle] = useState<DocumentoSoporte | null>(null)

    const cargar = () => {
        setLoading(true)
        documentoSoporteService.listar()
            .then(({ data }) => setDocumentos(data))
            .catch(() => message.error('Error al cargar los documentos soporte'))
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    // Nota de ajuste — corrige o anula un documento soporte ya ACEPTADO.
    const [ajusteDoc, setAjusteDoc] = useState<DocumentoSoporte | null>(null)
    const [conceptosAjuste, setConceptosAjuste] = useState<ConceptoNotaAjuste[]>([])
    const [conceptoAjuste, setConceptoAjuste] = useState<string | undefined>()
    const [observacionAjuste, setObservacionAjuste] = useState('')
    const [emitiendoAjuste, setEmitiendoAjuste] = useState(false)

    useEffect(() => {
        notaAjusteDocumentoSoporteService.conceptos()
            .then(({ data }) => setConceptosAjuste(data))
            .catch(() => {})
    }, [])

    const cerrarAjuste = () => { setAjusteDoc(null); setConceptoAjuste(undefined); setObservacionAjuste('') }

    const emitirAjuste = async () => {
        if (!ajusteDoc?.documentoSoporteId) return
        if (!conceptoAjuste) { message.warning('Selecciona el motivo de la nota de ajuste'); return }
        setEmitiendoAjuste(true)
        try {
            const { data } = await notaAjusteDocumentoSoporteService.emitir(
                ajusteDoc.documentoSoporteId, conceptoAjuste, observacionAjuste || undefined)
            message.success(`Nota de ajuste ${data.numeroNota} emitida`)
            cerrarAjuste()
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo emitir la nota de ajuste')
        } finally {
            setEmitiendoAjuste(false)
        }
    }

    const eliminarNoValidada = async (id: number) => {
        try {
            await documentoSoporteService.eliminarNoValidada(id)
            message.success('Documento soporte eliminado de Factus — ya podés reintentar')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo eliminar el documento')
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <SendOutlined style={{ marginRight: 8 }} />
                        Documentos soporte (DIAN)
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Compras a proveedores no obligados a facturar electrónicamente — transmitidos a la DIAN vía Factus
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
                message="Los documentos soporte se generan desde la compra que respaldan"
                description="Ve al menú Compras, busca la compra tipo 'Documento soporte' en estado REGISTRADA y usa el botón de enviar en esa fila. Aquí solo se consultan los ya emitidos."
            />

            <TablaOrdenable
                dataSource={documentos}
                rowKey="documentoSoporteId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 900 }}
                style={{ background: colors.cardBg, borderRadius: 12 }}
                locale={{ emptyText: <Empty description="Todavía no has emitido documentos soporte" /> }}
                columns={[
                    {
                        title: 'Número', dataIndex: 'numeroDocumento',
                        render: (v: string) => <strong style={{ color: colors.primary }}>{v}</strong>
                    },
                    { title: 'Comprobante', dataIndex: 'numeroComprobante' },
                    { title: 'Proveedor', dataIndex: 'proveedorNombre' },
                    {
                        title: 'Fecha', dataIndex: 'fechaEmision',
                        render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : ''
                    },
                    {
                        title: 'Total', dataIndex: 'total', align: 'right' as const,
                        render: (v: number) => <strong>{cop.format(v || 0)}</strong>
                    },
                    {
                        title: 'Estado', dataIndex: 'estado',
                        render: (v: string) => <Tag color={COLOR_ESTADO[v] || 'default'}>{v}</Tag>
                    },
                    {
                        title: '', key: 'acciones', width: 120,
                        render: (_: any, r: DocumentoSoporte) => (
                            <>
                                <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetalle(r)} />
                                {r.estado === 'ACEPTADA' && (
                                    <Button
                                        type="text" size="small" icon={<FileSyncOutlined />}
                                        title="Emitir nota de ajuste (corregir o anular)"
                                        onClick={() => setAjusteDoc(r)}
                                    />
                                )}
                                {r.estado !== 'ACEPTADA' && (
                                    <Popconfirm
                                        title="¿Eliminar este documento soporte de Factus?"
                                        description="Se borra el intento pendiente/rechazado para poder generarlo de nuevo."
                                        onConfirm={() => eliminarNoValidada(r.documentoSoporteId!)}
                                        okText="Sí, eliminar" cancelText="Cancelar"
                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                )}
                            </>
                        )
                    },
                ]}
            />

            <Modal
                title={detalle && <span style={{ color: colors.heading, fontWeight: 700 }}>
                    {detalle.numeroDocumento} · respalda {detalle.numeroComprobante}
                </span>}
                open={!!detalle}
                onCancel={() => setDetalle(null)}
                footer={null}
                width={720}
            >
                {detalle && (
                    <>
                        <div style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.8 }}>
                            <div><strong>Proveedor:</strong> {detalle.proveedorNombre}</div>
                            <div style={{ wordBreak: 'break-all', color: colors.textMuted, marginTop: 6 }}>
                                <strong>CUDE:</strong> {detalle.cude}
                            </div>
                            {detalle.respuestaDian && (
                                <div style={{ marginTop: 6 }}><strong>Respuesta DIAN:</strong> {detalle.respuestaDian}</div>
                            )}
                        </div>

                        <TablaOrdenable
                            dataSource={detalle.items}
                            rowKey={(_, i) => String(i)}
                            size="small"
                            pagination={false}
                            columns={[
                                { title: 'Descripción', dataIndex: 'descripcion' },
                                { title: 'Cant.', dataIndex: 'cantidad', width: 70 },
                                { title: 'Valor unit.', dataIndex: 'precioUnitario', align: 'right' as const, render: (v: number) => cop.format(v) },
                                { title: 'IVA', dataIndex: 'valorIva', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                                { title: 'Retención', dataIndex: 'valorRetencion', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                                { title: 'Total', dataIndex: 'valorTotal', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                            ]}
                        />

                        <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 15 }}>
                            Total: <span style={{ color: colors.heading }}>{cop.format(detalle.total || 0)}</span>
                        </div>
                    </>
                )}
            </Modal>

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>
                    Nota de ajuste {ajusteDoc ? `· sobre ${ajusteDoc.numeroDocumento}` : ''}
                </span>}
                open={!!ajusteDoc}
                onCancel={cerrarAjuste}
                width={520}
                destroyOnHidden
                footer={[
                    <Button key="cancel" onClick={cerrarAjuste}>Cancelar</Button>,
                    <Button
                        key="ok" type="primary" danger={conceptoAjuste === '2'} loading={emitiendoAjuste} onClick={emitirAjuste}
                        style={conceptoAjuste !== '2' ? { background: colors.primary, borderColor: colors.primary } : undefined}
                    >
                        Emitir nota de ajuste
                    </Button>,
                ]}
            >
                <Alert
                    type="info" showIcon style={{ marginBottom: 14, fontSize: 12.5 }}
                    message="Corrige o anula este documento soporte ante la DIAN"
                    description="Los ítems y el proveedor se copian tal cual del documento original — esta nota no permite cambiar cantidades, solo indicar el motivo."
                />
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Motivo *</div>
                    <Select
                        placeholder="Selecciona el motivo"
                        value={conceptoAjuste}
                        onChange={setConceptoAjuste}
                        style={{ width: '100%' }}
                        options={conceptosAjuste.map(c => ({ value: c.codigo, label: `${c.codigo} · ${c.descripcion}` }))}
                    />
                </div>
                <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Observación</div>
                    <Input.TextArea
                        placeholder="Opcional, máximo 250 caracteres"
                        maxLength={250} rows={3}
                        value={observacionAjuste}
                        onChange={e => setObservacionAjuste(e.target.value)}
                    />
                </div>
            </Modal>
        </div>
    )
}
