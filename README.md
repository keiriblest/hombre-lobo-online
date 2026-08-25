# Hombre Lobo Online

Juego de fiesta estilo Mafia/Hombre Lobo, jugable en tiempo real con salas privadas,
chat publico, chat privado de lobos y **27 roles completos**.

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

4. Abre `http://localhost:3000` en varias pestañas o dispositivos de tu red local.

## Como jugar

1. Un jugador crea una sala (host) y comparte el codigo de 5 letras.
2. Los demas se unen con ese codigo.
3. Con 4 jugadores o mas, el host puede iniciar la partida.
4. Cada jugador recibe su rol en privado. Los lobos ademas obtienen un chat privado
   visible solo entre ellos durante la fase de noche.
5. Fases automaticas: Noche (45s) -> Dia/Debate (90s) -> Votacion (30s) -> repite.
6. Gana el pueblo si eliminan a todos los lobos. Ganan los lobos si igualan o superan
   en numero a los jugadores del pueblo vivos. El Jester solo gana si es eliminado.

## Los 27 roles (nombres en ingles en el codigo)

### Bando de los lobos (9 roles)

| Rol (id) | Nombre | Habilidad |
|---|---|---|
| werewolf | Werewolf | Vota de noche junto a la manada para elegir victima |
| alpha_wolf | Alpha Wolf | Igual que el lobo, pero la Seer lo ve como bueno |
| vampire | Vampire | Bloquea al Doctor de noche; su voto de dia no cuenta |
| witch | Witch | Una vez por partida revela publicamente la carta de un bueno |
| siren | Siren | Si es linchada, anula habilidades buenas la noche siguiente |
| shapeshifter | Shapeshifter | La Seer y el Town Crier lo ven como bueno |
| nightmare | Nightmare | Cada noche anula la habilidad de un jugador |
| wolf_shaman | Wolf Shaman | Una vez por partida protege a un malo del linchamiento |

### Bando del pueblo (18 roles)

| Rol (id) | Nombre | Habilidad |
|---|---|---|
| villager | Villager | Sin habilidades, solo debate |
| seer | Seer | Investiga la alineacion de un jugador cada noche |
| doctor | Doctor | Protege a un jugador cada noche |
| knight | Knight | Sobrevive un ataque nocturno, una vez |
| princess | Princess | Sobrevive un linchamiento, una vez (se revela al usarlo) |
| hunter | Hunter | Si muere de noche, 75% de dispararle a un malo al azar |
| necromancer | Necromancer | Una vez por partida revive a un bueno muerto |
| king | King | Inmune de noche si vive Knight, Princess o Jester |
| jester | Jester | Solo gana si el pueblo lo lincha o los lobos lo matan |
| lycan | Lycan | La Seer lo ve como lobo; si lo atacan lobos, se convierte |
| mayor | Mayor | Su voto de dia cuenta doble |
| assassin | Assassin | Una vez por partida, de noche, mata a cualquiera |
| town_crier | Town Crier | Vigila a alguien; si muere se revela su rol al instante |
| lover | Lover (x2) | Pareja vinculada: si uno muere, el otro tambien |
| druid | Druid | Vincula su vida a otro jugador cada noche |
| mystic | Mystic | Revela el rol de un jugador inactivo cada noche |
| thief | Thief | Roba el voto de alguien para la siguiente votacion |
| courtesan | Courtesan | Puede morir en lugar del objetivo de los lobos |
| bard | Bard | Intercambia informacion de rol con otro jugador |

## Estructura del proyecto

```
hombre-lobo-online/
├── package.json
├── server/
│   ├── index.js         # Servidor Express + Socket.IO, fases y resolucion nocturna
│   ├── gameState.js      # Clase Room, pool de roles (con pareja de Lover garantizada)
│   └── roles/
│       ├── index.js      # Registro central de los 27 roles
│       └── *.js           # Un archivo por rol (id y nombre en ingles, descripcion en español)
└── client/
    ├── index.html
    ├── css/style.css
    └── js/main.js         # Incluye chat publico, chat privado de lobos y acciones especiales
```

## Orden de resolucion nocturna

El motor resuelve cada noche en este orden fijo, clave para que las interacciones
entre roles sean correctas:

1. **Bloqueos**: Vampire bloquea al Doctor, Nightmare anula habilidades.
2. **Investigaciones**: Seer, Mystic, Bard (no cambian el estado de vida).
3. **Protecciones y vinculos**: Doctor protege, Druid vincula, Courtesan se ofrece.
4. **Ataques**: voto de los lobos, Assassin, resolucion de victima final.
5. **Reacciones en cadena**: Lover, vinculo del Druid, disparo del Hunter,
   transformacion del Lycan.
6. **Anuncio publico**: solo se informa si alguien murio, nunca su rol (salvo que
   el propio rol lo revele, como el Town Crier o la Princess).

## Desplegar en Railway

1. Conecta este repositorio en Railway: "Deploy from GitHub repo".
2. Railway detecta `package.json` y ejecuta `npm start` automaticamente.
3. Railway asigna un dominio publico para jugar con amigos desde cualquier lugar.
4. No se usa base de datos: el estado de las salas vive en memoria del servidor.

## Notas de diseño

- Cada rol es un modulo independiente en `server/roles/` con `id` y `name` en ingles
  (ej. `id: "werewolf"`, `name: "Werewolf"`) y descripcion en español para la UI.
  Los metadatos incluyen `team`, `hasNightAction`, `hasNightActionOnce`,
  `hasDayActionOnce`, `dayVoteWeight`, etc. Agregar un rol nuevo no requiere tocar
  la logica central del servidor salvo que tenga una interaccion muy especifica.
- Los Lovers se seleccionan siempre como pareja garantizada al construir el pool
  de roles (nunca puede quedar un Lover sin su pareja).
- La informacion privada (rol de cada jugador, resultados de Seer/Mystic/Bard)
  se emite solo al `socket.id` del jugador correspondiente. El chat de lobos usa
  un canal separado (`wolf_chat_message`) que solo llega a los sockets de jugadores
  con `role.team === "evil"`.

## Siguientes pasos sugeridos

1. Persistencia con Redis para soportar reconexion tras caida del servidor.
2. Balanceo automatico de la composicion de roles segun cantidad de jugadores.
3. Empaquetar el cliente en Electron para version de escritorio.
4. Animaciones de fase (amanecer/atardecer) y sonido ambiental.
