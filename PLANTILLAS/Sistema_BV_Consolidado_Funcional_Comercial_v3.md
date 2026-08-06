# SISTEMA BV — CONSOLIDADO FUNCIONAL Y COMERCIAL

## 1. Identidad del proyecto

- **Nombre del sistema:** Sistema BV.
- **Cliente:** Corporativo BVOK.
- **Razón social contratante:** Servicios y Equipos en Biotecnología de Zacatecas.
- **Contacto principal:** Manuel Antonio.
- **Empresas principales:** BIOTECZAC, PRO OMNIMEDIC y VALMA.

El corporativo está conformado por más empresas, pero estas tres serán las principales dentro de la primera operación del sistema.

## 2. Objetivo general

Sistema BV será una plataforma web responsiva para centralizar la operación comercial, logística y documental del Corporativo BVOK.

El sistema deberá controlar productos, inventarios, almacenes, equipos médicos, mobiliario, compras, ventas, traspasos, remisiones, contratos, licitaciones, órdenes de reposición del IMSS, cobranza, CFDI recibidos, catálogos comerciales, reportes y auditoría.

La plataforma se instalará en el servidor propio del corporativo y deberá ser accesible de forma segura desde cualquier parte del mundo.

## 3. Estructura conceptual

```text
Corporativo BVOK
└── Empresas o razones sociales
    └── Regiones
        └── Almacenes
```

Cada sede tendrá su propio almacén. Los usuarios tendrán acceso según empresa, región, almacén, puesto, responsabilidad y nivel de autorización.

## 4. Operación multiempresa

En un mismo almacén podrá existir mercancía que haya ingresado por una empresa y posteriormente sea vendida por otra.

Cada movimiento deberá identificar como mínimo:

- Empresa que compró la mercancía.
- Empresa propietaria.
- Empresa que la resguarda.
- Empresa que la vende.
- Empresa que genera la cuenta por cobrar.
- Almacén físico.
- Documento de entrada.
- Documento de salida.
- Lote, serie o unidad correspondiente.
- Costo de entrada.
- Precio de salida.
- Relación intercompañía.

El sistema deberá conservar la trazabilidad necesaria para que contabilidad pueda identificar por dónde ingresó la mercancía y por qué empresa salió. Las reglas contables definitivas deberán validarse con el área contable.

## 5. Tipos de almacén e inventario

### Almacén general

Mercancía disponible para venta, entrega o traspaso.

### Almacén refrigerado

Productos que requieren conservación bajo condiciones controladas.

### Almacén de caducados

Productos vencidos que deben permanecer contabilizados y separados del inventario vendible.

### Almacén de muestras

Mercancía destinada a demostraciones, promoción, capacitación o entrega sin venta. Las muestras deberán permanecer contabilizadas e identificadas como mercancía no disponible para venta regular.

### Inventario en tránsito

Mercancía trasladada mediante paquetería, transporte propio, envíos especiales u otros medios. Mientras esté en tránsito no deberá aparecer disponible en origen ni en destino.

### Inventario móvil

Se deberá contemplar que un vendedor pueda llevar existencias en una camioneta u otra unidad móvil. La unidad podrá funcionar como almacén móvil con responsable, vehículo, productos, lotes, series, cantidades, entradas, salidas, devoluciones y evidencias.

## 6. Equipos médicos y mobiliario

El sistema deberá controlar equipos médicos y mobiliario entregados mediante venta, renta, comodato, préstamo o demostración.

### Equipos médicos

- Marca, modelo y número de serie.
- Estado.
- Empresa propietaria.
- Ubicación y responsable.
- Cliente y contrato.
- Fecha de entrega y devolución.
- Historial, documentos y fotografías.
- Mantenimiento.
- Renta o comodato.

### Mobiliario

- Tipo y código interno.
- Número de serie cuando aplique.
- Empresa propietaria.
- Sucursal o almacén.
- Responsable.
- Estado.
- Comodato, renta, devolución o baja.
- Evidencia fotográfica.

## 7. Catálogo maestro de productos

Cada producto podrá tener múltiples identificadores:

- Referencia del fabricante.
- Código de barras.
- Clave interna.
- Clave SAT.
- Clave SAI.
- Identificador RFID.
- Claves adicionales por proveedor, cliente, contrato o presentación.

