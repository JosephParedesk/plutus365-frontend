import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────
// Coinciden con ConfiguracionDian.java / Factura.java del backend (puerto 8089)

export type AmbienteFactus = 'PRUEBAS' | 'PRODUCCION'
export type EstadoFactura = 'GENERADA' | 'ACEPTADA' | 'RECHAZADA' | 'ERROR'

export interface ConfiguracionDian {
    empresaId: string
    factusClientId: string
    factusClientSecret?: string    // el backend nunca lo devuelve; vacío = no cambiar
    factusUsername: string
    factusPassword?: string        // ídem
    facturaNumberingRangeId?: number
    notaCreditoNumberingRangeId?: number
    notaDebitoNumberingRangeId?: number
    documentoSoporteNumberingRangeId?: number
    nominaNumberingRangeId?: string
    notaAjusteDocumentoSoporteNumberingRangeId?: number
    notaAjusteNominaNumberingRangeId?: string
    activo?: boolean
}

export interface RangoNumeracion {
    id: number
    document: string
    prefix: string
    from?: string
    to?: string
    current?: string
    isActive: boolean
}

export type ConfiguracionDianRequest = Omit<ConfiguracionDian, 'empresaId' | 'activo'>

export interface Factura {
    facturaId: number
    empresaId: string
    ventaId: number
    numeroFactura: string
    cufe: string
    qrUrl: string
    urlDocumento?: string
    ambiente: AmbienteFactus
    estado: EstadoFactura
    respuestaDian: string
    fechaEmision: string
    fechaEnvio: string
}

// ─── Datos agregados para renderizar/enviar el documento visible ──────────────

export interface VentaItemFactura {
    sku: string
    nombreProducto: string
    cantidad: number
    precioUnitario: number
    descuento?: number
    valorTotal: number
}

export interface VentaFactura {
    ventaId: number
    numeroVenta: string
    clienteId?: number
    clienteNombre?: string
    fecha: string
    estado: string
    items: VentaItemFactura[]
    subtotal: number
    descuentoTotal?: number
    totalIva?: number
    total: number
}

export interface ClienteFactura {
    clienteId?: number
    tipoPersona: string
    tipoDocumento: string
    numeroDocumento: string
    dv?: string
    regimenFiscal: string
    razonSocial?: string
    nombres?: string
    apellidos?: string
    correo?: string
    telefono?: string
    direccion?: string
    ciudad?: string
    departamento?: string
    pais?: string
}

export interface EmpresaFactura {
    empresaId: string
    tipoPersona: string
    tipoDocumento: string
    numeroDocumento: string
    dv?: string
    regimenFiscal: string
    razonSocial?: string
    nombres?: string
    apellidos?: string
    correo?: string
    telefono?: string
    direccion?: string
    ciudad?: string
    departamento?: string
    pais?: string
    logoUrl?: string
}

export interface FacturaDetalle {
    factura: Factura
    venta: VentaFactura
    cliente: ClienteFactura
    empresa: EmpresaFactura
    qrCodeBase64: string
}

// ─── Servicios ────────────────────────────────────────────────────────────────
// Base: /api/pos/facturacion  (ConfiguracionDianController.java + FacturaController.java)

export const configuracionDianService = {
    // 404 si la empresa aún no ha configurado su facturación electrónica
    obtener: () =>
        api.get<ConfiguracionDian>('/api/pos/facturacion/configuracion'),

    guardar: (data: ConfiguracionDianRequest) =>
        api.put<ConfiguracionDian>('/api/pos/facturacion/configuracion', data),

    // codigoDocumento: 21 factura, 22 nota crédito, 23 nota débito, 24 documento
    // soporte, 25 nota ajuste documento soporte, 26 nómina, 27 nota ajuste nómina.
    rangosNumeracion: (codigoDocumento: string) =>
        api.get<RangoNumeracion[]>('/api/pos/facturacion/configuracion/rangos-numeracion', { params: { codigoDocumento } }),
}

