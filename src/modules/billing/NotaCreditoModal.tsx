import { useState, useEffect } from 'react'
import { Modal, Select, Input, InputNumber, Button, Table, Alert, message, Tag } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import {
    notaCreditoService, type Factura, type FacturaDetalle,
    type ConceptoNotaCredito, type ItemNotaCredito
} from '../../shared/services/facturacionService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

interface Props {
    factura: Factura | null
    detalle: FacturaDetalle | null
    open: boolean
    onClose: () => void
    onEmitida: () => void
}

let itemSeq = 0

export default function NotaCreditoModal({ factura, detalle, open, onClose, onEmitida }: Props) {
    const [conceptos, setConceptos] = useState<ConceptoNotaCredito[]>([])
    const [conceptoCodigo, setConceptoCodigo] = useState<string | undefined>()
    const [motivo, setMotivo] = useState('')
    const [items, setItems] = useState<(ItemNotaCredito & { _key: number })[]>([])
    const [emitiendo, setEmitiendo] = useState(false)

    useEffect(() => {
        notaCreditoService.conceptos()
            .then(({ data }) => setConceptos(data))
            .catch(() => message.error('No se pudieron cargar los conceptos de corrección'))
    }, [])

    // Al elegir "anulación", se precargan todos los ítems de la venta original:
    // anular es devolver la factura completa, no una parte.
    useEffect(() => {
        if (!open) return
        if (conceptoCodigo === '2' && detalle?.venta?.items) {
            setItems(detalle.venta.items.map((it: any) => ({
                _key: ++itemSeq,
                sku: it.sku,
                descripcion: it.nombreProducto,
                cantidad: it.cantidad,
                precioUnitario: it.precioUnitario,
                porcentajeIva: 19,
            })))
        }
    }, [conceptoCodigo, open, detalle])

    const agregarItem = () => setItems(prev => [...prev, {
        _key: ++itemSeq, descripcion: '', cantidad: 1, precioUnitario: 0, porcentajeIva: 19,
    }])

    const actualizarItem = (key: number, cambios: Partial<ItemNotaCredito>) =>
        setItems(prev => prev.map(i => i._key === key ? { ...i, ...cambios } : i))

    const eliminarItem = (key: number) => setItems(prev => prev.filter(i => i._key !== key))

    const subtotal = items.reduce((s, i) => s + (i.cantidad || 0) * (i.precioUnitario || 0), 0)
    const totalIva = items.reduce((s, i) => s + (i.cantidad || 0) * (i.precioUnitario || 0) * ((i.porcentajeIva || 0) / 100), 0)
    const total = subtotal + totalIva

    const limpiar = () => {
        setConceptoCodigo(undefined)
        setMotivo('')
        setItems([])
    }

    const emitir = async () => {
        if (!factura?.facturaId) return
        if (!conceptoCodigo) { message.warning('Selecciona el concepto de corrección'); return }
        if (items.length === 0) { message.warning('Agrega al menos un ítem'); return }
        if (items.some(i => !i.descripcion?.trim())) { message.warning('Todos los ítems necesitan descripción'); return }

        setEmitiendo(true)
        try {
            const { data } = await notaCreditoService.emitir({
                facturaId: factura.facturaId,
                conceptoCodigo,
                motivo: motivo || undefined,
                items: items.map(({ _key, ...resto }) => resto),
            })
            message.success(`Nota crédito ${data.numeroNota} emitida`)
            limpiar()
            onEmitida()
            onClose()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo emitir la nota crédito')
        } finally {
            setEmitiendo(false)
        }
    }

    const esAnulacion = conceptoCodigo === '2'

    return (
        <Modal
            title={<span style={{ color: colors.heading, fontWeight: 700 }}>
                Emitir nota crédito {factura?.numeroFactura ? `· sobre ${factura.numeroFactura}` : ''}
            </span>}
            open={open}
            onCancel={() => { limpiar(); onClose() }}
            width={860}
            destroyOnHidden
            footer={[
                <Button key="cancel" onClick={() => { limpiar(); onClose() }}>Cancelar</Button>,
                <Button
                    key="ok" type="primary" loading={emitiendo} onClick={emitir}
                    style={{ background: colors.primary, borderColor: colors.primary }}
                >
                    Emitir nota crédito
                </Button>,
            ]}
        >
            <Alert
                type="info" showIcon style={{ marginBottom: 14, fontSize: 12.5 }}
                message="La nota crédito es el mecanismo legal para corregir o anular una factura ya validada."
                description="La DIAN no permite anular y reexpedir la factura original; hay que emitir esta nota, que referencia el CUFE de la factura y recibe su propio identificador (CUDE). El número de la factura anulada no se puede reutilizar."
            />

            {factura?.cufe && (
                <div style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 12, wordBreak: 'break-all' }}>
                    CUFE de la factura original: <span style={{ fontFamily: 'monospace' }}>{factura.cufe}</span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Concepto de corrección *</div>
                    <Select
                        placeholder="Selecciona el motivo legal"
                        value={conceptoCodigo}
                        onChange={setConceptoCodigo}
                        style={{ width: '100%' }}
                        options={conceptos.map(c => ({ value: c.codigo, label: `${c.codigo} · ${c.descripcion}` }))}
                    />
                </div>
                <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Observación interna</div>
                    <Input placeholder="Opcional" value={motivo} onChange={e => setMotivo(e.target.value)} />
                </div>
            </div>

            {esAnulacion && (
                <Alert
                    type="warning" showIcon style={{ marginBottom: 12, fontSize: 12.5 }}
                    message="Anulación total"
                    description="Se precargaron todos los ítems de la venta original. Si la operación comercial sigue en pie, normalmente debes expedir después una factura nueva que la respalde."
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Ítems a acreditar</span>
                <Button size="small" icon={<PlusOutlined />} onClick={agregarItem}>Agregar ítem</Button>
            </div>

            <TablaOrdenable
                dataSource={items}
                rowKey="_key"
                size="small"
                pagination={false}
                locale={{ emptyText: 'Agrega los ítems que se devuelven o corrigen' }}
                columns={[
                    {
                        title: 'Descripción',
                        render: (_: any, r: any) => (
                            <Input size="small" value={r.descripcion}
                                onChange={e => actualizarItem(r._key, { descripcion: e.target.value })} />
                        )
                    },
                    {
                        title: 'Cantidad', width: 90,
                        render: (_: any, r: any) => (
                            <InputNumber size="small" min={0.01} style={{ width: '100%' }} value={r.cantidad}
                                onChange={v => actualizarItem(r._key, { cantidad: Number(v) || 0 })} />
                        )
                    },
                    {
                        title: 'Valor unitario', width: 130,
                        render: (_: any, r: any) => (
                            <InputNumber size="small" min={0} style={{ width: '100%' }} value={r.precioUnitario}
                                onChange={v => actualizarItem(r._key, { precioUnitario: Number(v) || 0 })} />
                        )
                    },
                    {
                        title: 'IVA %', width: 90,
                        render: (_: any, r: any) => (
                            <Select size="small" style={{ width: '100%' }} value={r.porcentajeIva}
                                onChange={v => actualizarItem(r._key, { porcentajeIva: v })}
                                options={[{ value: 0, label: '0%' }, { value: 5, label: '5%' }, { value: 19, label: '19%' }]} />
                        )
                    },
                    {
                        title: 'Total', width: 120, align: 'right' as const,
                        render: (_: any, r: any) => cop.format(
                            (r.cantidad || 0) * (r.precioUnitario || 0) * (1 + (r.porcentajeIva || 0) / 100)
                        )
                    },
                    {
                        title: '', width: 40,
                        render: (_: any, r: any) => (
                            <Button type="text" size="small" danger icon={<DeleteOutlined />}
                                onClick={() => eliminarItem(r._key)} />
                        )
                    },
                ]}
            />

            {items.length > 0 && (
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 12,
                    padding: 12, background: colors.pageBg, borderRadius: 14,
                }}>
                    <span style={{ fontSize: 12.5, color: colors.textSecondary }}>Subtotal: {cop.format(subtotal)}</span>
                    <span style={{ fontSize: 12.5, color: colors.textSecondary }}>IVA: {cop.format(totalIva)}</span>
                    <span style={{ fontWeight: 700, color: colors.red }}>Total a acreditar: {cop.format(total)}</span>
                </div>
            )}
        </Modal>
    )
}