### Claves SAI

Un producto podrá tener varias claves SAI según delegación, región, contrato, licitación, cliente o vigencia.

Cada clave SAI deberá registrar valor, delegación o región, cliente, contrato o licitación, vigencia, descripción institucional, estado y documento relacionado.

### Claves por presentación

Un producto podrá tener identificadores diferentes para pieza, paquete, caja de 10, caja de 100, corrugado, tarima u otras presentaciones.

Cada presentación deberá definir cantidad contenida, unidad base, código de barras, referencia, precio, costo, peso y dimensiones cuando aplique.

### Información adicional

- Nombre y descripciones.
- Marca y submarca.
- Fabricante.
- Distribuidor primario y distribuidores secundarios.
- Familia y categoría.
- Fotografías y fichas técnicas.
- Unidad de compra, venta e inventario.
- Factores de conversión.
- Productos relacionados o equivalentes.
- Condiciones de almacenamiento.

## 8. Registros sanitarios

Un mismo producto podrá tener varios registros sanitarios históricos.

Cada registro deberá incluir número, titular, fecha de inicio, fecha de vencimiento, estatus, documento, producto o presentación relacionada y observaciones.

Los registros vencidos no deberán eliminarse. El sistema deberá conservar el historial y emitir alertas de vencimiento.

## 9. Lotes, caducidades y series

El sistema deberá controlar lote, fabricación, caducidad, número de serie, empresa propietaria, almacén, estado, costo, proveedor, documento de compra y documento de salida.

Alertas de caducidad:

- 15 días.
- 30 días.
- 60 días.
- 90 días.
- Periodos configurables.

Estados posibles:

- Disponible.
- Reservado.
- En tránsito.
- Refrigerado.
- Muestra.
- Caducado.
- Dañado.
- Prestado.
- Rentado.
- En comodato.
- No disponible.

## 10. Costos de compra

Un producto podrá conservar varios costos históricos por recepción, lote o unidad.

Cada recepción deberá registrar empresa compradora, proveedor, factura, producto, presentación, cantidad, lote, caducidad, costo unitario, impuestos, descuentos, fletes, gastos adicionales, moneda, tipo de cambio y costo final.

## 11. Compras y proveedores

El sistema deberá permitir registrar proveedores, fabricantes y distribuidores; solicitar compras; comparar cotizaciones; generar y autorizar órdenes de compra; recibir mercancía; registrar facturas; asociar lotes, series y caducidades; manejar recepciones parciales; devoluciones; notas de crédito; créditos con proveedores; pagos pendientes e historial de precios.

## 12. Traspasos

```text
Solicitud
→ Revisión
→ Autorización
→ Reserva
→ Preparación
→ Salida
→ En tránsito
→ Recepción
→ Diferencias
→ Cierre
```

Cada traspaso deberá registrar empresas, regiones, almacenes, productos, presentaciones, lotes, series, cantidades, transportista, paquetería, guía, evidencias, daños, faltantes, sobrantes, responsables, fechas y horas.

## 13. Ventas, pedidos y cotizaciones

El sistema deberá permitir crear y versionar cotizaciones, registrar pedidos, seleccionar empresa vendedora, reservar mercancía, surtir productos, seleccionar lotes, generar remisiones, entregar parcialmente, registrar devoluciones, dar seguimiento a cobranza y relacionar contratos y órdenes de reposición.

## 14. Remisiones A, B, C y D

Se manejarán varias versiones documentales de una misma operación: remisión A, B, C y D.

El sistema deberá conservar por separado el movimiento interno real y las representaciones documentales destinadas al cliente.

Aunque una versión muestre una descripción distinta, la plataforma deberá conservar internamente el producto real y mantener intacta la relación con inventario, contrato, cobranza, empresa, costo, evidencia y auditoría.

Todas las versiones deberán quedar ligadas a una misma operación principal.

## 15. IMSS y órdenes de reposición

El cliente principal es el IMSS. Sistema BV deberá permitir cargar órdenes de reposición, registrar número, fecha, delegación y contrato, adjuntar archivos, relacionar productos y claves SAI, vincular una orden con una o múltiples remisiones, consultar saldos, entregas pendientes, cobranza, CFDI e historial.

También deberá detectar remisiones sin orden de reposición y órdenes sin remisiones asociadas.