export const facturaService = {
    listar: () =>
        api.get<Factura[]>('/api/pos/facturacion/listar'),

    buscar: (facturaId: number) =>
        api.get<Factura>(`/api/pos/facturacion/buscar/${facturaId}`),

    // Todo lo necesario para renderizar/imprimir el documento visible de la factura
    obtenerDetalle: (facturaId: number) =>
        api.get<FacturaDetalle>(`/api/pos/facturacion/buscar/${facturaId}/detalle`),

    // Envía la factura (documento + CUFE) al correo del cliente
    enviarCorreo: (facturaId: number, correo: string) =>
        api.post(`/api/pos/facturacion/${facturaId}/enviar-correo`, { correo }),

    // Genera, firma y envía a la DIAN la factura electrónica de una venta ya registrada
    generar: (ventaId: number) =>
        api.post<Factura>(`/api/pos/facturacion/generar/${ventaId}`),

    // HTML crudo del correo de factura electrónica, con datos de ejemplo y el
    // logo/color reales de la empresa — para la vista previa en Configuración.
    vistaPreviaCorreo: () =>
        api.get<string>('/api/pos/facturacion/vista-previa-correo', { responseType: 'text' }),

    // Borra de Factus una factura pendiente/rechazada, para poder reintentar.
    eliminarNoValidada: (facturaId: number) =>
        api.delete(`/api/pos/facturacion/${facturaId}/eliminar-no-validada`),
}

// ─── Notas crédito ────────────────────────────────────────────────────────────
// Reglas DIAN: la nota SIEMPRE referencia el CUFE de la factura original y tiene
// su propio identificador (CUDE). El concepto de corrección viene del anexo técnico.

export interface ItemNotaCredito {
    sku?: string
    descripcion: string
    cantidad: number
    precioUnitario: number
    porcentajeIva?: number
    valorIva?: number
    valorTotal?: number
}

export interface NotaCredito {
    notaCreditoId?: number
    facturaId: number
    numeroFactura?: string
    cufeFactura?: string
    numeroNota?: string
    cude?: string
    ambiente?: string
    conceptoCodigo: string
    conceptoDescripcion?: string
    motivo?: string
    anulaTotal?: boolean
    items: ItemNotaCredito[]
    subtotal?: number
    totalIva?: number
    total?: number
    estado?: EstadoFactura
    respuestaDian?: string
    fechaEmision?: string
    creadoPor?: string
}

export interface ConceptoNotaCredito {
    codigo: string
    descripcion: string
}

export const notaCreditoService = {
    conceptos: () =>
        api.get<ConceptoNotaCredito[]>('/api/pos/facturacion/notas-credito/conceptos'),
    listar: () =>
        api.get<NotaCredito[]>('/api/pos/facturacion/notas-credito'),
    porFactura: (facturaId: number) =>
        api.get<NotaCredito[]>(`/api/pos/facturacion/notas-credito/por-factura/${facturaId}`),
    emitir: (nota: NotaCredito) =>
        api.post<NotaCredito>('/api/pos/facturacion/notas-credito', nota),
    eliminarNoValidada: (id: number) =>
        api.delete(`/api/pos/facturacion/notas-credito/${id}/eliminar-no-validada`),
}

// ─── Notas débito electrónicas (DIAN) ──────────────────────────────────────────
// No confundir con la "Nota débito (Ventas)" de venta-service (/api/pos/ventas) —
// esa es un ajuste interno de cartera que no se transmite a la DIAN. Esta sí,
// vía Factus, y siempre referencia una factura ya ACEPTADA.

export interface ItemNotaDebito {
    sku?: string
    descripcion: string
    cantidad: number
    precioUnitario: number
    porcentajeIva?: number
    valorIva?: number
    valorTotal?: number
}

export interface NotaDebito {
    notaDebitoId?: number
    facturaId: number
    numeroFactura?: string
    cufeFactura?: string
    numeroNota?: string
    cude?: string
    ambiente?: string
    conceptoCodigo: string
    conceptoDescripcion?: string
    motivo?: string
    items: ItemNotaDebito[]
    subtotal?: number
    totalIva?: number
    total?: number
    estado?: EstadoFactura
    respuestaDian?: string
    fechaEmision?: string
    creadoPor?: string
}

export interface ConceptoNotaDebito {
    codigo: string
    descripcion: string
}

export const notaDebitoService = {
    conceptos: () =>
        api.get<ConceptoNotaDebito[]>('/api/pos/facturacion/notas-debito/conceptos'),
    listar: () =>
        api.get<NotaDebito[]>('/api/pos/facturacion/notas-debito'),
    porFactura: (facturaId: number) =>
        api.get<NotaDebito[]>(`/api/pos/facturacion/notas-debito/por-factura/${facturaId}`),
    emitir: (nota: NotaDebito) =>
        api.post<NotaDebito>('/api/pos/facturacion/notas-debito', nota),
    eliminarNoValidada: (id: number) =>
        api.delete(`/api/pos/facturacion/notas-debito/${id}/eliminar-no-validada`),
}

