// Catálogo de reportes agrupado. `estado` marca honestamente qué se puede
// calcular hoy con los datos que el sistema realmente guarda, y qué necesita
// que primero se construya algo más (un campo, una tabla, un módulo).

export type EstadoReporte = 'DISPONIBLE' | 'REQUIERE_DATOS'

export interface ReporteDef {
    id: string
    nombre: string
    estado: EstadoReporte
    /** Si REQUIERE_DATOS: qué falta exactamente para poder construirlo. */
    faltante?: string
    /** Ruta externa si el reporte ya vive en otra pantalla. */
    ruta?: string
}

export interface GrupoReportes {
    id: string
    nombre: string
    descripcion: string
    reportes: ReporteDef[]
}

export const CATALOGO: GrupoReportes[] = [
    {
        id: 'estados-financieros',
        nombre: 'Estados financieros',
        descripcion: 'Calculados en vivo desde tus asientos contables',
        reportes: [
            {
                id: 'situacion-financiera',
                nombre: 'Estado de situación financiera (corriente / no corriente)',
                estado: 'DISPONIBLE',
                ruta: '/contabilidad/estados-financieros',
            },
            {
                id: 'situacion-liquidabilidad',
                nombre: 'Estado de situación financiera por orden de liquidabilidad',
                estado: 'DISPONIBLE',
                ruta: '/contabilidad/estados-financieros',
            },
            {
                id: 'resultado-integral',
                nombre: 'Estado de resultado integral',
                estado: 'DISPONIBLE',
                ruta: '/contabilidad/estados-financieros',
            },
            {
                id: 'resultado-funcion',
                nombre: 'Estado de resultado integral por función del gasto',
                estado: 'DISPONIBLE',
                ruta: '/contabilidad/estados-financieros',
            },
            {
                id: 'resultado-naturaleza',
                nombre: 'Estado de resultado integral por naturaleza del gasto',
                estado: 'DISPONIBLE',
                ruta: '/contabilidad/estados-financieros',
            },
            {
                id: 'ori',
                nombre: 'Estado de resultado integral, componentes ORI',
                estado: 'REQUIERE_DATOS',
                faltante: 'Ninguno de tus asientos usa cuentas de Otro Resultado Integral (revaluaciones, coberturas, diferencia en cambio). Sin movimientos en esas cuentas el reporte saldría vacío.',
            },
            {
                id: 'flujo-efectivo',
                nombre: 'Estado de flujos de efectivo (método indirecto)',
                estado: 'DISPONIBLE',
                ruta: '/contabilidad/estados-financieros',
            },
            {
                id: 'cambios-patrimonio',
                nombre: 'Estado de cambios en el patrimonio',
                estado: 'DISPONIBLE',
                ruta: '/contabilidad/estados-financieros',
            },
        ],
    },
    {
        id: 'ventas',
        nombre: 'Ingresos / Ventas',
        descripcion: 'Análisis de tus ventas registradas en el POS',
        reportes: [
            { id: 'ventas-cliente', nombre: 'Ventas por cliente', estado: 'DISPONIBLE' },
            { id: 'ventas-producto', nombre: 'Ventas por producto', estado: 'DISPONIBLE' },
            { id: 'ventas-vendedor', nombre: 'Ventas por vendedor', estado: 'DISPONIBLE' },
            { id: 'ventas-cliente-producto', nombre: 'Ventas por cliente por producto', estado: 'DISPONIBLE' },
            { id: 'ventas-vendedor-producto', nombre: 'Ventas por vendedor por producto', estado: 'DISPONIBLE' },
            { id: 'ventas-mes', nombre: 'Comparativo de ventas por mes', estado: 'DISPONIBLE' },
            { id: 'ventas-comp-producto', nombre: 'Comparativo de ventas por producto', estado: 'DISPONIBLE' },
            { id: 'ventas-comp-vendedor', nombre: 'Comparativo de ventas por vendedor', estado: 'DISPONIBLE' },
            { id: 'movimiento-ventas', nombre: 'Movimiento facturas de venta / Ingresos', estado: 'DISPONIBLE' },
            { id: 'recibos-caja', nombre: 'Recibos de caja detallado', estado: 'DISPONIBLE' },
            {
                id: 'facturacion-electronica',
                nombre: 'Informe de facturación electrónica',
                estado: 'DISPONIBLE',
                ruta: '/facturacion',
            },
            { id: 'ventas-centro-costo', nombre: 'Ventas por centro de costo', estado: 'DISPONIBLE' },
            { id: 'obsequios', nombre: 'Informe facturación de obsequios', estado: 'DISPONIBLE' },
            { id: 'cotizaciones', nombre: 'Cotizaciones por vendedor', estado: 'DISPONIBLE' },
            { id: 'recurrentes', nombre: 'Seguimiento de facturas recurrentes', estado: 'DISPONIBLE' },
            {
                id: 'notas-venta',
                nombre: 'Movimiento notas crédito y débito (ventas)',
                estado: 'REQUIERE_DATOS',
                faltante: 'Las notas crédito/débito existen solo en Compras. En Ventas todavía no se pueden emitir.',
            },
        ],
    },
    {
        id: 'compras',
        nombre: 'Compras',
        descripcion: 'Análisis de tus compras y gastos a proveedores',
        reportes: [
            { id: 'compras-proveedor', nombre: 'Compras por proveedor', estado: 'DISPONIBLE' },
            { id: 'compras-producto', nombre: 'Compras por producto', estado: 'DISPONIBLE' },
            { id: 'compras-comprador', nombre: 'Compras por comprador', estado: 'DISPONIBLE' },
            { id: 'compras-proveedor-producto', nombre: 'Compras por proveedor por producto', estado: 'DISPONIBLE' },
            { id: 'compras-mes', nombre: 'Comparativo de compras por mes', estado: 'DISPONIBLE' },
            { id: 'compras-comp-producto', nombre: 'Comparativo de compras por producto', estado: 'DISPONIBLE' },
            { id: 'movimiento-compras', nombre: 'Movimiento facturas de compra / Gastos', estado: 'DISPONIBLE' },
            { id: 'notas-compra', nombre: 'Movimiento notas débito y ajustes (compras)', estado: 'DISPONIBLE' },
            { id: 'cartera-proveedores', nombre: 'Cartera de proveedores (saldos pendientes)', estado: 'DISPONIBLE' },
            { id: 'compras-centro-costo', nombre: 'Compras por centro de costo', estado: 'DISPONIBLE' },
            {
                id: 'ordenes-compra',
                nombre: 'Seguimiento de órdenes de compra',
                estado: 'DISPONIBLE',
            },
        ],
    },
    {
        id: 'tributaria',
        nombre: 'Tributaria',
        descripcion: 'IVA, retenciones y libros oficiales para tus declaraciones',
        reportes: [
            { id: 'trib-iva', nombre: 'Impuesto a las ventas (IVA)', estado: 'DISPONIBLE' },
            { id: 'trib-retenciones', nombre: 'Retención en la fuente y de IVA', estado: 'DISPONIBLE' },
            { id: 'libro-ventas', nombre: 'Libro oficial de ventas', estado: 'DISPONIBLE' },
            { id: 'libro-compras', nombre: 'Libro oficial de compras', estado: 'DISPONIBLE' },
            { id: 'trib-renta-base', nombre: 'Base contable para impuesto de renta', estado: 'DISPONIBLE' },
            {
                id: 'trib-renta',
                nombre: 'Liquidación del impuesto de renta',
                estado: 'REQUIERE_DATOS',
                faltante: 'La liquidación real exige depuración fiscal: gastos no deducibles, renta presuntiva, descuentos tributarios, anticipos y pérdidas de años anteriores. El sistema no captura esa información, y calcularla mal genera sanciones. Usa el reporte "Base contable para renta" y entrégaselo a tu contador.',
            },
            {
                id: 'trib-otros',
                nombre: 'Otros impuestos (ICA, ReteICA)',
                estado: 'REQUIERE_DATOS',
                faltante: 'El ICA depende de la tarifa por actividad económica de cada municipio, que cambia entre ciudades. Habría que configurar tu municipio y tu código de actividad CIIU antes de poder calcularlo.',
            },
        ],
    },
    {
        id: 'nomina',
        nombre: 'Nómina',
        descripcion: 'Liquidaciones, aportes, provisiones y acumulados',
        reportes: [
            { id: 'nom-consolidado', nombre: 'Consolidado de ingresos y deducciones', estado: 'DISPONIBLE' },
            { id: 'nom-detallada-concepto', nombre: 'Nómina detallada por concepto', estado: 'DISPONIBLE' },
            { id: 'nom-seguridad-social', nombre: 'Aportes a seguridad social por empleado', estado: 'DISPONIBLE' },
            { id: 'nom-parafiscales', nombre: 'Aportes parafiscales por empleado', estado: 'DISPONIBLE' },
            { id: 'nom-arl', nombre: 'Aportes ARL por empleado', estado: 'DISPONIBLE' },
            { id: 'nom-provisiones', nombre: 'Provisiones por empleado', estado: 'DISPONIBLE' },
            { id: 'nom-prima', nombre: 'Prima de servicios', estado: 'DISPONIBLE' },
            { id: 'nom-acumulados-general', nombre: 'Acumulados generales de nómina', estado: 'DISPONIBLE' },
            { id: 'nom-acumulados-detalle', nombre: 'Acumulados detallados de nómina', estado: 'DISPONIBLE' },
            { id: 'nom-pagos-empresa', nombre: 'Consolidado de pagos efectuados por la empresa', estado: 'DISPONIBLE' },
            { id: 'nom-periodos', nombre: 'Listado de períodos liquidados', estado: 'DISPONIBLE' },
            { id: 'nom-acumulados-iniciales', nombre: 'Acumulados iniciales de nómina', estado: 'DISPONIBLE' },
            {
                id: 'nom-electronica',
                nombre: 'Nómina electrónica DIAN (documento soporte)',
                estado: 'REQUIERE_DATOS',
                faltante: 'Requiere certificado digital, habilitación ante la DIAN y generación del XML con CUNE firmado, igual que la facturación electrónica. Norma vigente: Resolución Unificada 000227 de 2025, Título V, Cap. III, anexo T.5.4. Se transmite por empleado dentro de los 10 primeros días hábiles del mes siguiente.',
            },
        ],
    },
    {
        id: 'inventarios',
        nombre: 'Inventarios',
        descripcion: 'Existencias, valorización y catálogo de productos',
        reportes: [
            { id: 'saldos-inventario', nombre: 'Saldos de inventario (valorizado)', estado: 'DISPONIBLE' },
            { id: 'saldos-producto', nombre: 'Saldos por producto', estado: 'DISPONIBLE' },
            { id: 'listado-productos', nombre: 'Listado de productos / servicios', estado: 'DISPONIBLE' },
            { id: 'stock-bajo', nombre: 'Productos en stock bajo o agotados', estado: 'DISPONIBLE' },
            { id: 'kardex', nombre: 'Movimiento de productos / Kárdex', estado: 'DISPONIBLE' },
        ],
    },
]
