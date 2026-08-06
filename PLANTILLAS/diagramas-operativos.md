# Diagramas operativos digitalizados

## Leyenda

```mermaid
flowchart LR
    A([Terminal: inicio o fin])
    B[/Entrada o salida de datos/]
    C[Proceso]
    D{Decisión}
    E[(Registro)]
```

## 1. Recepción y control de entrega

```mermaid
flowchart TD
    A([INICIO]) --> B[/ENTRADA: factura, remisión, lote y etiqueta/]
    B --> C[PROCESO: capturar recepción y validar documentos]
    C --> D{DECISIÓN: recepción confirmada}
    D -->|SI| E[(REGISTRO: recepción confirmada)]
    E --> F([FIN])
    D -->|NO| G{DECISIÓN: mercancía localizada}
    G -->|LLEGÓ| H[PROCESO: registrar llegada]
    H --> E
    G -->|NO LLEGA| I[PROCESO: abrir incidencia de entrega]
    I --> J{DECISIÓN: mercancía perdida}
    J -->|SI| K[(REGISTRO: mercancía perdida)]
    K --> F
    J -->|NO| G
```

## 2. Solicitud de compra, cotización, crédito y pago

```mermaid
flowchart TD
    A([INICIO]) --> B[/ENTRADA: solicitud de compra/]
    B --> C[PROCESO: validar condición inicial de la solicitud]
    C --> D{DECISIÓN: continuar con compra}
    D -->|NO| E[PROCESO: solicitar confirmación de recibido]
    E --> Z([FIN])
    D -->|SI| F[PROCESO: enviar solicitud de cotización]
    F --> G[/ENTRADA: cotizaciones de proveedores/]
    G --> H[PROCESO: evaluar precio, retenciones y condiciones]
    H --> I{DECISIÓN: compra autorizada}
    I -->|NO| Z
    I -->|SI| J{DECISIÓN: pago a crédito}

    J -->|SI| K[(REGISTRO: crédito registrado)]
    K --> L[PROCESO: generar alerta de entrega]
    L --> M[/ENTRADA: clave de pago y folio bancario/]
    M --> N[PROCESO: notificar pago]
    N --> O[PROCESO: buscar factura]
    O --> Z

    J -->|NO| P[PROCESO: realizar pago]
    P --> Q[(REGISTRO: clave y folio bancario)]
    Q --> R[PROCESO: notificar pago y registrar guía]
    R --> S[PROCESO: buscar factura]
    S --> T[PROCESO: generar alerta de entrega a 30 días]
    T --> Z
```

## 3. Recepción, salida y devolución

### 3.1 Recepción

```mermaid
flowchart TD
    A([INICIO]) --> B[/ENTRADA: factura, pedido y mercancía/]
    B --> C[PROCESO: revisar factura y existencia]
    C --> D{DECISIÓN: recepción aceptada}
    D -->|SI| E[PROCESO: etiquetar mercancía]
    E --> F[(REGISTRO: inventario actualizado)]
    F --> G([FIN])
    D -->|NO| H[PROCESO: registrar devolución de mercancía]
    H --> G
```

### 3.2 Salida y nota de venta

```mermaid
flowchart TD
    A([INICIO]) --> B[/ENTRADA: proveedor y cotización/]
    B --> C[PROCESO: calcular precio con últimos costos y fechas de entrada]
    C --> D{DECISIÓN: cotización autorizada}
    D -->|NO| E[PROCESO: modificar cotización]
    E --> C
    D -->|SI| F[PROCESO: confirmar existencia]
    F --> G[PROCESO: generar nota de venta con logística, cliente y costos]
    G --> H[(REGISTRO: nota de venta)]
    H --> I{DECISIÓN: hay devolución}
    I -->|NO| Z([FIN])
    I -->|SI| J[PROCESO: generar nota de devolución]
    J --> K[(REGISTRO: devolución)]
    K --> L[PROCESO: generar nueva nota de venta]
    L --> Z
```

### 3.3 Clasificación del proveedor en recepción

```mermaid
flowchart TD
    A([INICIO: recepción]) --> B{DECISIÓN: corresponde a transporte}
    B -->|SI| C[(REGISTRO: transporte)]
    B -->|NO| D[(REGISTRO: proveedor)]
    D --> E{DECISIÓN: forma de pago}
    E -->|CRÉDITO| F[(REGISTRO: proveedor a crédito)]
    E -->|CONTADO| G[(REGISTRO: proveedor de contado)]
    F --> H[PROCESO: registrar cuenta]
    G --> H
    C --> Z([FIN])
    H --> Z
```