// ─── Documentos soporte (DIAN) ──────────────────────────────────────────────────
// Obligatorio al comprar a un proveedor que NO está obligado a facturar
// electrónicamente (Resolución 000488/2022). Se genera con un clic desde la compra
// ya registrada — a diferencia de nota crédito/débito no hay ítems que completar a
// mano, se arman directo desde los ítems de la compra.

export interface ItemDocumentoSoporte {
    sku?: string
    descripcion: string
    cantidad: number
    precioUnitario: number
    descuento?: number
    porcentajeIva?: number
    valorIva?: number
    porcentajeRetencion?: number
    valorRetencion?: number
    valorTotal?: number
}

export interface DocumentoSoporte {
    documentoSoporteId?: number
    compraId: number
    numeroComprobante?: string
    proveedorId?: number
    proveedorNombre?: string
    numeroDocumento?: string
    cude?: string
    ambiente?: string
    items: ItemDocumentoSoporte[]
    subtotal?: number
    totalIva?: number
    totalRetencion?: number
    total?: number
    estado?: EstadoFactura
    respuestaDian?: string
    fechaEmision?: string
}

// ─── Nómina electrónica (DIAN) ──────────────────────────────────────────────────
// Un empleado por solicitud a Factus — se transmite de a uno, no toda la nómina
// del período junta. NO se pudo probar en vivo: la cuenta demo compartida de
// Factus no tiene habilitado el módulo de nómina electrónica (403 "La empresa no
// tiene habilitada la creación de este documento") — es un permiso de cuenta
// aparte del de facturación, hay que pedírselo a Factus cuando haya cuenta real.

export interface NominaElectronica {
    nominaElectronicaId?: number
    nominaId: number
    empleadoId: number
    nombreEmpleado?: string
    anio?: number
    mes?: number
    numeroDocumento?: string
    cude?: string
    ambiente?: string
    estado?: EstadoFactura
    respuestaDian?: string
    fechaEmision?: string
}

export const nominaElectronicaService = {
    listar: () =>
        api.get<NominaElectronica[]>('/api/pos/facturacion/nomina-electronica'),
    porPeriodo: (nominaId: number) =>
        api.get<NominaElectronica[]>(`/api/pos/facturacion/nomina-electronica/por-periodo/${nominaId}`),
    generar: (nominaId: number, empleadoId: number) =>
        api.post<NominaElectronica>(`/api/pos/facturacion/nomina-electronica/generar/${nominaId}/${empleadoId}`),
    eliminarNoValidada: (id: number) =>
        api.delete(`/api/pos/facturacion/nomina-electronica/${id}/eliminar-no-validada`),
}

export const documentoSoporteService = {
    listar: () =>
        api.get<DocumentoSoporte[]>('/api/pos/facturacion/documentos-soporte'),
    buscar: (id: number) =>
        api.get<DocumentoSoporte>(`/api/pos/facturacion/documentos-soporte/${id}`),
    // Genera, firma y envía a la DIAN el documento soporte de una compra ya registrada
    generar: (compraId: number) =>
        api.post<DocumentoSoporte>(`/api/pos/facturacion/documentos-soporte/generar/${compraId}`),
    eliminarNoValidada: (id: number) =>
        api.delete(`/api/pos/facturacion/documentos-soporte/${id}/eliminar-no-validada`),
}

// ─── Nota de ajuste a documento soporte (DIAN) ─────────────────────────────────
// Corrige o anula un documento soporte ya ACEPTADO. Los ítems y el proveedor se
// copian tal cual del documento original — no se pueden negociar cantidades
// nuevas, solo elegir el motivo (ConceptoNotaAjuste) y una observación.

export interface ConceptoNotaAjuste {
    codigo: string
    descripcion: string
}

export interface NotaAjusteDocumentoSoporte {
    notaAjusteId?: number
    documentoSoporteId: number
    numeroDocumentoSoporte?: string
    numeroNota?: string
    cude?: string
    qrUrl?: string
    ambiente?: string
    conceptoCodigo: string
    conceptoDescripcion?: string
    observacion?: string
    items: ItemDocumentoSoporte[]
    subtotal?: number
    totalIva?: number
    totalRetencion?: number
    total?: number
    estado?: EstadoFactura | 'GENERADA'
    respuestaDian?: string
    fechaEmision?: string
}

