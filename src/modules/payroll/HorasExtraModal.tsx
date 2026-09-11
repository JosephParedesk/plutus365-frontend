import { useState, useEffect } from 'react'
import { Modal, Select, InputNumber, Button, Alert } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { CONCEPTOS_HORA_EXTRA, type HoraExtraItem, type Empleado } from '../../shared/services/nominaService'
import { colors } from '../../shared/theme/colors'

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

interface Props {
    empleado: Empleado | null
    items: HoraExtraItem[]
    onClose: () => void
    onGuardar: (items: HoraExtraItem[]) => void
}

let seq = 0

export default function HorasExtraModal({ empleado, items, onClose, onGuardar }: Props) {
    const [filas, setFilas] = useState<(HoraExtraItem & { _key: number })[]>([])

    useEffect(() => {
        setFilas(items.map(i => ({ ...i, _key: ++seq })))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empleado])

    const agregar = () => setFilas(prev => [...prev, {
        _key: ++seq, tipoCode: 1, cantidadHoras: 0, porcentaje: 25, valor: 0,
    }])

    const actualizar = (key: number, cambios: Partial<HoraExtraItem>) =>
        setFilas(prev => prev.map(f => f._key === key ? { ...f, ...cambios } : f))

    const eliminar = (key: number) => setFilas(prev => prev.filter(f => f._key !== key))

    const guardar = () => onGuardar(filas.map(({ _key, ...resto }) => resto))

    const total = filas.reduce((s, f) => s + (f.valor || 0), 0)

    return (
        <Modal
            title={<span style={{ color: colors.heading, fontWeight: 700 }}>
                Horas extra / recargos {empleado ? `· ${empleado.nombres} ${empleado.apellidos}` : ''}
            </span>}
            open={!!empleado}
            onCancel={onClose}
            width={780}
            destroyOnHidden
            footer={[
                <Button key="cancel" onClick={onClose}>Cancelar</Button>,
                <Button key="ok" type="primary" onClick={guardar}
                    style={{ background: colors.primary, borderColor: colors.primary }}>
                    Guardar
                </Button>,
            ]}
        >
            <Alert
                type="info" showIcon style={{ marginBottom: 14, fontSize: 12.5 }}
                message="Cantidad, porcentaje y valor van por separado a propósito"
                description="Los 3 son obligatorios para transmitir la nómina electrónica a la DIAN. El porcentaje se sugiere para los tipos con tarifa fija en la ley (25%/35%/75%); para los que combinan con el recargo dominical/festivo, confírmalo con tu contador — sigue en implementación gradual (Ley 2466/2025)."
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Conceptos</span>
                <Button size="small" icon={<PlusOutlined />} onClick={agregar}>Agregar</Button>
            </div>

            <TablaOrdenable
                dataSource={filas}
                rowKey="_key"
                size="small"
                pagination={false}
                locale={{ emptyText: 'Sin horas extra ni recargos este período' }}
                columns={[
                    {
                        title: 'Tipo', width: 220,
                        render: (_: any, r: any) => (
                            <Select
                                size="small" style={{ width: '100%' }} value={r.tipoCode}
                                onChange={(v) => {
                                    const sugerido = CONCEPTOS_HORA_EXTRA.find(c => c.codigo === v)?.porcentajeSugerido
                                    actualizar(r._key, { tipoCode: v, porcentaje: sugerido ?? r.porcentaje })
                                }}
                                options={CONCEPTOS_HORA_EXTRA.map(c => ({ value: c.codigo, label: c.label }))}
                            />
                        )
                    },
                    {
                        title: 'Horas', width: 90,
                        render: (_: any, r: any) => (
                            <InputNumber size="small" min={0} style={{ width: '100%' }} value={r.cantidadHoras}
                                onChange={v => actualizar(r._key, { cantidadHoras: Number(v) || 0 })} />
                        )
                    },
                    {
                        title: '%', width: 90,
                        render: (_: any, r: any) => (
                            <InputNumber size="small" min={0} max={200} style={{ width: '100%' }} value={r.porcentaje}
                                onChange={v => actualizar(r._key, { porcentaje: Number(v) || 0 })} />
                        )
                    },
                    {
                        title: 'Valor', width: 130,
                        render: (_: any, r: any) => (
                            <InputNumber size="small" min={0} style={{ width: '100%' }} value={r.valor}
                                formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                onChange={v => actualizar(r._key, { valor: Number(v) || 0 })} />
                        )
                    },
                    {
                        title: '', width: 40,
                        render: (_: any, r: any) => (
                            <Button type="text" size="small" danger icon={<DeleteOutlined />}
                                onClick={() => eliminar(r._key)} />
                        )
                    },
                ]}
            />

            {filas.length > 0 && (
                <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700 }}>
                    Total: {cop.format(total)}
                </div>
            )}
        </Modal>
    )
}
