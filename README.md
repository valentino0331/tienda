# Exclusive Shop

Tienda online de perfumes y productos premium construida con HTML, CSS, JavaScript y Firebase.

## Estado actual

Firebase está implementado para el panel administrativo:

- Firebase Authentication con correo y contraseña.
- Verificación del perfil `users/{uid}`: solo permite administradores activos.
- Dashboard protegido y cierre de sesión.
- Gestión administrativa de categorías y productos con Cloud Firestore.
- Catálogo público y detalle de producto conectados a Cloud Firestore.
- Carrito público persistente en `localStorage`, con cantidades, descuentos y control local de stock.

El catálogo público, carrito, checkout, pedidos, clientes, inventario, pagos manuales y reportes administrativos están implementados. No hay una pasarela de pago externa integrada.

## Firebase

- Project ID: `exclusive-shop-debe0`
- SDK: Firebase JavaScript SDK modular 12.17.1
- Base de datos: Cloud Firestore `(default)`
- Reglas locales: `firestore.rules`

La configuración web está en `assets/js/firebase/config.js`. Solo contiene configuración pública de la aplicación web; no incluye cuentas de servicio ni credenciales privadas.

## Módulos administrativos

- `admin/login.html`: inicio de sesión de administrador.
- `admin/dashboard.html`: indicadores reales de ventas, ganancia bruta, costos vendidos, pedidos, clientes, stock y pagos.
- `admin/categorias.html`: crear, editar, activar, desactivar y eliminar categorías sin productos asociados.
- `admin/productos.html`: crear, editar, activar, desactivar y eliminar productos.
- `admin/inventario.html`: consulta de inventario, alertas y ajustes administrativos de stock.
- `admin/pagos.html`: consulta y verificación manual de pagos.
- `admin/reportes.html`: ventas, ganancia, pedidos, productos, categorías, métodos de pago y alertas de stock por período.
- `catalogo.html`: lista productos y categorías activas, con filtro por `categoryId` y búsqueda local.
- `producto.html?id={productId}`: muestra el detalle público de un producto activo.
- `carrito.html`: permite administrar el carrito local y continúa al checkout visual.
- `checkout.html`: recopila datos del cliente y crea pedidos mediante la Callable `createOrder`.

Todos los módulos administrativos reutilizan `requireAdmin()` y la instancia compartida de Firebase.

## Modelo Firestore usado en la fase actual

### `categories/{categoryId}`

- `name`
- `description`
- `isActive`
- `createdAt`
- `updatedAt`

### `products/{productId}`

- `name`
- `description`
- `brand` (string opcional, ej. "Dior")
- `sku` (string opcional, normalizado en mayúsculas sin espacios, ej. "PER-DIO-001")
- `regularPrice` (número, precio habitual)
- `salePrice` (número opcional; debe ser menor que `regularPrice`)
- `categoryId` (ID de `categories`)
- `image` (URL pública opcional)
- `stock` (entero)
- `minStockQuantity` (entero >= 0; umbral de alerta)
- `isActive`
- `createdAt`
- `updatedAt`

### `product_private/{productId}`

Colección privada accesible únicamente por administradores activos y backend autorizado:

- `productId` (ID del producto correspondiente)
- `costPrice` (número >= 0, máximo 2 decimales, precio de costo de compra)
- `updatedAt`

Las operaciones administrativas utilizan escrituras atómicas de lote (`writeBatch`) para mantener `products/{productId}` y `product_private/{productId}` sincronizados. La colección `product_private` está protegida en `firestore.rules` contra lectura y escritura pública.

Los documentos antiguos que aún tengan `price` continúan mostrándose temporalmente como precio regular. Al editar uno desde administración, se guarda con `regularPrice` y el campo antiguo se elimina; no se ejecutan migraciones automáticas.

## Carrito

El carrito se guarda en la clave local `exclusiveShopCart`; no utiliza Firestore. Cada artículo mantiene su ID, precios, stock y cantidad. Los totales se calculan internamente en céntimos. Al abrir el carrito se consulta el estado actual de cada producto para impedir continuar con artículos inactivos o sin stock.

El checkout envía una solicitud a la Cloud Function `createOrder`. El backend valida productos, precios y stock, y en una sola transacción crea o actualiza `customers`, `orders`, `order_items`, `payments` e `inventory_movements`, además de descontar `products.stock`. Los importes financieros se guardan como enteros en céntimos de PEN. La clave `order_idempotency/{idempotencyKey}` evita duplicar pedidos, pagos o descuentos de stock durante reintentos.

## Pagos

Cada pedido crea un documento `payments/{paymentId}` con `method` (`yape` o `manual`), `status: "pending"`, `amount` en céntimos y `currency: "PEN"`. El administrador puede confirmar o rechazar pagos pendientes; esta operación actualiza atómicamente `payments.status` y `orders.paymentStatus`, y registra `verifiedAt` y `verifiedByUserId` con el UID de la sesión administrativa.

Yape se mantiene como método preparado para verificación manual. No se integran APIs, QR, webhooks ni credenciales de pago.

## Dashboard y reportes

El dashboard calcula ventas registradas, costos vendidos y ganancia bruta con los valores históricos de `orders` (`total`, `totalCost` y `grossProfit`, todos en céntimos). Las ventas excluyen pedidos con estado `cancelled`; los gastos operativos no se incluyen porque no existe un modelo de gastos documentado para esa métrica.

Los reportes filtran el período en el cliente después de una lectura administrativa por colección (`orders`, `order_items`, `payments` y `products`). Esta decisión evita consultas por documento y funciona con colecciones vacías, pero debe reevaluarse si el volumen crece para introducir agregaciones de backend en una fase futura.

## Seguridad y preparación de producción

Las reglas de Firestore mantienen lectura pública solo para el catálogo (`categories` y `products`). Las colecciones privadas, administrativas y financieras requieren un administrador activo mediante `isAdmin()`. El navegador no decide precios, costos, totales, stock, números de pedido ni estados de pago: `createOrder` vuelve a leer los datos necesarios con Admin SDK y calcula los importes en el backend.

Firebase App Check no está configurado actualmente. Debe evaluarse y habilitarse en Firebase Console antes de exponer el flujo público a producción. La configuración local incluye reglas y Cloud Functions, pero no una configuración de Hosting ni de Emulator Suite; por ello las pruebas de emulador requieren preparar esas herramientas antes de ejecutarse.

## Desarrollo

Ejecuta el sitio con Live Server. Para comprobar la sintaxis de los módulos Firebase:

```bash
npm.cmd run check:firebase
npm.cmd ls firebase --depth=0
```
