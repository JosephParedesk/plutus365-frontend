import { useState, useEffect } from 'react'
import { Table, Tag, Button, Empty, message, Tooltip, Modal, Alert, Popconfirm } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { RollbackOutlined, EyeOutlined, FileProtectOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { notaCreditoService, type NotaCredito } from '../../shared/services/facturacionService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const COLOR_ESTADO: Record<string, string> = {
    GENERADA: 'blue', ENVIADA: 'orange', ACEPTADA: 'green', RECHAZADA: 'red', ERROR: 'red',
}

export default function NotasCreditoPage() {
    const navigate = useNavigate()
    const [notas, setNotas] = useState<NotaCredito[]>([])
    const [loading, setLoading] = useState(true)
    const [detalle, setDetalle] = useState<NotaCredito | null>(null)

    const cargar = () => {
        setLoading(true)
        notaCreditoService.listar()
            .then(({ data }) => setNotas(data))
            .catch(() => message.error('Error al cargar las notas crédito'))
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    const eliminarNoValidada = async (id: number) => {
        try {
            await notaCreditoService.eliminarNoValidada(id)
            message.success('Nota crédito eliminada de Factus — ya podés reintentar')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo eliminar la nota')
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <RollbackOutlined style={{ marginRight: 8 }} />
                        Notas crédito
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Correcciones y anulaciones de facturas ya validadas
                    </p>
                </div>
                <Button
                    icon={<FileProtectOutlined />}
                    onClick={() => navigate('/facturacion')}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                >
                    Ir a facturas
                </Button>
            </div>

            <Alert
                type="info" showIcon style={{ marginBottom: 16, fontSize: 12.5 }}
                message="Las notas crédito se emiten desde la factura que corrigen"
                description="Ve al menú Facturación, busca la factura ACEPTADA por la DIAN y usa el botón 'Nota crédito' en esa fila. Aquí solo se consultan las ya emitidas."
            />

            <TablaOrdenable
                dataSource={notas}
                rowKey="notaCreditoId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 900 }}
                style={{ background: colors.cardBg, borderRadius: 12 }}
                locale={{ emptyText: <Empty description="Todavía no has emitido notas crédito" /> }}
                columns={[
                    {
                        title: 'Número', dataIndex: 'numeroNota',
                        render: (v: string) => <strong style={{ color: colors.primary }}>{v}</strong>
                    },
                    { title: 'Corrige factura', dataIndex: 'numeroFactura' },
                    {
                        title: 'Fecha', dataIndex: 'fechaEmision',
                        render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : ''
                    },
                    {
                        title: 'Concepto', dataIndex: 'conceptoDescripcion',
                        render: (v: string, r: NotaCredito) => (
                            <Tooltip title={v}>
                                <Tag color={r.anulaTotal ? 'red' : 'default'}>
                                    {r.anulaTotal ? 'Anulación' : `Cód. ${r.conceptoCodigo}`}
                                </Tag>
                            </Tooltip>
                        )
                    },
                    {
                        title: 'Total acreditado', dataIndex: 'total', align: 'right' as const,
                        render: (v: number) => <strong style={{ color: colors.red }}>{cop.format(v || 0)}</strong>
                    },
                    {
                        title: 'Estado', dataIndex: 'estado',
                        render: (v: string) => <Tag color={COLOR_ESTADO[v] || 'default'}>{v}</Tag>
                    },
                    {
                        title: '', key: 'acciones', width: 90,
                        render: (_: any, r: NotaCredito) => (
                            <>
                                <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetalle(r)} />
                                {r.estado !== 'ACEPTADA' && (
                                    <Popconfirm
                                        title="¿Eliminar esta nota crédito de Factus?"
                                        description="Se borra el intento pendiente/rechazado para poder generarla de nuevo."
                                        onConfirm={() => eliminarNoValidada(r.notaCreditoId!)}
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
                    {detalle.numeroNota} · corrige {detalle.numeroFactura}
                </span>}
                open={!!detalle}
                onCancel={() => setDetalle(null)}
                footer={null}
                width={720}
            >
                {detalle && (
                    <>
                        <div style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.8 }}>
                            <div><strong>Concepto:</strong> {detalle.conceptoDescripcion}</div>
                            {detalle.motivo && <div><strong>Observación:</strong> {detalle.motivo}</div>}
                            <div style={{ wordBreak: 'break-all', color: colors.textMuted, marginTop: 6 }}>
                                <strong>CUFE factura original:</strong> {detalle.cufeFactura}
                            </div>
                            <div style={{ wordBreak: 'break-all', color: colors.textMuted }}>
                                <strong>CUDE nota:</strong> {detalle.cude}
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
                                { title: 'Total', dataIndex: 'valorTotal', align: 'right' as const, render: (v: number) => cop.format(v || 0) },
                            ]}
                        />

                        <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: 15 }}>
                            Total acreditado: <span style={{ color: colors.red }}>{cop.format(detalle.total || 0)}</span>
                        </div>
                    </>
                )}
            </Modal>
        </div>
    )
}