## 16. Contratos y licitaciones

El sistema deberá administrar clientes, contratos, licitaciones, delegaciones, partidas, renglones, claves SAI, productos internos, precios, cantidades, vigencias, entregas, remisiones, órdenes de reposición, facturación, cobranza, documentos, saldos y alertas.

## 17. CFDI y SAT

Sistema BV no timbrará, cancelará, sustituirá ni generará facturas.

El módulo fiscal futuro se limitará a obtener CFDI, descargar XML o metadata, clasificar por empresa, relacionar con compras, remisiones, órdenes de reposición y pagos, detectar faltantes y duplicados, y facilitar conciliaciones.

La integración con SAT queda fuera de la primera entrega comprometida.

## 18. Integración bancaria

La integración bancaria será posterior y podrá incluir importación de estados de cuenta, CSV, Excel u otros formatos, conciliación asistida, identificación de pagos, pagos parciales o agrupados, depósitos no identificados, comisiones y transferencias intercompañía.

No forma parte de la primera entrega.

## 19. RFID

El sistema deberá quedar preparado para RFID, pero su implementación será separada.

Podrá incluir generación de EPC, enrolamiento, impresión y codificación, asociación con producto, presentación, lote, serie, caja o tarima, lecturas masivas, inventarios físicos, entradas y salidas, lectores móviles y fijos e impresoras RFID.

No forma parte de la primera entrega.

## 20. Inteligencia artificial

La IA será posterior y podrá utilizarse para búsqueda inteligente, homologación, detección de duplicados, limpieza de información, clasificación, extracción documental, análisis de inventario, riesgo de caducidad, recomendaciones de compra o traspaso, detección de anomalías y generación diferenciada de catálogos para páginas web.

No forma parte de la primera entrega.

## 21. Catálogos PDF y API de productos

Sistema BV deberá generar catálogos PDF con o sin precios, por empresa, marca, familia, selección, cliente o contrato.

También se desarrollará una API o servicio de catálogo para alimentar las páginas web de las empresas del corporativo desde una misma base de productos.

La diferenciación de redacción y apariencia mediante IA queda excluida de la primera entrega.

## 22. Reportes

El sistema deberá ofrecer reportes filtrables y exportables a Excel, CSV y PDF sobre existencias, lotes, caducidades, series, almacenes, inventario refrigerado, muestras, caducados, tránsito, inventario móvil, equipos médicos, mobiliario, comodatos, rentas, compras, costos, proveedores, ventas, remisiones, órdenes de reposición, contratos, licitaciones, cobranza, CFDI, movimientos intercompañía y auditoría.

## 23. Hardware e infraestructura

La solución se instalará en el servidor propio del Corporativo BVOK.

### Firewall

Se requiere adquirir e implementar un firewall y gateway de la familia **UniFi Dream Machine**.

El modelo exacto se seleccionará posteriormente conforme a:

- Velocidad de internet.
- Número de usuarios simultáneos.
- Accesos remotos.
- VPN.
- Inspección y filtrado de tráfico.
- Número de sedes.
- Reglas de seguridad.
- Capacidad de crecimiento.
- Redundancia requerida.

### Memoria RAM

Se agregarán **32 GB de memoria RAM adicionales** al servidor existente.

Antes de la compra deberá confirmarse:

- Compatibilidad con el servidor.
- Tipo y velocidad de memoria.
- Distribución de módulos.
- Canales de memoria disponibles.
- Capacidad máxima soportada.
- Posibilidad de expansión futura.

### Almacenamiento

La capacidad prevista de almacenamiento es de **8 TB físicos**, distribuidos en dos discos de **4 TB + 4 TB** configurados en espejo.

Esta configuración proporcionará aproximadamente **4 TB útiles**, antes del espacio reservado por formato, sistema y metadatos.

El diseño definitivo deberá considerar:

- Espacio útil después de RAID o redundancia.
- Base de datos.
- Fotografías de productos.
- Facturas y archivos XML.
- Contratos.
- Remisiones.
- Órdenes de reposición.
- Fichas técnicas.
- Evidencias.
- Historial.
- Respaldos.
- Crecimiento anual.
- Recuperación ante fallos.

La configuración prevista utilizará redundancia tipo espejo, de modo que la información se mantenga duplicada entre ambos discos. Si uno falla, el sistema podrá continuar operando con el otro hasta realizar el reemplazo.

