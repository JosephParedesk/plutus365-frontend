const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const DECENAS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
const DECENAS2 = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function bloqueDeTres(n: number): string {
    if (n === 0) return ''
    if (n === 100) return 'cien'

    let texto = ''
    const c = Math.floor(n / 100)
    const resto = n % 100

    if (c > 0) texto += CENTENAS[c] + ' '

    if (resto >= 10 && resto < 20) {
        texto += DECENAS[resto - 10]
    } else {
        const d = Math.floor(resto / 10)
        const u = resto % 10
        if (d >= 2) {
            texto += DECENAS2[d]
            if (u > 0) texto += ' y ' + UNIDADES[u]
        } else if (u > 0) {
            texto += UNIDADES[u]
        }
    }

    return texto.trim()
}

export function numeroALetras(valor: number): string {
    const entero = Math.round(Math.abs(valor))
    if (entero === 0) return 'Cero pesos m/cte'

    const millones = Math.floor(entero / 1_000_000)
    const miles = Math.floor((entero % 1_000_000) / 1000)
    const resto = entero % 1000

    let partes: string[] = []

    if (millones > 0) {
        partes.push(millones === 1 ? 'un millón' : bloqueDeTres(millones) + ' millones')
    }
    if (miles > 0) {
        partes.push(miles === 1 ? 'mil' : bloqueDeTres(miles) + ' mil')
    }
    if (resto > 0) {
        partes.push(bloqueDeTres(resto))
    }

    let texto = partes.join(' ').trim()
    texto = texto.charAt(0).toUpperCase() + texto.slice(1)
    return `${texto} pesos m/cte`
}
