import { useState, useEffect, useMemo } from 'react'
import { Table, Tag, Button, Space, Modal, message, Tooltip, Empty, Select, DatePicker, Popconfirm } from 'antd'
import TablaOrdenable from '../../shared/components/TablaOrdenable'
import { FileProtectOutlined, EyeOutlined, MailOutlined, CheckCircleFilled, PlusOutlined, RollbackOutlined, FileAddOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { facturaService, type Factura, type FacturaDetalle } from '../../shared/services/facturacionService'
import { ventaService, type Venta } from '../../shared/services/ventaService'
import FacturaDocumentoView from './FacturaDocumentoView'
import NotaCreditoModal from './NotaCreditoModal'
import NotaDebitoModal from './NotaDebitoModal'
import { colors } from '../../shared/theme/colors'

export default function FacturacionPage() {
    const [facturas, setFacturas] = useState<Factura[]>([])
    const [loading, setLoading] = useState(true)

    const [detalle, setDetalle] = useState<FacturaDetalle | null>(null)
    const [modalVisible, setModalVisible] = useState(false)
    const [cargandoDetalle, setCargandoDetalle] = useState(false)
    const [enviandoCorreo, setEnviandoCorreo] = useState(false)
    const [correoEnviado, setCorreoEnviado] = useState(false)

    // ── Generar factura eligiendo la venta manualmente (independiente del POS) ──
    const [ventas, setVentas] = useState<Venta[]>([])
    const [modalGenerar, setModalGenerar] = useState(false)
    const [ventaSeleccionada, setVentaSeleccionada] = useState<number | undefined>()
    const [generando, setGenerando] = useState(false)

    // Nota crédito sobre una factura ya aceptada
    const [facturaNota, setFacturaNota] = useState<Factura | null>(null)
    const [detalleNota, setDetalleNota] = useState<FacturaDetalle | null>(null)
    const [modalNota, setModalNota] = useState(false)

    const abrirNotaCredito = async (f: Factura) => {
        setFacturaNota(f)
        setDetalleNota(null)
        setModalNota(true)
        try {
            const { data } = await facturaService.obtenerDetalle(f.facturaId)
            setDetalleNota(data)
        } catch {
            // sin el detalle igual se puede emitir la nota, solo no se precargan los ítems
        }
    }

    // Nota débito electrónica sobre una factura ya aceptada — no confundir con la
    // "Nota débito (Ventas)" de venta-service, que es un ajuste interno de cartera.
    const [facturaNotaDebito, setFacturaNotaDebito] = useState<Factura | null>(null)
    const [modalNotaDebito, setModalNotaDebito] = useState(false)

    // Solo se excluyen las que ya quedaron ACEPTADAS por la DIAN — es el mismo criterio
    // que usa el backend para bloquear un reintento (ver FacturaUseCase.generarFactura).
    // Si se excluyera cualquier factura sin importar el estado, una venta con un intento
    // fallido (ERROR/RECHAZADA) desaparecía del selector sin ninguna forma de reintentarla.
    const ventasSinFactura = useMemo(() => {
        const idsAceptados = new Set(facturas.filter(f => f.estado === 'ACEPTADA').map(f => f.ventaId))
        return ventas.filter(v => v.estado === 'REGISTRADA' && !idsAceptados.has(v.ventaId))
    }, [ventas, facturas])

    // El backend no tiene endpoint de filtrado para facturas — se filtra en
    // el cliente sobre lo ya cargado (mismo enfoque que Asientos contables).
    const [rango, setRango] = useState<[Dayjs, Dayjs] | null>(null)
    const [estadoFiltro, setEstadoFiltro] = useState<string | undefined>()

    const facturasFiltradas = useMemo(() => {
        return facturas.filter(f => {
            if (rango) {
                const fecha = f.fechaEmision?.slice(0, 10)
                if (fecha < rango[0].format('YYYY-MM-DD') || fecha > rango[1].format('YYYY-MM-DD')) return false
            }
            if (estadoFiltro && f.estado !== estadoFiltro) return false
            return true
        })
    }, [facturas, rango, estadoFiltro])

    const cargar = () => {
        setLoading(true)
        Promise.allSettled([facturaService.listar(), ventaService.listar()]).then(([rFacturas, rVentas]) => {
            if (rFacturas.status === 'fulfilled') setFacturas(rFacturas.value.data.slice().reverse())
            else message.error('Error al cargar las facturas')
            if (rVentas.status === 'fulfilled') setVentas(rVentas.value.data)
        }).finally(() => setLoading(false))
    }

    useEffect(cargar, [])

    const generarFactura = async () => {
        if (!ventaSeleccionada) return
        setGenerando(true)
        try {
            const { data } = await facturaService.generar(ventaSeleccionada)
            message.success(
                data.estado === 'ACEPTADA'
                    ? `Factura ${data.numeroFactura} aceptada por la DIAN`
                    : `Factura ${data.numeroFactura}: ${data.estado}`
            )
            setModalGenerar(false)
            setVentaSeleccionada(undefined)
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo generar la factura electrónica')
        } finally {
            setGenerando(false)
        }
    }

    const eliminarNoValidada = async (facturaId: number) => {
        try {
            await facturaService.eliminarNoValidada(facturaId)
            message.success('Factura eliminada de Factus — ya podés reintentar')
            cargar()
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo eliminar la factura')
        }
    }

    const verDocumento = async (facturaId: number) => {
        setCargandoDetalle(true)
        setModalVisible(true)
        setCorreoEnviado(false)
        try {
            const { data } = await facturaService.obtenerDetalle(facturaId)
            setDetalle(data)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo cargar el documento')
            setModalVisible(false)
        } finally {
            setCargandoDetalle(false)
        }
    }

    const enviarPorCorreo = async () => {
        if (!detalle) return
        if (!detalle.cliente.correo) {
            message.warning('Este cliente no tiene un correo registrado')
            return
        }
        setEnviandoCorreo(true)
        try {
            await facturaService.enviarCorreo(detalle.factura.facturaId, detalle.cliente.correo)
            message.success(`Factura enviada a ${detalle.cliente.correo}`)
            setCorreoEnviado(true)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo enviar el correo')
        } finally {
            setEnviandoCorreo(false)
        }
    }

    const colorEstado: Record<string, string> = {
        ACEPTADA: 'green', RECHAZADA: 'red', ERROR: 'red', GENERADA: 'orange', ENVIADA: 'blue',
    }

    const columnas = [
        {
            title: 'Número',
            dataIndex: 'numeroFactura',
            key: 'numeroFactura',
            render: (v: string) => <span style={{ fontWeight: 700, color: colors.primary }}>{v}</span>
        },
        {
            title: 'Fecha',
            dataIndex: 'fechaEmision',
            key: 'fechaEmision',
            render: (v: string) => v ? new Date(v).toLocaleString('es-CO') : '-'
        },
        {
            title: 'Ambiente',
            dataIndex: 'ambiente',
            key: 'ambiente',
            render: (v: string) => v === 'PRODUCCION' ? 'Producción' : 'Pruebas'
        },
        {
            title: 'Estado',
            dataIndex: 'estado',
            key: 'estado',
            render: (v: string) => <Tag color={colorEstado[v] || 'default'}>{v}</Tag>
        },
        {
            title: 'CUFE',
            dataIndex: 'cufe',
            key: 'cufe',
            render: (v: string) => v ? (
                <Tooltip title={v}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(0, 16)}…</span>
                </Tooltip>
            ) : '-'
        },
        {
            title: 'Acciones',
            key: 'acciones',
            render: (_: any, record: Factura) => (
                <div style={{ display: 'flex', gap: 6 }}>
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => verDocumento(record.facturaId)}
                        style={{ borderRadius: 10 }}
                    >
                        Ver documento
                    </Button>
                    {record.estado !== 'ACEPTADA' && (
                        <Popconfirm
                            title="¿Eliminar esta factura de Factus?"
                            description="Se borra el intento pendiente/rechazado para poder generarla de nuevo. No afecta facturas ya aceptadas."
                            onConfirm={() => eliminarNoValidada(record.facturaId)}
                            okText="Sí, eliminar" cancelText="Cancelar"
                            okButtonProps={{ danger: true }}
                        >
                            <Button size="small" icon={<DeleteOutlined />} danger style={{ borderRadius: 10 }} />
                        </Popconfirm>
                    )}
                    <Tooltip title={record.estado === 'ACEPTADA'
                        ? 'Corregir o anular esta factura con una nota crédito'
                        : 'Solo se puede emitir nota crédito sobre facturas ACEPTADAS por la DIAN'}>
                        <Button
                            size="small"
                            icon={<RollbackOutlined />}
                            disabled={record.estado !== 'ACEPTADA'}
                            onClick={() => abrirNotaCredito(record)}
                            style={{ borderRadius: 10 }}
                        >
                            Nota crédito
                        </Button>
                    </Tooltip>
                    <Tooltip title={record.estado === 'ACEPTADA'
                        ? 'Cargar valor adicional (interés, gasto) sobre esta factura con una nota débito'
                        : 'Solo se puede emitir nota débito sobre facturas ACEPTADAS por la DIAN'}>
                        <Button
                            size="small"
                            icon={<FileAddOutlined />}
                            disabled={record.estado !== 'ACEPTADA'}
                            onClick={() => { setFacturaNotaDebito(record); setModalNotaDebito(true) }}
                            style={{ borderRadius: 10 }}
                        >
                            Nota débito
                        </Button>
                    </Tooltip>
                </div>
            )
        },
    ]

    return (
        <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.heading, margin: 0 }}>
                        <FileProtectOutlined style={{ marginRight: 8 }} />
                        Facturación electrónica
                    </h2>
                    <p style={{ color: colors.textSecondary, margin: '4px 0 0', fontSize: 13 }}>
                        Todas las facturas electrónicas generadas, con acceso a su documento y CUFE.
                    </p>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setModalGenerar(true)}
                    style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 14, fontWeight: 600 }}
                >
                    Generar factura
                </Button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <DatePicker.RangePicker
                    value={rango}
                    onChange={(v) => setRango(v && v[0] && v[1] ? [v[0], v[1]] : null)}
                    format="DD/MM/YYYY"
                    placeholder={['Desde', 'Hasta']}
                />
                <Select
                    allowClear
                    placeholder="Todos los estados"
                    value={estadoFiltro}
                    onChange={setEstadoFiltro}
                    style={{ minWidth: 180 }}
                    options={['GENERADA', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'ERROR'].map(v => ({ value: v, label: v }))}
                />
            </div>

            <TablaOrdenable
                dataSource={facturasFiltradas}
                columns={columnas}
                rowKey="facturaId"
                loading={loading}
                pagination={{ pageSize: 10 }}
                style={{ background: colors.cardBg, borderRadius: 18 }}
                locale={{ emptyText: <Empty description="Aún no has generado ninguna factura electrónica" /> }}
            />

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Documento de la factura</span>}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={960}
                destroyOnHidden
                loading={cargandoDetalle}
            >
                {detalle && (
                    <>
                        <FacturaDocumentoView detalle={detalle} />
                        <div className="no-imprimir" style={{ marginTop: 16, textAlign: 'right' }}>
                            <Tooltip title={!detalle.cliente.correo ? 'Este cliente no tiene correo registrado' : ''}>
                                <Button
                                    type="primary"
                                    icon={correoEnviado ? <CheckCircleFilled /> : <MailOutlined />}
                                    loading={enviandoCorreo}
                                    disabled={!detalle.cliente.correo || correoEnviado}
                                    onClick={enviarPorCorreo}
                                    style={{
                                        borderRadius: 14, fontWeight: 600,
                                        background: correoEnviado ? colors.primary : colors.primary,
                                        borderColor: colors.primary,
                                    }}
                                >
                                    {correoEnviado ? 'Enviada por correo' : `Enviar a ${detalle.cliente.correo || 'cliente sin correo'}`}
                                </Button>
                            </Tooltip>
                        </div>
                    </>
                )}
            </Modal>

            <Modal
                title={<span style={{ color: colors.heading, fontWeight: 700 }}>Generar factura electrónica</span>}
                open={modalGenerar}
                onCancel={() => { setModalGenerar(false); setVentaSeleccionada(undefined) }}
                footer={null}
                destroyOnHidden
            >
                <p style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: -4 }}>
                    Elige la venta a la que quieres generarle su factura electrónica ante la DIAN.
                    Requiere tener configuradas tus credenciales de Factus en Configuración.
                </p>
                <Select
                    placeholder="Buscar venta por número o cliente"
                    showSearch
                    optionFilterProp="label"
                    value={ventaSeleccionada}
                    onChange={setVentaSeleccionada}
                    style={{ width: '100%', marginBottom: 16 }}
                    notFoundContent={<Empty description="No hay ventas pendientes por facturar" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                    options={ventasSinFactura.map(v => ({
                        value: v.ventaId,
                        label: `${v.numeroVenta} · ${v.clienteNombre || 'Consumidor final'} · ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v.total)}`
                    }))}
                />
                <Button
                    type="primary" block loading={generando} disabled={!ventaSeleccionada}
                    onClick={generarFactura}
                    style={{ background: colors.primary, borderColor: colors.primary, fontWeight: 600 }}
                >
                    Generar factura electrónica
                </Button>
            </Modal>
            <NotaCreditoModal
                factura={facturaNota}
                detalle={detalleNota}
                open={modalNota}
                onClose={() => setModalNota(false)}
                onEmitida={cargar}
            />
            <NotaDebitoModal
                factura={facturaNotaDebito}
                open={modalNotaDebito}
                onClose={() => setModalNotaDebito(false)}
                onEmitida={cargar}
            />
        </div>
    )
}