### Volumen inicial previsto

- **Usuarios simultáneos:** 50.
- **Sedes iniciales:** 12.
- **Productos aproximados:** 4,000.
- **Documentos por contrato:** entre 10 y 40 archivos PDF.
- **Imágenes por producto:** entre 4 y 6.

Las sedes deberán administrarse desde el sistema para permitir altas, bajas y cambios sin modificar el código.

### Dominios

Se deberán adquirir inicialmente cuatro dominios para las empresas y el corporativo:

- BIOTECZAC.
- VALMA.
- PRO OMNIMEDIC.
- CORPORATIVO BV.

Las extensiones y nombres exactos deberán validarse según disponibilidad antes de la compra.

### Otros elementos por calcular o confirmar

- Discos y arreglo RAID.
- Unidad de respaldo.
- UPS.
- Certificados SSL.
- Respaldo externo.
- Monitoreo.
- VPN.
- Segundo enlace de internet.
- Política de recuperación.
- Capacidad de crecimiento.

El hardware, dominios, licencias y servicios de infraestructura no están incluidos dentro del precio de desarrollo, salvo que se indique expresamente mediante una cotización adicional.

## 24. Acceso y seguridad

Sistema BV será web, responsivo, instalado en servidor propio y accesible desde computadora, tableta o teléfono para usuarios autorizados desde cualquier parte del mundo.

El acceso deberá protegerse mediante HTTPS, usuarios individuales, contraseñas seguras, roles, permisos, sesiones, registros de acceso, restricción por empresa, región y almacén, respaldos y monitoreo.

Se recomienda considerar autenticación multifactor, VPN o acceso de confianza, alertas, bloqueo por intentos, cierre de sesiones, cifrado y auditoría.

## 25. Alcance comercial confirmado

### Contratante

- **Cliente:** Corporativo BVOK.
- **Razón social contratante:** Servicios y Equipos en Biotecnología de Zacatecas.
- **Contacto principal:** Manuel Antonio.

### Precio

- **Subtotal:** $380,000.00 MXN.
- **IVA:** 16%.
- **IVA total:** $60,800.00 MXN.
- **Total con IVA:** $440,800.00 MXN.

### Condiciones de pago

El importe se cubrirá mediante cinco pagos mensuales iguales durante agosto, septiembre, octubre, noviembre y diciembre de 2026.

| Mes | Subtotal | IVA 16% | Total mensual |
| --- | ---: | ---: | ---: |
| Agosto de 2026 | $76,000.00 | $12,160.00 | $88,160.00 |
| Septiembre de 2026 | $76,000.00 | $12,160.00 | $88,160.00 |
| Octubre de 2026 | $76,000.00 | $12,160.00 | $88,160.00 |
| Noviembre de 2026 | $76,000.00 | $12,160.00 | $88,160.00 |
| Diciembre de 2026 | $76,000.00 | $12,160.00 | $88,160.00 |
| **Total** | **$380,000.00** | **$60,800.00** | **$440,800.00** |

El día exacto de vencimiento de cada mensualidad deberá establecerse en el contrato.

### Incluye

- Plataforma web responsiva.
- Operación multiempresa.
- Regiones y almacenes editables.
- Configuración inicial de 12 sedes.
- Capacidad funcional prevista para 50 usuarios simultáneos.
- Catálogo inicial previsto de aproximadamente 4,000 productos.
- Productos y claves múltiples.
- Presentaciones.
- Registros sanitarios históricos y por vigencia.
- Inventarios.
- Lotes, caducidades y series.
- Inventario general, refrigerado, caducado, de muestras, en tránsito y móvil.
- Compras.
- Traspasos.
- Ventas.
- Remisiones múltiples.
- Órdenes de reposición del IMSS.
- Contratos y licitaciones.
- Equipos médicos y mobiliario.
- Comodatos y rentas.
- Catálogos PDF.
- API base del catálogo para páginas web.
- Reportes.
- Instalación en servidor propio.
- Acceso remoto seguro.
- Capacitación inicial.
- Garantía de un año sobre las funciones entregadas y existentes al momento de la aceptación.

### Garantía

La garantía tendrá una duración de **un año** y cubrirá correcciones de defectos en las funciones incluidas y entregadas.

