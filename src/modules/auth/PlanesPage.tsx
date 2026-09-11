import { Card, Button, Badge, Spin, message } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { planesService } from '../../shared/services/planesService'
import AuthIllustration from '../../shared/components/AuthIllustration'
import { colors } from '../../shared/theme/colors'
import logoPlutus from '../../assets/logo.png'

const cardStyle = (popular: boolean, hovered: boolean) => ({
  width: 320,
  borderRadius: 22,
  background: colors.cardBg,
  border: 'none',
  boxShadow: hovered || popular
    ? '0 4px 10px rgba(0,0,0,.04), 0 20px 45px rgba(0,0,0,.10)'
    : '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)',
  transform: hovered ? 'translateY(-8px)' : 'translateY(0)',
  transition: 'all .25s ease',
  cursor: 'pointer',
})

export default function PlanesPage() {
  const navigate = useNavigate()
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)
  const [planes, setPlanes] = useState<any[]>([])
  const [loadingPlanes, setLoadingPlanes] = useState(true)

  useEffect(() => {
    planesService.listar()
      .then(({ data }) => setPlanes(data))
      .catch(() => message.error('Error al cargar los planes'))
      .finally(() => setLoadingPlanes(false))
  }, [])

  if (loadingPlanes) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <Spin size="large" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <style>{`
          @media (max-width: 800px) { .planes-ilustracion-banner { display: none; } }
      `}</style>

      {/* Banner superior con ilustración de marca */}
      <div style={{ background: colors.authPanelBg, padding: '44px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ marginBottom: 18 }}>
              <img src={logoPlutus} alt="Plutus365" style={{ height: 100, width: 'auto' }} />
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, color: '#fff' }}>
              Elige tu plan
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', marginTop: 8, fontSize: 15 }}>
              Comienza gratis por 14 días, sin tarjeta de crédito
            </p>
          </div>
          <div className="planes-ilustracion-banner" style={{ width: 220, height: 220, flexShrink: 0 }}>
            <AuthIllustration />
          </div>
        </div>
      </div>

      <div style={{ padding: '48px 24px' }}>

      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 1100, margin: '0 auto' }}>
        {planes.map((plan, i) => (
          <Badge.Ribbon
            key={plan.id}
            text="Más popular"
            color={colors.primaryDark}
            style={{ display: plan.popular ? 'block' : 'none' }}
          >
            <Card
              className="fade-in"
              style={{ ...cardStyle(plan.popular, hoveredPlan === plan.id), animationDelay: `${i * 80}ms` }}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: hoveredPlan === plan.id || plan.popular ? colors.primary : colors.heading }}>
                {plan.nombre}
              </h2>
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: colors.primary }}>
                  ${plan.precio.toLocaleString('es-CO')}
                </span>
                <span style={{ color: colors.textSecondary, marginLeft: 4 }}>/mes</span>
              </div>

              <div style={{ marginBottom: 28 }}>
                {plan.modulos?.map((m: string) => (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <CheckOutlined style={{ color: colors.primary, fontSize: 14 }} />
                    <span style={{ fontSize: 14, color: colors.textSecondary }}>{m}</span>
                  </div>
                ))}
              </div>

              <Button
                size="large"
                block
                onClick={() => navigate(`/registro?plan=${plan.id}`)}
                style={{
                  background: hoveredPlan === plan.id || plan.popular ? colors.primary : colors.cardBg,
                  border: 'none',
                  boxShadow: hoveredPlan === plan.id || plan.popular ? 'none' : '0 2px 6px rgba(0,0,0,.03), 0 10px 30px rgba(0,0,0,.08)',
                  color: hoveredPlan === plan.id || plan.popular ? '#fff' : colors.primary,
                  fontWeight: 600,
                  borderRadius: 22,
                  transition: 'all .25s ease',
                }}
              >
                Comenzar ahora
              </Button>
            </Card>
          </Badge.Ribbon>
        ))}
      </div>
      </div>
    </div>
  )
}