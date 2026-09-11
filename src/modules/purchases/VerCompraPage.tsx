import { useState, useEffect } from 'react'
import { colors } from '../../shared/theme/colors'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, Result } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { compraService, type Compra } from '../../shared/services/compraService'
import CompraDocumentoView from './CompraDocumentoView'

export default function VerCompraPage() {
    const { compraId } = useParams()
    const navigate = useNavigate()
    const [compra, setCompra] = useState<Compra | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!compraId) return
        compraService.buscarPorId(Number(compraId))
            .then(({ data }) => setCompra(data))
            .catch(() => setError(true))
            .finally(() => setLoading(false))
    }, [compraId])

    if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
    if (error || !compra) return <Result status="404" title="Compra no encontrada" />

    return (
        <div>
            <Button
                className="no-imprimir"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/compras')}
                style={{ marginBottom: 16, borderRadius: 14 }}
            >
                Volver a Compras
            </Button>
            <CompraDocumentoView compra={compra} />
        </div>
    )
}
