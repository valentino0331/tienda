# Exclusive Shop

Tienda online de perfumes y productos premium.

## Diseño de datos Firestore aprobado

Esta sección sustituye las notas preliminares de arquitectura que aparecen más abajo. Solo documenta el modelo: no crea colecciones, reglas ni funcionalidades de Firebase.

Los importes monetarios se almacenarán como enteros en céntimos y con `currency` (por ejemplo, `12990` equivale a S/ 129.90 cuando `currency` es `PEN`).

### `categories`

- `name`, `slug`, `description`, `imageUrl` (opcional)
- `isActive`, `sortOrder`, `createdAt`, `updatedAt`

### `products`

Colección única de productos; no habrá colecciones separadas por género.

- `name`, `slug`, `brand`, `categoryId`, `categoryName`, `description`
- `sku`, `barcode` (opcional), `imageUrls`
- `priceBefore` (opcional; precio anterior o tachado)
- `salePrice` (precio actual), `costPrice`, `currency`
- `gender`: `men`, `women` o `unisex`
- `stockQuantity`, `minStockQuantity`, `isActive`, `createdAt`, `updatedAt`

El descuento se calculará a partir de `priceBefore` y `salePrice`; no se guardará como campo obligatorio.

### `customers`

- `firstName`, `lastName`, `fullName`
- `email`, `phone`, `documentType`, `documentNumber` (opcionales)
- `addresses`, `notes` (opcionales)
- `totalOrders`, `totalSpent`, `lastOrderAt` (resúmenes recalculables)
- `createdAt`, `updatedAt`

### `orders`

Un documento por venta o pedido; conserva los totales y rentabilidad históricos.

- `orderNumber`, `customerId` (opcional)
- `customerSnapshot`: `fullName`, `email`, `phone`, `documentType`, `documentNumber`
- `status`, `paymentStatus`, `fulfillmentStatus`
- `currency`, `subtotal`, `discountTotal`, `taxTotal`, `shippingTotal`, `total`
- `totalCost`, `grossProfit`, `itemCount`
- `notes` (opcional), `createdAt`, `updatedAt`, `paidAt` (opcional), `cancelledAt` (opcional)

### `order_items`

Un documento por línea de pedido, asociado mediante `orderId`. Es un snapshot histórico inmutable y no se actualiza si cambia el producto actual.

- `orderId`
- `productId`, `productName`, `brand`, `sku`
- `categoryId`, `categoryName`, `imageUrl`
- `quantity`, `unitPrice`, `unitCost`, `subtotal`, `costSubtotal`, `grossProfit`
- `currency`, `createdAt`

### `payments`

- `orderId`, `paymentNumber`, `type`, `status`, `method`
- `amount`, `currency`, `reference` (opcional)
- `paidAt` (opcional), `createdAt`, `updatedAt`, `notes` (opcional)

### `inventory_movements`

Registro inmutable de cambios de inventario.

- `productId`, `productName`, `sku`
- `type`, `quantityChange`, `stockBefore`, `stockAfter`, `unitCost` (opcional)
- `referenceType`, `referenceId`, `notes` (opcional)
- `createdAt`, `createdByUserId` (opcional)

### `expenses`

- `description`, `category`, `amount`, `currency`, `expenseDate`, `status`
- `paymentId`, `supplierName`, `reference`, `notes` (opcionales)
- `createdAt`, `updatedAt`, `createdByUserId` (opcional)

### `users`

Preparada para una futura autenticación, sin implementarla ahora.

- `displayName`, `email`, `role`, `isActive`
- `phone` (opcional), `createdAt`, `updatedAt`, `lastLoginAt` (opcional)

Cuando se implemente Firebase Authentication, el ID podrá coincidir con el `uid`.

### `settings`

Documento global sugerido con ID `store`.

- `storeName`, `legalName` (opcional), `currency`, `currencySymbol`, `timezone`
- `orderNumberPrefix`, `nextOrderNumber`
- `lowStockAlertsEnabled`, `defaultMinStockQuantity`
- `updatedAt`, `updatedByUserId` (opcional)

## Estado

Proyecto en desarrollo.

## Tecnologías previstas

- HTML
- CSS
- JavaScript
- Firebase
- Firestore
- Firebase Authentication
- Vercel

## Módulos previstos

- Catálogo
- Productos
- Categorías
- Ofertas
- Carrito
- Clientes
- Pedidos
- WhatsApp
- Yape
- Inventario
- Finanzas
- Dashboard
- Reportes
- Administración

## Firebase

Proyecto Firebase:  
Exclusive Shop

Project ID:  
exclusive-shop-debe0

SDK:  
Firebase JavaScript SDK modular

GestiÃ³n de dependencias:  
npm

La configuraciÃ³n de la aplicaciÃ³n web se agregarÃ¡ posteriormente en
`assets/js/firebase/config.js`. No se incluyen credenciales, cuentas de
servicio ni servicios de Firebase activados en esta etapa.

## Arquitectura futura

Los productos se manejarán mediante una colección genérica, sin colecciones separadas como `perfumes_hombre`, `perfumes_mujer` o `perfumes_unisex`.

Colecciones previstas: `products`, `categories`, `customers`, `orders`, `payments`, `inventory`, `expenses` y `users`.

Cada producto podrá contener: `name`, `brand`, `category`, `gender`, `description`, `images`, `priceBefore`, `price`, `stock`, `featured` y `active`.

`priceBefore` será el precio anterior o tachado; `price` será el precio actual. El descuento se calculará automáticamente:

```text
discount = ((priceBefore - price) / priceBefore) * 100
```

Firebase no está implementado todavía.
