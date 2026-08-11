# Exclusive Shop

Tienda online de perfumes y productos premium.

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