No se considerarán garantía:

- Nuevas funciones.
- Ampliaciones de alcance.
- Optimizaciones no comprometidas.
- Rediseños solicitados posteriormente.
- Cambios de procesos.
- Integraciones nuevas.
- Modificaciones fiscales o de terceros.
- Daños provocados por infraestructura, usuarios, proveedores externos o alteraciones ajenas al desarrollo entregado.

Estos trabajos deberán cotizarse por separado.

### Propiedad del sistema

La propiedad del programa se otorgará al Corporativo BVOK bajo las condiciones que se establezcan en un contrato posterior.

El contrato deberá definir expresamente:

- Entrega de código fuente.
- Derechos patrimoniales.
- Documentación.
- Componentes de terceros.
- Librerías reutilizables.
- Credenciales y repositorios.
- Condiciones de modificación.
- Responsabilidades posteriores.

### No incluye

- Inteligencia artificial.
- Integración bancaria.
- Integración con SAT.
- RFID.
- Hardware.
- Compra de dominios.
- Licencias.
- Servicios de terceros.
- UniFi Dream Machine.
- Memoria RAM.
- Discos y almacenamiento.
- Infraestructura adicional.
- Facturación electrónica.
- Timbrado o cancelación de CFDI.
- Nuevas funciones u optimizaciones posteriores a la entrega.

## 26. Entrega

El objetivo comercial es entregar el núcleo funcional operando entre **diciembre de 2026 y enero de 2027**.

La fecha contractual definitiva y los criterios de aceptación deberán establecerse por escrito.

La entrega incluirá:

- Sistema funcional conforme al alcance contratado.
- Instalación en el servidor del corporativo.
- Configuración inicial.
- Pruebas.
- Corrección de defectos detectados durante la validación.
- Capacitación inicial.
- Documentación básica.
- Puesta en operación.

La plataforma será web y responsiva, y podrá utilizarse desde computadora, tableta o teléfono mediante accesos seguros desde cualquier parte del mundo.

## 27. Elementos excluidos actualmente

No se incluirá por ahora un módulo específico de calidad y regulación médica avanzada, cuarentena regulatoria, recall, desviaciones o cumplimiento sanitario avanzado.

Tampoco se presentará un esquema formal de fases comerciales dentro de la propuesta.

## 28. Pendientes de definición

1. Nombre completo y datos fiscales de la razón social contratante.
2. Nombre completo, cargo y datos de contacto de Manuel Antonio.
3. Referencia, fecha de emisión y vigencia de la propuesta.
4. Día exacto de vencimiento de cada mensualidad.
5. Fecha contractual definitiva de entrega.
6. Regiones y nombres de las 12 sedes iniciales.
7. Número total de usuarios registrados, además de los 50 simultáneos.
8. Volumen anual estimado de movimientos.
9. Modelo exacto de UniFi Dream Machine.
10. Confirmar modelo, tipo, velocidad y compatibilidad de los 32 GB adicionales de RAM.
11. Confirmar modelos y compatibilidad de los dos discos de 4 TB.
12. Confirmar que la configuración será RAID 1 o espejo y definir la estrategia de respaldo externo.
13. Extensiones y disponibilidad de los cuatro dominios.
14. Alcance exacto y número de sesiones de capacitación.
15. Inicio y forma de cómputo del año de garantía.
16. Tiempos de respuesta durante garantía.
17. Soporte posterior al año de garantía.
18. Alcance del contrato de propiedad intelectual y entrega de código fuente.
19. Reglas contables intercompañía.
20. Método de valuación de inventarios.
21. Sistema contable actual.
22. Criterios de aceptación de cada módulo.
23. Proceso formal de control de cambios.
24. Responsables del cliente para validaciones y suministro de información.

## 29. Observación estratégica

El alcance confirmado es considerable para un precio de $380,000 MXN más IVA y una entrega entre diciembre de 2026 y enero de 2027.

El contrato deberá definir con precisión qué pantallas, procesos, reportes, revisiones, datos, capacitación y soporte se incluyen; qué significa “funcionando”; qué hardware corresponde al corporativo; y qué integraciones se cotizarán después.

Sin esta delimitación, la frase “todo esto” puede crecer durante el desarrollo y convertir el proyecto en trabajo indefinido sin compensación adicional.
