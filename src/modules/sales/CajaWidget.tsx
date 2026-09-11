import { useState, useEffect } from 'react'
import { Card, Button, Modal, InputNumber, Input, message, Tag, Spin, Descriptions } from 'antd'
import { WalletOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons'
import { cajaService, type CajaSesion, type ResumenCaja } from '../../shared/services/ventaService'
import { colors } from '../../shared/theme/colors'

const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export default function CajaWidget() {
    const [caja, setCaja] = useState<CajaSesion | null>(null)
    const [cargando, setCargando] = useState(true)

    const [modalAbrir, setModalAbrir] = useState(false)
    const [montoApertura, setMontoApertura] = useState<number>(0)
    const [abriendo, setAbriendo] = useState(false)

    const [modalCerrar, setModalCerrar] = useState(false)
    const [esperado, setEsperado] = useState<ResumenCaja | null>(null)
    const [cargandoEsperado, setCargandoEsperado] = useState(false)
    const [montoContado, setMontoContado] = useState<number>(0)
    const [observaciones, setObservaciones] = useState('')
    const [cerrando, setCerrando] = useState(false)

    const cargarCaja = () => {
        setCargando(true)
        cajaService.actual()
            .then(({ data, status }) => setCaja(status === 204 ? null : data))
            .catch(() => setCaja(null))
            .finally(() => setCargando(false))
    }

    useEffect(cargarCaja, [])

    const abrirCaja = async () => {
        setAbriendo(true)
        try {
            const { data } = await cajaService.abrir(montoApertura)
            setCaja(data)
            setModalAbrir(false)
            setMontoApertura(0)
            message.success('Caja abierta')
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo abrir la caja')
        } finally {
            setAbriendo(false)
        }
    }

    const abrirModalCerrar = async () => {
        setModalCerrar(true)
        setCargandoEsperado(true)
        try {
            const { data } = await cajaService.esperado()
            setEsperado(data)
            setMontoContado(data.efectivoEsperado)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo calcular el efectivo esperado')
        } finally {
            setCargandoEsperado(false)
        }
    }

    const cerrarCaja = async () => {
        setCerrando(true)
        try {
            await cajaService.cerrar(montoContado, observaciones || undefined)
            message.success('Caja cerrada correctamente')
            setModalCerrar(false)
            setObservaciones('')
            setCaja(null)
        } catch (error: any) {
            message.error(error.response?.data?.message || 'No se pudo cerrar la caja')
        } finally {
            setCerrando(false)
        }
    }

    if (cargando) return null

    const diferenciaEnVivo = esperado ? montoContado - esperado.efectivoEsperado : 0

    return (
        <>
            <Card
                size="small"
                style={{
                    borderRadius: 18, marginBottom: 16,
                    border: `1px solid ${caja ? colors.border : colors.orange}`,
                    background: caja ? colors.cardBg : colors.orangeLight,
                }}
                styles={{ body: { padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <WalletOutlined style={{ fontSize: 18, color: caja ? colors.primary : colors.orange }} />
                    {caja ? (
                        <div>
                            <Tag color="green" style={{ marginRight: 8 }}>Caja abierta</Tag>
                            <span style={{ fontSize: 12.5, color: colors.textSecondary }}>
                                Desde {new Date(caja.fechaApertura).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                {' '}· Base: {formatoCOP.format(caja.montoApertura)}
                            </span>
                        </div>
                    ) : (
                        <span style={{ fontSize: 13, color: '#8a5a00', fontWeight: 600 }}>
                            No tienes una caja abierta — abre una para empezar a registrar el turno
                        </span>
                    )}
                </div>

                {caja ? (
                    <Button size="small" icon={<LockOutlined />} onClick={abrirModalCerrar} danger>
                        Cerrar caja
                    </Button>
                ) : (
                    <Button
                        size="small" type="primary" icon={<UnlockOutlined />}
                        onClick={() => setModalAbrir(true)}
                        style={{ background: colors.primary, borderColor: colors.primary }}
                    >
                        Abrir caja
                    </Button>
                )}
            </Card>

            {/* Modal abrir caja */}
            <Modal
                title="Abrir caja"
                open={modalAbrir}
                onCancel={() => setModalAbrir(false)}
                footer={null}
                destroyOnHidden
            >
                <p style={{ color: colors.textSecondary, fontSize: 13 }}>
                    ¿Con cuánto efectivo empiezas el turno? (base de caja)
                </p>
                <InputNumber
                    min={0}
                    value={montoApertura}
                    onChange={(v) => setMontoApertura(Number(v) || 0)}
                    style={{ width: '100%', marginBottom: 16 }}
                    size="large"
                    formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
                <Button
                    type="primary" block size="large" loading={abriendo} onClick={abrirCaja}
                    style={{ background: colors.primary, borderColor: colors.primary }}
                >
                    Abrir caja
                </Button>
            </Modal>

            {/* Modal cerrar caja */}
            <Modal
                title="Cerrar caja"
                open={modalCerrar}
                onCancel={() => setModalCerrar(false)}
                footer={null}
                destroyOnHidden
            >
                {cargandoEsperado || !esperado ? (
                    <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>
                ) : (
                    <>
                        <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="Base de apertura">{formatoCOP.format(caja!.montoApertura)}</Descriptions.Item>
                            <Descriptions.Item label="Ventas en efectivo">{formatoCOP.format(esperado.totalEfectivo)}</Descriptions.Item>
                            <Descriptions.Item label="Ventas con tarjeta/transferencia">{formatoCOP.format(esperado.totalOtros)}</Descriptions.Item>
                            <Descriptions.Item label="Número de ventas">{esperado.numeroVentas}</Descriptions.Item>
                        </Descriptions>

                        <div style={{
                            background: colors.primaryLight, borderRadius: 16, padding: 14, marginBottom: 16, textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Efectivo que debe haber en caja</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: colors.primary }}>
                                {formatoCOP.format(esperado.efectivoEsperado)}
                            </div>
                        </div>

                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Cuenta el efectivo físico y escribe el total:</p>
                        <InputNumber
                            min={0}
                            value={montoContado}
                            onChange={(v) => setMontoContado(Number(v) || 0)}
                            style={{ width: '100%', marginBottom: 10 }}
                            size="large"
                            formatter={(v) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        />

                        {montoContado !== esperado.efectivoEsperado && (
                            <div style={{
                                textAlign: 'center', marginBottom: 10, fontWeight: 700,
                                color: diferenciaEnVivo > 0 ? colors.primary : colors.red,
                            }}>
                                {diferenciaEnVivo > 0
                                    ? `Sobran ${formatoCOP.format(diferenciaEnVivo)}`
                                    : `Faltan ${formatoCOP.format(Math.abs(diferenciaEnVivo))}`}
                            </div>
                        )}

                        <Input.TextArea
                            placeholder="Observaciones (opcional)"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            rows={2}
                            style={{ marginBottom: 16 }}
                        />

                        <Button type="primary" danger block size="large" loading={cerrando} onClick={cerrarCaja}>
                            Confirmar cierre de caja
                        </Button>
                    </>
                )}
            </Modal>
        </>
    )
}
