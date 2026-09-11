import { useState, useEffect, useMemo } from 'react'
import { Table, Button, Modal, Select, Input, InputNumber, DatePicker, Tag, message, Empty, Popconfirm, Alert } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { FileAddOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { notaDebitoVentaService, ventaService, type NotaDebitoVenta, type Venta } from '../../shared/services/ventaService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export default function NotasDebitoPage() {
    const [notas, setNotas] = useState<NotaDebitoVenta[]>([])
    const [ventas, setVentas] = useState<Venta[]>([])
    const [loading, setLoading] = useState(true)

    const [modalNueva, setModalNueva] = useState(false)
    const [ventaId, setVentaId] = useState<number | undefined>()
    const [concepto, setConcepto] = useState('')
    const [valor, setValor] = useState<number>(0)
    const [observaciones, setObservaciones] = useState('')
    const [guardando, setGuardando] = useState(false)

    const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs().subtract(90, 'day'), dayjs()])

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([
            notaDebitoVentaService.filtrar(rango[0].format('YYYY-MM-DD'), rango[1].format('YYYY-MM-DD')),
            ventaService.listar(),
        ])
            .then(([rn, rv]) => {
                if (rn.status === 'fulfilled') setNotas(rn.value.data)
                if (rv.status === 'fulfilled') setVentas(rv.value.data.filter(v => v.estado === 'REGISTRADA'))
            })
            .finally(() => setLoading(false))
    }

    useEffect(cargar, [rango])

    const ventaSeleccionada = useMemo(() => ventas.find(v => v.ventaId === ventaId), [ventas, ventaId])

    const limpiar = () => { setVentaId(undefined); setConcepto(''); setValor(0); setObservaciones('') }

    const registrar = async () => {
        if (!ventaId) { message.warning('Selecciona a qué venta aplica'); return }
        if (!concepto.trim()) { message.warning('Indica el motivo del cargo'); return }
        if (!valor || valor <= 0) { message.warning('El valor debe ser mayor a 0'); return }
        setGuardando(true)
        try {
            const { data } = await notaDebitoVentaService.registrar({ ventaReferenciaId: ventaId, concepto, valor, observaciones })
            message.success(`Nota débito ${data.numeroNotaDebito} registrada`)
            setModalNueva(false)
            limpiar()
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo registrar la nota débito')
        } finally {
            setGuardando(false)
        }
    }

    const anular = async (id: number) => {
        try {
            await notaDebitoVentaService.anular(id)
            message.success('Nota débito anulada, el cargo se revirtió sobre la venta')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo anular')
        }
    }

    const columnas = [
        { title: 'Número', dataIndex: 'numeroNotaDebito', render: (v: string) => <strong style={{ color: colors.primary }}>{v}</strong> },
        { title: 'Venta', dataIndex: 'numeroVentaReferencia' },
        { title: 'Cliente', dataIndex: 'clienteNombre', render: (v: string) => v || 'Sin cliente' },
        { title: 'Fecha', dataIndex: 'fecha', render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '' },
        { title: 'Concepto', dataIndex: 'concepto' },
        { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: (v: number) => <strong>{cop.format(v || 0)}</strong> },
        {
            title: 'Estado', dataIndex: 'estado',
            render: (v: string) => <Tag color={v === 'ANULADA' ? 'red' : 'green'}>{v}</Tag>
        },
        {
            title: '', key: 'acciones', width: 90,
            render: (_: any, r: NotaDebitoVenta) => r.estado === 'REGISTRADA' && (
                <Popconfirm title="¿Anular esta nota débito?" description="El cargo se revierte sobre la venta." onConfirm={() => anular(r.notaDebitoId!)} okText="Sí" cancelText="No">
                    <Button size="small" danger icon={<DeleteOutlined />}>Anular</Button>
                </Popconfirm>
            )
        },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <FileAddOutlined style={{ marginRight: 8 }} />
                        Notas débito
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Cargos adicionales sobre una venta ya registrada (interés, ajuste) — aumentan el saldo pendiente del cliente
                    </p>
                </div>
                <Button
                    type="primary" icon={<PlusOutlined />}
                    onClick={() => { limpiar(); setModalNueva(true) }}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Nueva nota débito
                </Button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <DatePicker.RangePicker
                    value={rango}
                    onChange={(v) => v && v[0] && v[1] && setRango([v[0], v[1]])}
                    format="DD/MM/YYYY"
                    allowClear={false}
                />
            </div>

            <TablaOrdenable
                dataSource={notas}
                columns={columnas}
                rowKey="notaDebitoId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 900 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Todavía no has registrado notas débito" /> }}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Nueva nota débito</span>}
                open={modalNueva}
                onCancel={() => setModalNueva(false)}
                onOk={registrar}
                confirmLoading={guardando}
                okText="Registrar"
                cancelText="Cancelar"
                okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary } }}
            >
                <Alert
                    type="info" showIcon style={{ marginBottom: 14, fontSize: 12.5 }}
                    message="Todavía no genera asiento contable"
                    description="Esta primera versión solo aumenta el saldo pendiente de la venta. El asiento automático (Debe Clientes / Haber Ingreso por ajustes) queda para una siguiente pasada."
                />
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Venta a la que aplica</div>
                    <Select
                        showSearch optionFilterProp="label" style={{ width: '100%' }}
                        placeholder="Selecciona la venta"
                        value={ventaId} onChange={setVentaId}
                        options={ventas.map(v => ({
                            value: v.ventaId,
                            label: `${v.numeroVenta} — ${v.clienteNombre || 'Sin cliente'} (${cop.format(v.total)})`,
                        }))}
                    />
                    {ventaSeleccionada && (
                        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                            Saldo pendiente actual: {cop.format(ventaSeleccionada.saldoPendiente || 0)}
                        </div>
                    )}
                </div>
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Motivo</div>
                    <Input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Interés de mora, ajuste de precio, flete adicional..." />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Valor a cargar</div>
                    <InputNumber min={0} style={{ width: '100%' }} value={valor} onChange={v => setValor(Number(v) || 0)}
                        formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                </div>
                <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Observaciones (opcional)</div>
                    <Input.TextArea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                </div>
            </Modal>
        </div>
    )
}
