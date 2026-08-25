# Hombre Lobo Online — Nucleo (Entrega 1)

Juego de fiesta estilo Mafia/Hombre Lobo, jugable en tiempo real con salas privadas,
chat y 4 roles: Aldeano, Vidente, Doctor y Hombre Lobo.

Inspirado en [Hombre Lobo de Plato](https://platoapp.com/es/juegos/hombre-lobo).

## Como correrlo en local

1. Instala Node.js 18 o superior.
2. En esta carpeta, instala dependencias:

   ```
   npm install
   ```

3. Inicia el servidor:

   ```
   npm start
   ```

4. Abre `http://localhost:3000` en varias pestañas o dispositivos de tu red local
   (usa la IP de tu PC en vez de `localhost` para conectar desde el celular).

## Como jugar

1. Un jugador crea una sala (queda como host) y comparte el codigo de 5 letras.
2. Los demas se unen con ese codigo.
3. Con 4 jugadores o mas, el host puede iniciar la partida.
4. Cada jugador recibe su rol en privado.
5. Fases automaticas: Noche (45s) -> Dia/Debate (90s) -> Votacion (30s) -> repite.
6. Gana el pueblo si eliminan a todos los lobos. Ganan los lobos si igualan o superan
   en numero a los jugadores del pueblo vivos.

## Estructura del proyecto

```
hombre-lobo-online/
├── package.json
├── server/
│   ├── index.js         # Servidor Express + Socket.IO, logica de fases
│   ├── gameState.js      # Clase Room, reparto de roles, condiciones de victoria
│   └── roles/
│       ├── index.js      # Registro central de roles
│       ├── villager.js
│       ├── seer.js
│       ├── doctor.js
│       └── werewolf.js
└── client/
    ├── index.html
    ├── css/style.css
    └── js/main.js
```

## Desplegar en Railway

1. Este repositorio ya esta listo para subir a Railway.
2. En Railway, crea un nuevo proyecto -> "Deploy from GitHub repo" -> selecciona este repo.
3. Railway detecta `package.json` y ejecuta `npm start` automaticamente.
4. Railway asigna un dominio publico: usalo para jugar con amigos desde cualquier lugar.
5. No necesitas configurar base de datos: el estado de las salas vive en memoria del
   servidor (se pierde si el servidor se reinicia, es esperado en esta version).

## Notas de diseño (para cuando amplies a los 27 roles)

- Cada rol es un objeto con metadatos (`team`, `hasNightAction`, `resolveNightAction`)
  en `server/roles/`. Para agregar un rol nuevo, crea su archivo y registralo en
  `server/roles/index.js` — no hace falta tocar `index.js` del servidor salvo para
  casos con logica de resolucion muy especifica (ej. Amantes, Cazador).
- El orden de resolucion nocturna en `resolveNight()` es el punto mas delicado.
  Sigue este orden al agregar roles: bloqueos -> investigaciones -> protecciones ->
  ataques -> reacciones en cadena (Cazador, Licantropo, Druida) -> anuncio publico.
- El chat es publico durante toda la partida en esta version. Cuando agregues el
  rol Lobo, conviene crear un chat privado solo entre lobos durante la fase de noche.
- La informacion privada (rol de cada jugador, resultado de la Vidente) se emite
  solo al `socket.id` del jugador correspondiente con `io.to(player.socketId).emit(...)`.
  Nunca uses `io.to(room.code).emit(...)` para datos que deban ser secretos.

## Siguientes pasos sugeridos

1. Agregar chat nocturno privado para los lobos.
2. Ampliar a los 27 roles: Werewolf, Alfa, Vampiro, Bruja, Sirena, Cambiaformas,
   Pesadilla, Chaman Lobo, Vidente, Doctor, Caballero, Princesa, Cazador,
   Nigromante, Rey, Bufon, Licantropo, Alcalde, Asesino, Pregonero, Amantes,
   Druida, Mistico, Ladron, Cortesana, Bardo, Aldeano.
3. Persistencia con Redis si quieres soportar reconexion tras caida del servidor.
4. Empaquetar el cliente en Electron para version de escritorio, reutilizando
   `client/` casi sin cambios.
