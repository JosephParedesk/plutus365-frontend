export type Rol = 'ADMIN' | 'CAJERO' | 'CONTADOR' | 'INVENTARIO'
export type Modulo =
    | 'VENTAS' | 'CLIENTES' | 'INVENTARIO' | 'COMPRAS'
    | 'CONTABILIDAD' | 'FACTURACION' | 'NOMINA' | 'CONFIGURACION'
export type NivelAcceso = 'NONE' | 'READ' | 'FULL'

export const ROLES_DISPONIBLES: { value: Rol; label: string; descripcion: string }[] = [
    { value: 'ADMIN', label: 'Administrador', descripcion: 'Acceso total a todos los módulos' },
    { value: 'CAJERO', label: 'Cajero', descripcion: 'Ventas y clientes completo · Inventario solo lectura' },
    { value: 'CONTADOR', label: 'Contador', descripcion: 'Contabilidad, facturación y nómina completo · resto en lectura' },
    { value: 'INVENTARIO', label: 'Inventario / Compras', descripcion: 'Inventario y compras completo · Ventas solo lectura' },
]

// Mismo criterio que PermisosInterceptor.java del gateway. Si cambias uno, cambia el otro.
const MATRIZ: Record<Exclude<Rol, 'ADMIN'>, Partial<Record<Modulo, NivelAcceso>>> = {
    CAJERO: {
        VENTAS: 'FULL',
        CLIENTES: 'FULL',
        INVENTARIO: 'READ',
    },
    CONTADOR: {
        CONTABILIDAD: 'FULL',
        FACTURACION: 'FULL',
        NOMINA: 'FULL',
        VENTAS: 'READ',
        COMPRAS: 'READ',
        CLIENTES: 'READ',
        INVENTARIO: 'READ',
    },
    INVENTARIO: {
        INVENTARIO: 'FULL',
        COMPRAS: 'FULL',
        VENTAS: 'READ',
    },
}

export function nivelAcceso(rol: string | undefined, modulo: Modulo): NivelAcceso {
    if (!rol || rol.toUpperCase() === 'ADMIN') return 'FULL'
    return MATRIZ[rol.toUpperCase() as Exclude<Rol, 'ADMIN'>]?.[modulo] ?? 'NONE'
}

export function puedeVer(rol: string | undefined, modulo: Modulo): boolean {
    return nivelAcceso(rol, modulo) !== 'NONE'
}

export function puedeEditar(rol: string | undefined, modulo: Modulo): boolean {
    return nivelAcceso(rol, modulo) === 'FULL'
}