export const notaAjusteDocumentoSoporteService = {
    conceptos: () =>
        api.get<ConceptoNotaAjuste[]>('/api/pos/facturacion/notas-ajuste-documento-soporte/conceptos'),
    listar: () =>
        api.get<NotaAjusteDocumentoSoporte[]>('/api/pos/facturacion/notas-ajuste-documento-soporte'),
    porDocumentoSoporte: (documentoSoporteId: number) =>
        api.get<NotaAjusteDocumentoSoporte[]>(`/api/pos/facturacion/notas-ajuste-documento-soporte/por-documento-soporte/${documentoSoporteId}`),
    emitir: (documentoSoporteId: number, conceptoCodigo: string, observacion?: string) =>
        api.post<NotaAjusteDocumentoSoporte>(`/api/pos/facturacion/notas-ajuste-documento-soporte/${documentoSoporteId}`, { conceptoCodigo, observacion }),
    eliminarNoValidada: (id: number) =>
        api.delete(`/api/pos/facturacion/notas-ajuste-documento-soporte/${id}/eliminar-no-validada`),
}

// ─── Nota de ajuste de nómina electrónica (DIAN) ───────────────────────────────
// Anula ante la DIAN una nómina electrónica de un empleado ya ACEPTADA. Sin
// ítems ni concepto: solo referencia el número de la nómina original.

export interface NotaAjusteNomina {
    notaAjusteNominaId?: number
    nominaElectronicaId: number
    numeroNominaElectronica?: string
    numeroAjuste?: string
    ambiente?: string
    estado?: EstadoFactura
    respuestaDian?: string
    fechaEmision?: string
}

export const notaAjusteNominaService = {
    listar: () =>
        api.get<NotaAjusteNomina[]>('/api/pos/facturacion/notas-ajuste-nomina'),
    emitir: (nominaElectronicaId: number) =>
        api.post<NotaAjusteNomina>(`/api/pos/facturacion/notas-ajuste-nomina/${nominaElectronicaId}`),
}

// ─── Recepción de documentos / eventos RADIAN (DIAN) ───────────────────────────
// Al revés de todo lo demás: acá Plutus365 RECIBE una factura electrónica de un
// proveedor (por su CUFE, ya capturado al importar el XML de la compra) y debe
// confirmarle a la DIAN qué pasó con ella. Solo aplica a compras A CRÉDITO
// (Resolución 000085/2022). El evento "aceptación tácita" no existe acá a
// propósito: no lo puede emitir el receptor, lo genera la DIAN sola.

export type CodigoEventoRadian = '030' | '031' | '032' | '033'

export interface EventoRadianCatalogo {
    codigo: CodigoEventoRadian
    nombre: string
}

export interface ConceptoReclamoRadian {
    codigo: string
    descripcion: string
}

export interface PersonaRadian {
    tipoDocumento: string
    numeroDocumento: string
    dv?: string
    nombres: string
    apellidos: string
    cargo?: string
    area?: string
}

export interface EventoEmitidoRadian {
    codigo: string
    nombre: string
    fecha: string
    personaNombre: string
    respuestaDian?: string
}

export interface RecepcionDocumento {
    recepcionId?: number
    compraId: number
    cufe: string
    billId?: string
    estado: 'PENDIENTE_CARGA' | 'CARGADO' | 'ERROR'
    respuestaDian?: string
    eventos: EventoEmitidoRadian[]
    fechaCarga?: string
}

export const recepcionDocumentoService = {
    eventos: () =>
        api.get<EventoRadianCatalogo[]>('/api/pos/facturacion/recepcion/eventos'),
    conceptosReclamo: () =>
        api.get<ConceptoReclamoRadian[]>('/api/pos/facturacion/recepcion/conceptos-reclamo'),
    listar: () =>
        api.get<RecepcionDocumento[]>('/api/pos/facturacion/recepcion'),
    porCompra: (compraId: number) =>
        api.get<RecepcionDocumento>(`/api/pos/facturacion/recepcion/por-compra/${compraId}`),
    cargar: (compraId: number) =>
        api.post<RecepcionDocumento>(`/api/pos/facturacion/recepcion/cargar/${compraId}`),
    emitirEvento: (compraId: number, codigoEvento: CodigoEventoRadian, persona: PersonaRadian, conceptoReclamoCodigo?: string) =>
        api.post<RecepcionDocumento>(`/api/pos/facturacion/recepcion/${compraId}/evento`, {
            codigoEvento, conceptoReclamoCodigo, persona,
        }),
}
